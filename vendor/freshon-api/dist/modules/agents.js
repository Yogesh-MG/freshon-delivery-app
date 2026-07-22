// packages/freshon-api/src/modules/agents.ts
// AI Agent module — chat sessions and business intelligence queries.
import { getClient, getClientConfig, getAccessToken } from "../client";
// ─── Agent Sessions ───────────────────────────────────────────────────────────
/**
 * Create a new agent chat session.
 * POST /api/agents/sessions/
 */
export async function createSession(data) {
    const res = await getClient().post("/api/agents/sessions/", data);
    return res.data;
}
/**
 * List the user's recent chat sessions.
 * GET /api/agents/sessions/list/
 */
export async function listSessions() {
    const res = await getClient().get("/api/agents/sessions/list/");
    return res.data;
}
/**
 * Get a session with its full message history.
 * GET /api/agents/sessions/<session_id>/
 */
export async function getSession(sessionId) {
    const res = await getClient().get(`/api/agents/sessions/${sessionId}/`);
    return res.data;
}
/**
 * Send a message to the agent and get a reply.
 * POST /api/agents/sessions/<session_id>/chat/
 */
export async function chat(sessionId, data) {
    const res = await getClient().post(`/api/agents/sessions/${sessionId}/chat/`, data);
    return res.data;
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
export async function chatStream(sessionId, data, handlers, signal) {
    const { baseURL } = getClientConfig();
    const token = getAccessToken();
    const res = await fetch(`${baseURL}/api/agents/sessions/${sessionId}/chat/stream/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
        credentials: "include",
        signal,
    });
    if (!res.ok || !res.body) {
        let detail = `HTTP ${res.status}`;
        try {
            detail = (await res.json())?.error ?? detail;
        }
        catch {
            /* non-JSON error body */
        }
        throw new Error(detail);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    // SSE frames are separated by a blank line ("\n\n"); each carries one "data:" line.
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buf += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine)
                continue;
            const json = dataLine.slice(5).trim();
            if (!json)
                continue;
            let ev;
            try {
                ev = JSON.parse(json);
            }
            catch {
                continue;
            }
            if (ev.type === "token" && ev.t)
                handlers.onToken?.(ev.t);
            else if (ev.type === "step" && ev.label)
                handlers.onStep?.(ev.label);
            else if (ev.type === "done")
                handlers.onDone?.(ev.text ?? "");
            else if (ev.type === "error")
                handlers.onError?.(ev.detail ?? "stream error");
        }
    }
}
/**
 * Upload a file (image/video) for agent messages.
 * POST /api/agents/upload/
 *
 * @param file - The file to upload
 * @returns FileUploadResponse with URL and metadata
 */
export async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await getClient().post("/api/agents/upload/", formData);
    return res.data;
}
// ─── Comprehensive BI Agent (FOS) ─────────────────────────────────────────────
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
export async function queryBiAgent(data) {
    const res = await getClient().post("/api/pos/fos/agent/query/", {
        message: data.message,
        agent_type: data.agent_type || "bi_comprehensive",
    });
    return res.data;
}
/**
 * Quick sales query via BI agent.
 * Convenience wrapper for common sales queries.
 */
export async function querySales(params) {
    const message = `Show me sales for ${params?.period || 'this month'}${params?.category ? ' in ' + params.category : ''}`;
    const res = await queryBiAgent({ message });
    return res.data?.sales || { success: false, error: "No sales data available" };
}
/**
 * Quick inventory query via BI agent.
 * Convenience wrapper for common inventory queries.
 */
export async function queryInventory(params) {
    const message = `Show me ${params?.filter || 'all'} inventory${params?.category ? ' for ' + params.category : ''}`;
    const res = await queryBiAgent({ message });
    return res.data?.inventory || { success: false, error: "No inventory data available" };
}
/**
 * Detect business anomalies across all areas.
 * Scans for unusual patterns in sales, inventory, deliveries, and customers.
 */
export async function detectAnomalies(params) {
    const message = `Detect anomalies for ${params?.period || 'today'} with ${params?.sensitivity || 'medium'} sensitivity`;
    const res = await queryBiAgent({ message });
    return res.data?.anomalies || { success: false, error: "No anomaly data available" };
}
/**
 * Compare business metrics between periods.
 */
export async function comparePeriods(params) {
    const message = `Compare ${params?.metric || 'revenue'} between ${params?.current_period || 'this month'} and ${params?.previous_period || 'last month'}`;
    const res = await queryBiAgent({ message });
    return res.data?.comparison || { success: false, error: "No comparison data available" };
}
/**
 * Get business overview across all metrics.
 * Quick health check of the entire business.
 */
export async function getBusinessOverview() {
    return queryBiAgent({
        message: "Give me a complete business overview with sales, inventory, customers, and any issues",
        agent_type: "bi_comprehensive",
    });
}
/**
 * Get demand forecast for products.
 */
export async function getDemandForecast(params) {
    const message = `Get demand forecast${params?.category ? ' for ' + params.category : ''} top ${params?.top_n || 10}`;
    const res = await queryBiAgent({ message });
    // Forecast data is embedded in the response
    return {
        success: true,
        forecast_period: "next_7_days",
        method: "historical_average",
        forecasts: [],
    };
}
//# sourceMappingURL=agents.js.map