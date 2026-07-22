// packages/freshon-api/src/modules/support.ts
// Customer-facing support — the consumer side of the support desk: the "talk to
// a human" handoff from the Sprout chat. Maps to apps/pos/support_customer_views.py.
// (The FOS agent side lives in the `fos` module: getTickets/getTicketMessages/…)
import { getClient } from "../client";
/**
 * Open (or reuse) a live human-handoff ticket from the customer chat.
 *
 * Pass `session_id` (the current Sprout chat) so the FOS agent can read what the
 * customer already told the AI. The server verifies the session belongs to the
 * caller and falls back to their most recent one if it is omitted.
 */
export async function escalateToHuman(data) {
    const res = await getClient().post("/api/pos/support/escalate/", data ?? {});
    return res.data;
}
/** The customer's current live handoff (to resume on reload), or null. */
export async function getActiveHandoff() {
    const res = await getClient().get("/api/pos/support/my/active/");
    return res.data;
}
/** Read the customer's own ticket thread. */
export async function getMyMessages(ticketId) {
    const res = await getClient().get(`/api/pos/support/my/${ticketId}/messages/`);
    return res.data;
}
/** Customer adds a message to their own ticket. */
export async function sendMyMessage(ticketId, message) {
    const res = await getClient().post(`/api/pos/support/my/${ticketId}/messages/`, { message });
    return res.data;
}
//# sourceMappingURL=support.js.map