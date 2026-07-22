export interface SupportMessage {
    id: number;
    sender_type: "customer" | "agent" | "system";
    sender_name: string;
    message: string;
    created_at: string;
}
export interface SupportThread {
    ticket_id: string;
    status: string;
    live_handoff: boolean;
    messages: SupportMessage[];
}
export interface EscalateResult {
    ticket_id: string;
    status: string;
    live_handoff: boolean;
    created: boolean;
}
/**
 * Open (or reuse) a live human-handoff ticket from the customer chat.
 *
 * Pass `session_id` (the current Sprout chat) so the FOS agent can read what the
 * customer already told the AI. The server verifies the session belongs to the
 * caller and falls back to their most recent one if it is omitted.
 */
export declare function escalateToHuman(data?: {
    message?: string;
    related_order?: string;
    session_id?: string;
}): Promise<EscalateResult>;
/** The customer's current live handoff (to resume on reload), or null. */
export declare function getActiveHandoff(): Promise<{
    active: {
        ticket_id: string;
        status: string;
    } | null;
}>;
/** Read the customer's own ticket thread. */
export declare function getMyMessages(ticketId: string): Promise<SupportThread>;
/** Customer adds a message to their own ticket. */
export declare function sendMyMessage(ticketId: string, message: string): Promise<SupportMessage>;
//# sourceMappingURL=support.d.ts.map