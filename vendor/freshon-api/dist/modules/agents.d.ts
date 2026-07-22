export interface AgentSession {
    id: string;
    agent_type: string;
    status: "ACTIVE" | "CLOSED" | "EXPIRED";
    created_at: string;
    updated_at: string;
    message_count?: number;
}
export interface AgentMessage {
    id: string;
    sender: "USER" | "AGENT_OUTPUT" | "AGENT_THOUGHT" | "SYSTEM";
    content: string;
    created_at: string;
    tool_calls?: AgentToolCall[];
}
export interface AgentToolCall {
    id: string;
    tool_name: string;
    arguments: Record<string, unknown>;
    result: unknown;
    is_success: boolean;
    created_at: string;
}
export interface CreateSessionRequest {
    agent_type: string;
    initial_message?: string;
}
export interface CreateSessionResponse {
    session: AgentSession;
    reply?: string;
}
export interface ChatRequest {
    message: string;
    attachments?: string[];
}
export interface ChatResponse {
    reply: string;
    session_id: string;
}
export interface FileUploadResponse {
    url: string;
    filename: string;
    mimetype: string;
    size: number;
}
export interface BiAgentResponse {
    agent: string;
    query: string;
    steps: string[];
    data: {
        sales?: BiSalesData;
        inventory?: BiInventoryData;
        customers?: BiCustomerData;
        deliveries?: BiDeliveryData;
        farmers?: BiFarmerData;
        finance?: BiFinanceData;
        anomalies?: BiAnomalyData;
        comparison?: BiComparisonData;
    };
    insights: string[];
    text: string;
    error?: string;
}
export interface BiSalesData {
    success: boolean;
    data?: {
        summary: {
            total_revenue: string;
            total_orders: number;
            average_order_value: string;
            period: string;
            date_range: {
                from: string;
                to: string;
            };
        };
        by_payment_method?: Array<{
            method: string;
            orders: number;
            revenue: string;
        }>;
        by_delivery_slot?: Array<{
            slot: string;
            orders: number;
            revenue: string;
        }>;
        trend?: Array<{
            date: string;
            revenue: number;
            orders: number;
        }>;
        breakdown?: Array<{
            category: string;
            revenue: number;
            orders: number;
        }>;
    };
    error?: string;
}
export interface BiInventoryData {
    success: boolean;
    filter_applied?: string;
    summary?: {
        total_batches: number;
        filtered_batches: number;
        low_stock: number;
        out_of_stock: number;
        pending_approval: number;
        expiring_soon: number;
        total_value: string;
    };
    batches?: Array<{
        batch_id: string;
        product: string;
        variant: string;
        stock_level: number;
        farmer: string;
        category: string;
        status: string;
        margin?: string;
    }>;
    error?: string;
}
export interface BiCustomerData {
    success: boolean;
    segment?: string;
    period?: string;
    summary?: {
        total_customers: number;
        new_this_month: number;
        matching_segment: number;
    };
    customers?: Array<{
        customer_id: number;
        name: string;
        email: string;
        orders_in_period: number;
        total_spent: string;
        is_prides_partner: boolean;
    }>;
    error?: string;
}
export interface BiDeliveryData {
    success: boolean;
    period?: string;
    summary?: {
        total_assignments: number;
        delivered: number;
        on_time_rate: string;
        avg_delivery_time_minutes: number;
        partners_online: string;
    };
    status_breakdown?: Array<{
        status: string;
        count: number;
    }>;
    partner_performance?: Array<{
        partner_id: number;
        name: string;
        assignments: number;
        delivered: number;
        success_rate: string;
    }>;
    error?: string;
}
export interface BiFarmerData {
    success: boolean;
    period?: string;
    summary?: {
        total_farmers: number;
        active_farmers: number;
        total_payouts: string;
    };
    farmers?: Array<{
        farmer_id: number;
        name: string;
        farm_name: string;
        location: string;
        rating: number;
        revenue_generated: string;
        items_sold: number;
        is_organic: boolean;
    }>;
    error?: string;
}
export interface BiFinanceData {
    success: boolean;
    data?: {
        summary: {
            total_revenue: string;
            online_revenue: string;
            pos_revenue: string;
            online_orders: number;
            pos_transactions: number;
        };
        payment_breakdown?: {
            online: Array<{
                method: string;
                orders: number;
                revenue: string;
            }>;
            pos_methods: Array<{
                method: string;
                count: number;
                revenue: number;
            }>;
        };
    };
    error?: string;
}
export interface BiAnomalyData {
    success: boolean;
    period?: string;
    sensitivity?: string;
    anomalies_detected?: number;
    anomalies?: Array<{
        area: string;
        severity: string;
        type: string;
        message: string;
        recommendation: string;
    }>;
    summary_by_area?: {
        sales: number;
        inventory: number;
        delivery: number;
        customers: number;
    };
    error?: string;
}
export interface BiComparisonData {
    success: boolean;
    metric?: string;
    current_period?: {
        label: string;
        from: string;
        to: string;
        value: string;
    };
    previous_period?: {
        label: string;
        from: string;
        to: string;
        value: string;
    };
    change?: {
        absolute: string;
        percentage: string;
        trend: "up" | "down" | "flat";
    };
    error?: string;
}
/**
 * Create a new agent chat session.
 * POST /api/agents/sessions/
 */
