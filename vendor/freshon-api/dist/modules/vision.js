// packages/freshon-api/src/modules/vision.ts
// CCTV vision pipeline + data annotation (apps/vision). Two user surfaces:
// annotators (Flabel app: claim → draw boxes → submit) and vision admins
// (build task batches from ingested frames, review/approve, stats, clips).
// The edge-device ingest endpoints are NOT here — they use a device key,
// not user auth (see edge/vision/capture.py).
import { getClient } from "../client";
export async function getVisionLabels() {
    const res = await getClient().get("/api/vision/labels/");
    return res.data;
}
export async function getMyVisionTasks() {
    const res = await getClient().get("/api/vision/tasks/mine/");
    return res.data;
}
/** Claim the oldest unassigned OPEN task. 404 ⇒ nothing to claim. */
export async function claimNextVisionTask() {
    const res = await getClient().post("/api/vision/tasks/claim/");
    return res.data;
}
export async function getVisionTask(id) {
    const res = await getClient().get(`/api/vision/tasks/${id}/`);
    return res.data;
}
/** Save one frame's work. Pass either boxes (possibly []) or is_skipped. */
export async function saveVisionAnnotation(taskId, taskFrameId, payload) {
    const res = await getClient().put(`/api/vision/tasks/${taskId}/frames/${taskFrameId}/`, payload);
    return res.data;
}
/** 400 with detail when frames remain unannotated — surface it verbatim. */
export async function submitVisionTask(taskId) {
    const res = await getClient().post(`/api/vision/tasks/${taskId}/submit/`);
    return res.data;
}
export async function getVisionCameras(hubCode) {
    const res = await getClient().get("/api/vision/cameras/", {
        params: hubCode ? { hub_code: hubCode } : undefined,
    });
    return res.data;
}
export async function getAllVisionTasks(status) {
    const res = await getClient().get("/api/vision/tasks/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/** Batch NEW frames into OPEN tasks of batch_size. Returns created task ids. */
export async function buildVisionTasks(payload) {
    const res = await getClient().post("/api/vision/tasks/build/", payload);
    return res.data;
}
export async function reviewVisionTask(taskId, action, note) {
    const res = await getClient().post(`/api/vision/tasks/${taskId}/review/`, {
        action,
        note: note ?? "",
    });
    return res.data;
}
export async function getVisionStats() {
    const res = await getClient().get("/api/vision/stats/");
    return res.data;
}
export async function getVisionZones(cameraId) {
    const res = await getClient().get("/api/vision/zones/", {
        params: cameraId ? { camera_id: cameraId } : undefined,
    });
    return res.data;
}
export async function createVisionZone(payload) {
    const res = await getClient().post("/api/vision/zones/", payload);
    return res.data;
}
export async function deleteVisionZone(id) {
    await getClient().delete(`/api/vision/zones/${id}/`);
}
/** Latest sampled frame for a camera — the canvas for drawing zones. */
export async function getCameraLatestFrame(cameraId) {
    const res = await getClient().get(`/api/vision/cameras/${cameraId}/latest-frame/`);
    return res.data;
}
export async function getVisionEvents(params) {
    const res = await getClient().get("/api/vision/events/", { params });
    return res.data;
}
/** What customers touch, per zone — marketing/upsell + theft triage feed. */
export async function getTouchInsights(days = 7) {
    const res = await getClient().get("/api/vision/insights/touches/", { params: { days } });
    return res.data;
}
/** Stationary-person episodes in STAFF zones. person_kind=UNKNOWN until the
 * staff classifier ships — a proxy report, not a per-employee verdict. */
export async function getIdleInsights(days = 7) {
    const res = await getClient().get("/api/vision/insights/idle/", { params: { days } });
    return res.data;
}
export async function getTrafficInsights(days = 7) {
    const res = await getClient().get("/api/vision/insights/traffic/", { params: { days } });
    return res.data;
}
/** Ask the hub for footage around a moment (e.g. a disputed bill). */
export async function requestVisionClip(payload) {
    const res = await getClient().post("/api/vision/clip-requests/", payload);
    return res.data;
}
export async function getVisionClipRequests(params) {
    const res = await getClient().get("/api/vision/clip-requests/", { params });
    return res.data;
}
//# sourceMappingURL=vision.js.map