export interface VisionLabel {
    id: number;
    code: string;
    name: string;
    group: string;
    color: string;
    sort_order: number;
}
export declare function getVisionLabels(): Promise<VisionLabel[]>;
/** One bounding box, normalized to the image (x,y = top-left, all 0..1). */
export interface VisionBox {
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
export type VisionTaskStatus = "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED";
export interface VisionTaskSummary {
    id: number;
    title: string;
    status: VisionTaskStatus;
    frame_count: number;
    done_count: number;
    assignee_name: string | null;
    created_at: string;
    submitted_at: string | null;
    review_note: string;
}
export interface VisionTaskFrame {
    id: number;
    frame_id: number;
    image_url: string;
    width: number;
    height: number;
    captured_at: string;
    camera_code: string;
    sort_order: number;
    boxes: VisionBox[];
    is_skipped: boolean;
    is_annotated: boolean;
}
export interface VisionTaskDetail extends VisionTaskSummary {
    instructions: string;
    labels: VisionLabel[];
    frames: VisionTaskFrame[];
}
export declare function getMyVisionTasks(): Promise<{
    tasks: VisionTaskSummary[];
    open_count: number;
}>;
/** Claim the oldest unassigned OPEN task. 404 ⇒ nothing to claim. */
export declare function claimNextVisionTask(): Promise<{
    id: number;
}>;
export declare function getVisionTask(id: number): Promise<VisionTaskDetail>;
/** Save one frame's work. Pass either boxes (possibly []) or is_skipped. */
export declare function saveVisionAnnotation(taskId: number, taskFrameId: number, payload: {
    boxes?: VisionBox[];
    is_skipped?: boolean;
    skip_reason?: string;
    time_spent_seconds?: number;
}): Promise<{
    ok: true;
    done_count: number;
}>;
/** 400 with detail when frames remain unannotated — surface it verbatim. */
export declare function submitVisionTask(taskId: number): Promise<{
    ok: true;
}>;
export interface VisionCamera {
    id: number;
    hub_code: string;
    code: string;
    name: string;
    purpose: "POS" | "SHELF" | "RECEIVING" | "DISPATCH" | "FLOOR" | "OTHER";
    is_active: boolean;
    healthy: boolean;
    last_seen_at: string | null;
}
export declare function getVisionCameras(hubCode?: string): Promise<VisionCamera[]>;
export declare function getAllVisionTasks(status?: VisionTaskStatus): Promise<VisionTaskSummary[]>;
/** Batch NEW frames into OPEN tasks of batch_size. Returns created task ids. */
export declare function buildVisionTasks(payload: {
    title: string;
    label_codes: string[];
    hub_code?: string;
    camera_id?: number;
    batch_size?: number;
    instructions?: string;
}): Promise<{
    created: number[];
}>;
export declare function reviewVisionTask(taskId: number, action: "approve" | "reject", note?: string): Promise<{
    ok: true;
    status: VisionTaskStatus;
}>;
export interface VisionStats {
    frames: Partial<Record<"NEW" | "IN_TASK" | "DONE", number>>;
    tasks: Partial<Record<VisionTaskStatus, number>>;
    annotators: Array<{
        annotated_by__username: string;
        frames: number;
        skipped: number;
    }>;
    cameras: {
        total: number;
        unhealthy: number;
    };
}
export declare function getVisionStats(): Promise<VisionStats>;
export type VisionZoneKind = "SHELF" | "POS" | "ENTRY" | "EXIT" | "STAFF" | "SCALE" | "OTHER";
export interface VisionZone {
    id: number;
    camera: number;
    camera_code: string;
    hub_code: string;
    code: string;
    name: string;
    kind: VisionZoneKind;
    polygon: Array<[number, number]>;
    product_ref: string;
    is_active: boolean;
}
export declare function getVisionZones(cameraId?: number): Promise<VisionZone[]>;
export declare function createVisionZone(payload: Omit<VisionZone, "id" | "camera_code" | "hub_code" | "is_active"> & Partial<Pick<VisionZone, "is_active">>): Promise<VisionZone>;
export declare function deleteVisionZone(id: number): Promise<void>;
/** Latest sampled frame for a camera — the canvas for drawing zones. */
export declare function getCameraLatestFrame(cameraId: number): Promise<{
    frame_id: number;
    image_url: string;
    width: number;
    height: number;
    captured_at: string;
}>;
export type VisionEventType = "zone_touch" | "zone_enter" | "zone_exit" | "person_enter" | "person_exit" | "idle_start" | "idle_end" | "queue_len" | "custom";
export interface VisionLiveEvent {
    id: number;
    camera_code: string;
    event_type: VisionEventType;
    track_id: number | null;
    zone_code: string | null;
    person_kind: "UNKNOWN" | "CUSTOMER" | "STAFF";
    started_at: string;
    ended_at: string | null;
    duration_seconds: number;
    confidence: number;
    payload: Record<string, unknown>;
    clip_request_id: number | null;
    created_at: string;
}
export declare function getVisionEvents(params?: {
    type?: VisionEventType;
    camera_id?: number;
    since?: string;
}): Promise<VisionLiveEvent[]>;
/** What customers touch, per zone — marketing/upsell + theft triage feed. */
export declare function getTouchInsights(days?: number): Promise<{
    days: number;
    zones: Array<{
        zone_id: number;
        zone__code: string;
        zone__name: string;
        zone__kind: VisionZoneKind;
        zone__product_ref: string;
        camera__code: string;
        touches: number;
        unique_tracks: number;
        avg_dwell: number;
        total_dwell: number;
    }>;
}>;
/** Stationary-person episodes in STAFF zones. person_kind=UNKNOWN until the
 * staff classifier ships — a proxy report, not a per-employee verdict. */
export declare function getIdleInsights(days?: number): Promise<{
    days: number;
    note: string;
    rows: Array<{
        camera__code: string;
        zone__code: string | null;
        person_kind: string;
        episodes: number;
        idle_minutes: number;
        avg_minutes: number;
    }>;
}>;
export declare function getTrafficInsights(days?: number): Promise<{
    days: number;
    rows: Array<{
        camera__code: string;
        event_type: "person_enter" | "person_exit";
        "started_at__date": string;
        n: number;
    }>;
}>;
export interface VisionClipRequest {
    id: number;
    camera_code: string;
    hub_code: string;
    start_at: string;
    end_at: string;
    reason: string;
    ref_type: string;
    ref_id: string;
    status: "PENDING" | "FULFILLED" | "FAILED";
    video_url: string | null;
    created_at: string;
    fulfilled_at: string | null;
}
/** Ask the hub for footage around a moment (e.g. a disputed bill). */
export declare function requestVisionClip(payload: {
    hub_code: string;
    camera_code: string;
    at: string;
    before_seconds?: number;
    after_seconds?: number;
    reason?: string;
    ref_type?: string;
    ref_id?: string;
}): Promise<VisionClipRequest>;
export declare function getVisionClipRequests(params?: {
    ref_type?: string;
    ref_id?: string;
    status?: VisionClipRequest["status"];
}): Promise<{
    results: VisionClipRequest[];
}>;
//# sourceMappingURL=vision.d.ts.map