/**
 * Unified Notification Service for FreshOn Stack
 *
 * Handles WebSocket connections, Web Push subscriptions, and Tauri native notifications.
 * This module is shared across all FreshOn applications (Consumer, Farm, POS, etc.)
 */
import { getClient } from "../client";
// ─── WebSocket Manager ────────────────────────────────────────────────
class WebSocketManager {
    constructor(config) {
        this.ws = null;
        this.reconnectCount = 0;
        this.reconnectTimer = null;
        this.isIntentionallyClosed = false;
        this.messageHandler = null;
        this.config = {
            reconnectAttempts: 10,
            reconnectDelay: 1000,
            maxReconnectDelay: 30000,
            ...config,
        };
    }
    connect(token, onMessage) {
        this.messageHandler = onMessage;
        this.isIntentionallyClosed = false;
        this.reconnectCount = 0;
        this.doConnect(token);
        return this.ws;
    }
    doConnect(token) {
        try {
            // Append token as query parameter for authentication
            const wsUrl = `${this.config.url}?token=${encodeURIComponent(token)}`;
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = () => {
                console.log("[FreshOn Notifications] WebSocket connected");
                this.reconnectCount = 0;
            };
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.messageHandler?.(data);
                }
                catch (error) {
                    console.error("[FreshOn Notifications] Failed to parse message:", error);
                }
            };
            this.ws.onclose = (event) => {
                console.log("[FreshOn Notifications] WebSocket closed:", event.code, event.reason);
                if (!this.isIntentionallyClosed) {
                    this.scheduleReconnect(token);
                }
            };
            this.ws.onerror = (error) => {
                console.error("[FreshOn Notifications] WebSocket error:", error);
            };
        }
        catch (error) {
            console.error("[FreshOn Notifications] Failed to connect WebSocket:", error);
            this.scheduleReconnect(token);
        }
    }
    scheduleReconnect(token) {
        if (this.reconnectCount >= this.config.reconnectAttempts) {
            console.error("[FreshOn Notifications] Max reconnection attempts reached");
            return;
        }
        const delay = Math.min(this.config.reconnectDelay * Math.pow(2, this.reconnectCount), this.config.maxReconnectDelay);
        console.log(`[FreshOn Notifications] Reconnecting in ${delay}ms (attempt ${this.reconnectCount + 1})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectCount++;
            this.doConnect(token);
        }, delay);
    }
    close() {
        this.isIntentionallyClosed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
let tauriNotificationModule = null;
/**
 * Dynamically import Tauri notification plugin
 * This avoids errors in non-Tauri environments (web browsers)
 */
async function getTauriNotifications() {
    if (tauriNotificationModule)
        return tauriNotificationModule;
    // Check if we're in a Tauri environment
    if (typeof window !== "undefined" && window.__TAURI__) {
        try {
            // Dynamic import for Tauri plugin - wrapped to avoid bundling issues
            const module = await eval('import("@tauri-apps/plugin-notification")');
            tauriNotificationModule = module;
            return module;
        }
        catch (error) {
            console.warn("[FreshOn Notifications] Tauri plugin not available:", error);
            return null;
        }
    }
    return null;
}
/**
 * Check if running in Tauri environment
 */
function isTauri() {
    return typeof window !== "undefined" && !!window.__TAURI__;
}
export class NotificationService {
    constructor(baseUrl) {
        this.wsManager = null;
        this._baseUrl = baseUrl;
    }
    getBaseUrl() {
        if (this._baseUrl)
            return this._baseUrl;
        // Derive WebSocket URL from API base URL dynamically
        const apiUrl = getClient().defaults.baseURL || "";
        const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
        const wsHost = apiUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return `${wsProtocol}://${wsHost}`;
    }
    // ─── Web Push Methods ───────────────────────────────────────────────
    /**
     * Subscribe to Web Push notifications
     * Stores the subscription on the backend for later use
     */
    async subscribeToPush(subscription) {
        const response = await getClient().post("/api/notifications/subscribe/", subscription);
        return response.data;
    }
    /**
     * Unsubscribe from Web Push notifications
     */
    async unsubscribeFromPush() {
        const response = await getClient().post("/api/notifications/unsubscribe/", {});
        return response.data;
    }
    /**
     * Get VAPID public key for Web Push subscription
     */
    async getVapidPublicKey() {
        const response = await getClient().get("/api/notifications/vapid-key/");
        return response.data;
    }
    // ─── WebSocket Methods ──────────────────────────────────────────────
    /**
     * Connect to WebSocket for real-time notifications
     * Automatically handles reconnection with exponential backoff
     */
    connectWebSocket(token, onMessageReceived, path = "/ws/notifications/") {
        this.disconnectWebSocket(); // Close any existing connection
        this.wsManager = new WebSocketManager({
            url: `${this.getBaseUrl()}${path}`,
        });
        return this.wsManager.connect(token, onMessageReceived);
    }
    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket() {
        this.wsManager?.close();
        this.wsManager = null;
    }
    /**
     * Check if WebSocket is connected
     */
    isWebSocketConnected() {
        return this.wsManager?.isConnected() || false;
    }
    // ─── Native Notifications ───────────────────────────────────────────
    /**
     * Check if native notifications are supported
     */
    async isNativeSupported() {
        if (isTauri()) {
            const tauri = await getTauriNotifications();
            return !!tauri;
        }
        return "Notification" in window;
    }
    /**
     * Check notification permission status
     */
    async getPermissionStatus() {
        if (isTauri()) {
            const tauri = await getTauriNotifications();
            if (tauri) {
                const granted = await tauri.isPermissionGranted();
                return granted ? "granted" : "default";
            }
        }
        if ("Notification" in window) {
            return Notification.permission;
        }
        return "denied";
    }
    /**
     * Request notification permission
     */
    async requestPermission() {
        if (isTauri()) {
            const tauri = await getTauriNotifications();
            if (tauri) {
                return await tauri.requestPermission();
            }
        }
        if ("Notification" in window) {
            return await Notification.requestPermission();
        }
        return "denied";
    }
    /**
     * Show a native system notification
     * Works in both Tauri (desktop/mobile) and browser environments
     */
    async showNativeToast(title, body, options = {}) {
        const permission = await this.getPermissionStatus();
        if (permission !== "granted") {
            console.warn("[FreshOn Notifications] Permission not granted");
            return;
        }
        // Try Tauri native notification first (for desktop/mobile apps)
        if (isTauri()) {
            const tauri = await getTauriNotifications();
            if (tauri) {
                tauri.sendNotification({
                    title,
                    body,
                    icon: options.icon,
                    sound: undefined, // Tauri doesn't support custom sounds in basic API
                });
                return;
            }
        }
        // Fallback to Web Notifications API (for browser/PWA)
        if ("Notification" in window) {
            new Notification(title, {
                body,
                icon: options.icon,
                badge: options.badge,
                tag: options.tag,
                requireInteraction: options.requireInteraction,
                // @ts-ignore - actions not in standard types yet
                actions: options.actions,
            });
        }
    }
    /**
     * Register service worker for background push (PWA/Mobile Web)
     * Returns the push subscription if successful
     */
    async registerServiceWorker(swPath = "/sw.js") {
        if (!("serviceWorker" in navigator)) {
            console.warn("[FreshOn Notifications] Service workers not supported");
            return null;
        }
        try {
            const registration = await navigator.serviceWorker.register(swPath);
            console.log("[FreshOn Notifications] Service Worker registered:", registration);
            return registration;
        }
        catch (error) {
            console.error("[FreshOn Notifications] Service Worker registration failed:", error);
            return null;
        }
    }
    /**
     * Subscribe to push notifications via service worker
     */
    async subscribeToPushViaServiceWorker(registration) {
        try {
            const { publicKey } = await this.getVapidPublicKey();
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicKey),
            });
            // Convert to our format and send to backend
            const pushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")))),
                },
            };
            await this.subscribeToPush(pushSubscription);
            return pushSubscription;
        }
        catch (error) {
            console.error("[FreshOn Notifications] Push subscription failed:", error);
            return null;
        }
    }
    /**
     * Utility: Convert base64 to Uint8Array for VAPID key
     */
    urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray.buffer;
    }
}
// ─── Singleton Instance ───────────────────────────────────────────────
export const notifications = new NotificationService();
// Default export for convenience
export default notifications;
//# sourceMappingURL=notifications.js.map