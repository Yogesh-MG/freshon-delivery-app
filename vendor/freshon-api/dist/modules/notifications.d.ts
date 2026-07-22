/**
 * Unified Notification Service for FreshOn Stack
 *
 * Handles WebSocket connections, Web Push subscriptions, and Tauri native notifications.
 * This module is shared across all FreshOn applications (Consumer, Farm, POS, etc.)
 */
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export interface NotificationMessage {
    id?: string;
    title: string;
    body: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    data?: Record<string, unknown>;
    timestamp?: string;
}
export interface NotificationOptions {
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}
export interface WebSocketConfig {
    url: string;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    maxReconnectDelay?: number;
}
export declare class NotificationService {
    private wsManager;
    private _baseUrl?;
    constructor(baseUrl?: string);
    private getBaseUrl;
    /**
     * Subscribe to Web Push notifications
     * Stores the subscription on the backend for later use
     */
    subscribeToPush(subscription: WebPushSubscription): Promise<{
        status: string;
    }>;
    /**
     * Unsubscribe from Web Push notifications
     */
    unsubscribeFromPush(): Promise<{
        status: string;
    }>;
    /**
     * Get VAPID public key for Web Push subscription
     */
    getVapidPublicKey(): Promise<{
        publicKey: string;
    }>;
    /**
     * Connect to WebSocket for real-time notifications
     * Automatically handles reconnection with exponential backoff
     */
    connectWebSocket(token: string, onMessageReceived: (data: NotificationMessage) => void, path?: string): WebSocket;
    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket(): void;
    /**
     * Check if WebSocket is connected
     */
    isWebSocketConnected(): boolean;
    /**
     * Check if native notifications are supported
     */
    isNativeSupported(): Promise<boolean>;
    /**
     * Check notification permission status
     */
    getPermissionStatus(): Promise<"granted" | "denied" | "default">;
    /**
     * Request notification permission
     */
    requestPermission(): Promise<"granted" | "denied" | "default">;
    /**
     * Show a native system notification
     * Works in both Tauri (desktop/mobile) and browser environments
     */
    showNativeToast(title: string, body: string, options?: NotificationOptions): Promise<void>;
    /**
     * Register service worker for background push (PWA/Mobile Web)
     * Returns the push subscription if successful
     */
    registerServiceWorker(swPath?: string): Promise<ServiceWorkerRegistration | null>;
    /**
     * Subscribe to push notifications via service worker
     */
    subscribeToPushViaServiceWorker(registration: ServiceWorkerRegistration): Promise<WebPushSubscription | null>;
    /**
     * Utility: Convert base64 to Uint8Array for VAPID key
     */
    private urlBase64ToUint8Array;
}
export declare const notifications: NotificationService;
export default notifications;
//# sourceMappingURL=notifications.d.ts.map