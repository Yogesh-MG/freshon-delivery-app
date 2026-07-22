import type { WSChannel, WSEvent } from "../types";
export type WSEventHandler = (event: WSEvent) => void;
export type WSStatusHandler = (status: "connecting" | "connected" | "disconnected" | "error") => void;
/**
 * Connect to a WebSocket channel.
 *
 * ```ts
 * import { connect, subscribe } from "@freshon/api/ws";
 *
 * connect("orders");
 * subscribe("orders", (event) => {
 *   if (event.type === "order_status_changed") { ... }
 * });
 * ```
 */
export declare function connect(channel: WSChannel): void;
/**
 * Subscribe to events on a channel.
 * Returns an unsubscribe function.
 */
export declare function subscribe(channel: WSChannel, handler: WSEventHandler): () => void;
/**
 * Subscribe to connection status changes.
 * Returns an unsubscribe function.
 */
export declare function onStatus(channel: WSChannel, handler: WSStatusHandler): () => void;
/**
 * Disconnect from a specific channel.
 */
export declare function disconnect(channel: WSChannel): void;
/**
 * Disconnect from all channels. Call on logout.
 */
export declare function disconnectAll(): void;
/**
 * Send a message on an open WebSocket channel.
 */
export declare function send(channel: WSChannel, data: Record<string, unknown>): void;
//# sourceMappingURL=ws.d.ts.map