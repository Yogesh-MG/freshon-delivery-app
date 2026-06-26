/**
 * Singleton WebSocket manager for the delivery driver app.
 *
 * Responsibilities:
 *  - Keep one persistent connection to /ws/delivery/driver/?token=<jwt>
 *  - Auto-reconnect with capped exponential backoff on any close/error
 *  - Send location heartbeats every LOCATION_INTERVAL_MS while connected
 *  - Expose claimTrip / cancelTrip as Promise-based calls backed by a
 *    request-ID correlation map so callers get typed results back
 *  - Emit typed events to registered listeners (trip_available, trip_claimed,
 *    trip_released, connected, disconnected)
 *
 * Usage:
 *   deliverySocket.connect(jwtToken)
 *   deliverySocket.on("trip_available", handler)
 *   const result = await deliverySocket.claimTrip(tripId)
 *   deliverySocket.disconnect()
 */

import { DeliveryTrip } from "./deliveryTripService";

const WS_BASE = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace(/^http/, "ws")
  .replace(/\/$/, "");

const WS_PATH = "/ws/delivery/driver/";
const LOCATION_INTERVAL_MS = 30_000;
const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;
const CLAIM_TIMEOUT_MS = 10_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface TripAvailableEvent {
  trip: DeliveryTrip;
  in_range: boolean;
}

export interface ClaimResult {
  success: boolean;
  trip?: DeliveryTrip;
  error?: string;
}

type EventMap = {
  connected: void;
  disconnected: void;
  trip_available: TripAvailableEvent;
  trip_claimed: { trip_id: string };
  trip_released: TripAvailableEvent;
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

// ── Singleton class ──────────────────────────────────────────────────────────

class DeliverySocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private locationTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private backoffMs = 1_000;
  private intentionalClose = false;

  private listeners: { [K in keyof EventMap]?: Set<Listener<K>> } = {};
  private pendingClaims = new Map<string, (result: ClaimResult) => void>();

  // ── Public API ─────────────────────────────────────────────────────────

  connect(token: string) {
    this.token = token;
    this.intentionalClose = false;
    this._open();
  }

  disconnect() {
    this.intentionalClose = true;
    this._clearTimers();
    this.ws?.close(1000, "driver-offline");
    this.ws = null;
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<K>) {
    if (!this.listeners[event]) this.listeners[event] = new Set() as any;
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return () => (this.listeners[event] as Set<Listener<K>>).delete(listener);
  }

  sendLocation(lat: number, lng: number) {
    this._send({ type: "location_update", lat, lng });
  }

  claimTrip(tripId: string): Promise<ClaimResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingClaims.delete(tripId);
        resolve({ success: false, error: "Claim timed out — try again." });
      }, CLAIM_TIMEOUT_MS);

      this.pendingClaims.set(tripId, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      this._send({ type: "claim_trip", trip_id: tripId });
    });
  }

  cancelTrip(tripId: string) {
    this._send({ type: "cancel_trip", trip_id: tripId });
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Private ────────────────────────────────────────────────────────────

  private _open() {
    if (!this.token) return;
    const url = `${WS_BASE}${WS_PATH}?token=${encodeURIComponent(this.token)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoffMs = 1_000;
      this._emit("connected", undefined as void);
      this._startLocationTimer();
      this._startPingTimer();
    };

    ws.onmessage = (e) => {
      try {
        this._handle(JSON.parse(e.data));
      } catch { /* malformed frame */ }
    };

    ws.onerror = () => { /* onclose fires next */ };

    ws.onclose = () => {
      this._clearTimers();
      this._emit("disconnected", undefined as void);
      if (!this.intentionalClose) this._scheduleReconnect();
    };
  }

  private _handle(msg: Record<string, unknown>) {
    switch (msg.type) {
      case "pong":
        break;

      case "trip_available":
        this._emit("trip_available", {
          trip: msg.trip as DeliveryTrip,
          in_range: Boolean(msg.in_range),
        });
        break;

      case "trip_claimed":
        this._emit("trip_claimed", { trip_id: msg.trip_id as string });
        break;

      case "trip_released":
        this._emit("trip_released", {
          trip: msg.trip as DeliveryTrip,
          in_range: Boolean(msg.in_range),
        });
        break;

      case "claim_result": {
        const tripId = msg.trip_id as string;
        const cb = this.pendingClaims.get(tripId);
        if (cb) {
          this.pendingClaims.delete(tripId);
          cb({
            success: Boolean(msg.success),
            trip: msg.trip as DeliveryTrip | undefined,
            error: msg.error as string | undefined,
          });
        }
        break;
      }
    }
  }

  private _emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) => fn(payload));
  }

  private _send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private _startLocationTimer() {
    this._stopLocationTimer();
    this.locationTimer = setInterval(() => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => this.sendLocation(pos.coords.latitude, pos.coords.longitude),
        () => { /* permission denied / unavailable — skip */ },
        { enableHighAccuracy: false, timeout: 5_000, maximumAge: 20_000 },
      );
    }, LOCATION_INTERVAL_MS);
    // Send an immediate first ping so the backend has a position right away.
    navigator.geolocation?.getCurrentPosition(
      (pos) => this.sendLocation(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 },
    );
  }

  private _stopLocationTimer() {
    if (this.locationTimer) clearInterval(this.locationTimer);
    this.locationTimer = null;
  }

  private _startPingTimer() {
    this.pingTimer = setInterval(() => this._send({ type: "ping" }), PING_INTERVAL_MS);
  }

  private _clearTimers() {
    this._stopLocationTimer();
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pingTimer = null;
    this.reconnectTimer = null;
  }

  private _scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this._open();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }
}

export const deliverySocket = new DeliverySocketManager();
