import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";
import { verifyDeviceSignature } from "../_shared/device-signature.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-edusphere-device-id, x-edusphere-timestamp, x-edusphere-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const forbiddenSensitiveKeys = /(fingerprint|faceprint|biometric_template|template_data|raw_image|biometric_blob|password|credential)/i;

function database() {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) throw new Error("Secure event verification is not configured.");
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 });
}
function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("The attendance event processor is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let sql: ReturnType<typeof postgres> | null = null;
  try {
    const deviceId = req.headers.get("x-edusphere-device-id") || "";
    const timestampText = req.headers.get("x-edusphere-timestamp") || "";
    const signature = req.headers.get("x-edusphere-signature") || "";
    if (!uuidPattern.test(deviceId)) return json({ error: "A valid device source ID is required." }, 400);
    if (!/^\d{10}$/.test(timestampText)) return json({ error: "A Unix timestamp header is required." }, 400);
    const timestamp = Number(timestampText);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      return json({ error: "The device request timestamp is outside the five-minute acceptance window." }, 401);
    }

    const rawBody = await req.text();
    if (!rawBody || rawBody.length > 20000) return json({ error: "The event body is empty or exceeds 20 KB." }, 413);
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return json({ error: "The signed event body must be valid JSON." }, 400);
    }
    if (Object.keys(event).some((key) => forbiddenSensitiveKeys.test(key))) {
      return json({ error: "Raw biometric templates, images, passwords and credentials must never be sent to EduSphere." }, 422);
    }

    const db = serviceClient();
    const { data: source, error: sourceError } = await db
      .from("attendance_device_sources")
      .select("id,institution_id,name,provider_type,status,external_device_id")
      .eq("id", deviceId)
      .maybeSingle();
    if (sourceError || !source) return json({ error: "The device source is not registered." }, 404);
    if (source.status !== "active") return json({ error: "This device source is paused or not active." }, 403);

    sql = database();
    const secretName = "ed360_attendance_device_" + deviceId.replaceAll("-", "").toLowerCase();
    const secretRows = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${secretName} limit 1`;
    const secret = String(secretRows?.[0]?.decrypted_secret || "");
    if (!secret) return json({ error: "The device signing key is unavailable. Rotate it in Attendance > Device connections." }, 503);
    const validSignature = await verifyDeviceSignature(secret, timestamp, rawBody, signature);
    if (!validSignature) return json({ error: "Device signature verification failed." }, 401);

    const externalEventId = String(event.external_event_id || "").trim();
    const personType = String(event.person_type || "");
    const personId = String(event.person_id || "");
    const occurredAt = String(event.occurred_at || "");
    const eventKind = String(event.event_kind || "");
    const matchResult = event.match_result;
    const verificationMethod = String(event.verification_method || source.provider_type);
    if (!externalEventId || externalEventId.length > 160) return json({ error: "A valid external_event_id is required." }, 400);
    if (!["student", "teacher"].includes(personType) || !uuidPattern.test(personId)) return json({ error: "A verified student_id or teacher_id is required." }, 400);
    if (!["check_in", "check_out"].includes(eventKind)) return json({ error: "event_kind must be check_in or check_out." }, 400);
    if (matchResult !== true) return json({ error: "Only successful device identity matches can be queued." }, 422);
    if (!["biometric", "rfid", "qr", "third_party", "fingerprint", "face", "card"].includes(verificationMethod)) {
      return json({ error: "Unsupported verification method." }, 400);
    }
    const occurredAtMs = Date.parse(occurredAt);
    if (!Number.isFinite(occurredAtMs) || occurredAtMs > Date.now() + 5 * 60 * 1000 || occurredAtMs < Date.now() - 90 * 24 * 60 * 60 * 1000) {
      return json({ error: "occurred_at must be a valid event time within the last 90 days." }, 400);
    }
    if (event.external_device_id && source.external_device_id && String(event.external_device_id) !== String(source.external_device_id)) {
      return json({ error: "The event device ID does not match the registered device." }, 403);
    }

    const safePayload = {
      device_source: source.name,
      verification_method: verificationMethod,
      match_result: true,
      event_kind: eventKind,
    };
    const eventRow = {
      institution_id: source.institution_id,
      source_id: source.id,
      external_event_id: externalEventId,
      student_id: personType === "student" ? personId : null,
      teacher_id: personType === "teacher" ? personId : null,
      occurred_at: new Date(occurredAtMs).toISOString(),
      event_kind: eventKind,
      processing_status: "received",
      raw_payload: safePayload,
    };
    const { data: inserted, error: insertError } = await db
      .from("attendance_device_events")
      .insert(eventRow)
      .select("id")
      .single();
    if (insertError?.code === "23505") {
      return json({ accepted: true, duplicate: true, processing_status: "duplicate", message: "This external event was already received." }, 200);
    }
    if (insertError) {
      // FK and RLS constraints validate that the identity belongs to this institution.
      return json({ error: "The event could not be queued. Verify the mapped student/employee identity." }, 422);
    }

    await db.from("attendance_device_sources")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", source.id)
      .eq("institution_id", source.institution_id);

    return json({
      accepted: true,
      duplicate: false,
      event_id: inserted.id,
      processing_status: "received",
      message: "Signed attendance event received. It is queued for authorised review; no attendance record is changed automatically.",
    }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The signed attendance event could not be processed.";
    return json({ error: message }, 500);
  } finally {
    if (sql) {
      try { await sql.end({ timeout: 5 }); } catch { /* Connection cleanup only. */ }
    }
  }
});