export declare function createSession(data: CreateSessionRequest): Promise<CreateSessionResponse>;
/**
 * List the user's recent chat sessions.
 * GET /api/agents/sessions/list/
 */
export declare function listSessions(): Promise<AgentSession[]>;
/**
 * Get a session with its full message history.
 * GET /api/agents/sessions/<session_id>/
 */
export declare function getSession(sessionId: string): Promise<AgentSession>;
/**
 * Send a message to the agent and get a reply.
 * POST /api/agents/sessions/<session_id>/chat/
 */
export declare function chat(sessionId: string, data: ChatRequest): Promise<ChatResponse>;
/** A single Server-Sent-Events frame from the streaming chat endpoint. */
export interface ChatStreamEvent {
    type: "token" | "step" | "done" | "error";
    /** token text (type === "token") */
    t?: string;
    /** tool-progress label (type === "step") */
    label?: string;
    /** final, authoritative answer (type === "done") */
    text?: string;
    /** error detail (type === "error") */
    detail?: string;
}
export interface ChatStreamHandlers {
    onToken?: (chunk: string) => void;
    onStep?: (label: string) => void;
    onDone?: (fullText: string) => void;
    onError?: (detail: string) => void;
}
/**
 * Stream a chat reply token-by-token via Server-Sent Events so the UI can
 * render a live typing effect instead of blocking on the full completion.
 *
 * POST /api/agents/sessions/<session_id>/chat/stream/
 *
 * Uses `fetch` (not the axios client) for a readable stream. The axios silent-
 * refresh interceptor does NOT apply here, so on any failure (incl. 401) this
 * rejects — callers should fall back to the blocking `chat()` endpoint.
 */
export declare function chatStream(sessionId: string, data: ChatRequest, handlers: ChatStreamHandlers, signal?: AbortSignal): Promise<void>;
/**
 * Upload a file (image/video) for agent messages.
 * POST /api/agents/upload/
 *
 * @param file - The file to upload
 * @returns FileUploadResponse with URL and metadata
 */
export declare function uploadFile(file: File): Promise<FileUploadResponse>;
/**
 * Query the comprehensive BI agent with natural language.
 * This agent has access to ALL business data:
 * - Sales & Revenue
 * - Inventory
 * - Customers
 * - Deliveries
 * - Farmers
 * - Finance
 * - HR
 * - Support
 * - Anomaly Detection
 *
 * POST /api/pos/fos/agent/query/
 */
export declare function queryBiAgent(data: {
    message: string;
    agent_type?: string;
}): Promise<BiAgentResponse>;
/**
 * Quick sales query via BI agent.
 * Convenience wrapper for common sales queries.
 */
export declare function querySales(params?: {
    period?: string;
    category?: string;
    group_by?: string;
}): Promise<BiSalesData>;
/**
 * Quick inventory query via BI agent.
 * Convenience wrapper for common inventory queries.
 */
export declare function queryInventory(params?: {
    filter?: string;
    category?: string;
}): Promise<BiInventoryData>;
/**
 * Detect business anomalies across all areas.
 * Scans for unusual patterns in sales, inventory, deliveries, and customers.
 */
export declare function detectAnomalies(params?: {
    period?: string;
    sensitivity?: "low" | "medium" | "high";
}): Promise<BiAnomalyData>;
/**
 * Compare business metrics between periods.
 */
export declare function comparePeriods(params?: {
    metric?: string;
    current_period?: string;
    previous_period?: string;
}): Promise<BiComparisonData>;
/**
 * Get business overview across all metrics.
 * Quick health check of the entire business.
 */
export declare function getBusinessOverview(): Promise<BiAgentResponse>;
/**
 * Get demand forecast for products.
 */
export declare function getDemandForecast(params?: {
    category?: string;
    top_n?: number;
}): Promise<{
    success: boolean;
    forecast_period?: string;
    method?: string;
    forecasts?: Array<{
        product: string;
        category: string;
        sold_last_30d: number;
        avg_daily_sales: number;
        forecast_next_7d: number;
        confidence: string;
    }>;
    error?: string;
}>;
//# sourceMappingURL=agents.d.ts.map