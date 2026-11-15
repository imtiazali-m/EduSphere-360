import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const allowedProviders = new Set(["biometric", "rfid", "qr", "third_party"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return String(keys.default || "");
  } catch {
    return "";
  }
}
function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function deviceSecretName(sourceId: string) {
  return "ed360_attendance_device_" + sourceId.replaceAll("-", "").toLowerCase();
}
function database() {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) throw new Error("The secure database connection is not configured for this function.");
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let sql: ReturnType<typeof postgres> | null = null;
  let createdSourceId: string | null = null;
  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sign in before managing attendance devices." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const key = publicKey();
    if (!url || !key) return json({ error: "Institution authentication is not configured." }, 503);

    const userClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + token } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const institutionId = String(body?.institutionId || "");
    const action = String(body?.action || "");
    if (!uuidPattern.test(institutionId)) return json({ error: "A valid institution is required." }, 400);

    const { data: permitted, error: roleError } = await userClient.rpc("has_institution_role", {
      target_institution: institutionId,
      allowed_roles: ["owner", "admin"],
    });
    if (roleError || permitted !== true) return json({ error: "Only institution owners and administrators can manage device connections." }, 403);

    if (action === "create") {
      const name = String(body?.name || "").trim();
      const providerType = String(body?.providerType || "");
      const externalDeviceId = String(body?.externalDeviceId || "").trim();
      if (!name || name.length > 120) return json({ error: "Enter a device name up to 120 characters." }, 400);
      if (!allowedProviders.has(providerType)) return json({ error: "Choose a supported QR, RFID, biometric or third-party device source." }, 400);
      if (externalDeviceId.length > 160) return json({ error: "The external device ID is too long." }, 400);

      const { data: source, error: insertError } = await userClient
        .from("attendance_device_sources")
        .insert({
          institution_id: institutionId,
          name,
          provider_type: providerType,
          status: "not_configured",
          external_device_id: externalDeviceId || null,
          created_by: authData.user.id,
          public_settings: { protocol: "ed360-hmac-v1" },
        })
        .select("id,institution_id,name,provider_type,status,external_device_id,public_settings,created_at")
        .single();
      if (insertError || !source) throw new Error(insertError?.message || "The device source could not be created.");
      createdSourceId = String(source.id);

      const secret = randomSecret();
      sql = database();
      const secretName = deviceSecretName(createdSourceId);
      const savedSecret = await sql`
        select vault.create_secret(
          ${secret},
          ${secretName},
          ${"EduSphere attendance signing key for device source " + createdSourceId},
          null
        ) as id
      `;
      if (!savedSecret?.[0]?.id) throw new Error("The device signing key could not be stored in the secure vault.");

      const { data: activeSource, error: updateError } = await userClient
        .from("attendance_device_sources")
        .update({ status: "active", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", createdSourceId)
        .eq("institution_id", institutionId)
        .select("id,institution_id,name,provider_type,status,external_device_id,public_settings,created_at")
        .single();
      if (updateError || !activeSource) throw new Error(updateError?.message || "The device was created but could not be activated.");

      return json({
        source: activeSource,
        secret,
        endpoint: url.replace(/\/$/, "") + "/functions/v1/attendance-device-webhook",
        signatureFormat: "HMAC-SHA256",
        timestampToleranceSeconds: 300,
        secretShownOnce: true,
      });
    }

    const sourceId = String(body?.sourceId || "");
    if (!uuidPattern.test(sourceId)) return json({ error: "A valid device source is required." }, 400);
    const { data: source, error: sourceError } = await userClient
      .from("attendance_device_sources")
      .select("id,institution_id,name,provider_type,status,external_device_id")
      .eq("id", sourceId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (sourceError || !source) return json({ error: "The device source was not found in this institution." }, 404);

    if (action === "rotate") {
      const secret = randomSecret();
      sql = database();
      const secretName = deviceSecretName(sourceId);
      const existing = await sql`select id from vault.decrypted_secrets where name = ${secretName} limit 1`;
      if (existing.length) {
        await sql`
          select vault.update_secret(
            ${existing[0].id}::uuid,
            ${secret},
            ${secretName},
            ${"Rotated EduSphere attendance signing key for device source " + sourceId},
            null
          )
        `;
      } else {
        await sql`
          select vault.create_secret(
            ${secret},
            ${secretName},
            ${"EduSphere attendance signing key for device source " + sourceId},
            null
          )
        `;
      }
      const { error: updateError } = await userClient
        .from("attendance_device_sources")
        .update({ status: "active", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", sourceId)
        .eq("institution_id", institutionId);
      if (updateError) throw new Error(updateError.message);
      return json({
        sourceId,
        secret,
        endpoint: url.replace(/\/$/, "") + "/functions/v1/attendance-device-webhook",
        signatureFormat: "HMAC-SHA256",
        timestampToleranceSeconds: 300,
        secretShownOnce: true,
      });
    }

    if (action === "pause" || action === "activate") {
      if (action === "activate") {
        sql = database();
        const exists = await sql`select id from vault.decrypted_secrets where name = ${deviceSecretName(sourceId)} limit 1`;
        if (!exists.length) return json({ error: "This device has no signing key. Rotate its key before activating it." }, 409);
      }
      const nextStatus = action === "pause" ? "paused" : "active";
      const { error: updateError } = await userClient
        .from("attendance_device_sources")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", sourceId)
        .eq("institution_id", institutionId);
      if (updateError) throw new Error(updateError.message);
      return json({ sourceId, status: nextStatus });
    }

    return json({ error: "Unsupported device administration action." }, 400);
  } catch (error) {
    if (createdSourceId) {
      try {
        const url = Deno.env.get("SUPABASE_URL") || "";
        const key = publicKey();
        const token = (req.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "").trim();
        if (url && key && token) {
          const rollbackClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
          await rollbackClient.from("attendance_device_sources").delete().eq("id", createdSourceId);
        }
      } catch {
        // Do not expose rollback details; the original failure is returned below.
      }
    }
    const message = error instanceof Error ? error.message : "The device operation could not be completed.";
    return json({ error: message }, 500);
  } finally {
    if (sql) {
      try { await sql.end({ timeout: 5 }); } catch { /* Connection cleanup only. */ }
    }
  }
});
