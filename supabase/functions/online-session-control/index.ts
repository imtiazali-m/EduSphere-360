import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.19.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const cleanText = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const normaliseLiveKitUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.startsWith("https://")) return "wss://" + trimmed.slice(8);
  if (trimmed.startsWith("http://")) return "ws://" + trimmed.slice(7);
  return trimmed;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sign in to use EduSphere calling and online classes." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "Institution authentication is not configured." }, 503);

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + token } },
    });
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);

    const body = await req.json();
    const institutionId = cleanText(body?.institutionId, 64);
    if (!/^[0-9a-f-]{36}$/i.test(institutionId)) return json({ error: "Select a valid institution." }, 400);

    const { data: hasAccess, error: roleError } = await client.rpc("has_institution_role", {
      target_institution: institutionId,
      allowed_roles: ["owner", "admin", "teacher", "student", "exam_officer"],
    });
    if (roleError || hasAccess !== true) return json({ error: "Your role cannot access this calling workspace." }, 403);

    const action = cleanText(body?.action, 30);
    if (action === "status") {
      const configured = Boolean(
        Deno.env.get("LIVEKIT_URL")?.trim() &&
        Deno.env.get("LIVEKIT_API_KEY")?.trim() &&
        Deno.env.get("LIVEKIT_API_SECRET")?.trim()
      );
      return json({
        mediaServer: {
          configured,
          hosting: "self-hosted",
          provider: "EduSphere WebRTC",
          status: configured ? "credentials_configured" : "awaiting_self_hosted_server",
        },
      });
    }

    if (action === "contacts") {
      const { data, error } = await client.rpc("list_online_session_contacts", {
        p_institution_id: institutionId,
      });
      if (error) throw error;
      return json({ contacts: data ?? [] });
    }

    if (action === "list") {
      const { data, error } = await client
        .from("online_sessions")
        .select("id,institution_id,session_type,title,class_id,subject_id,academic_session_id,created_by,media_mode,starts_at,ends_at,status,recording_enabled,created_at,online_session_participants(user_id,participant_role,status,joined_at,left_at,attendance_minutes)")
        .eq("institution_id", institutionId)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ sessions: data ?? [] });
    }

    if (action === "create") {
      const sessionType = cleanText(body?.sessionType, 24);
      const mediaMode = body?.mediaMode === "audio" ? "audio" : "video";
      const title = cleanText(body?.title, 180);
      if (!title || title.length < 2) return json({ error: "Enter a session title." }, 400);
      const recipients = Array.isArray(body?.targetUserIds)
        ? [...new Set(body.targetUserIds.map((value: unknown) => cleanText(value, 64)).filter((value: string) => /^[0-9a-f-]{36}$/i.test(value)))].slice(0, 10)
        : [];
      const startsAt = body?.startsAt ? new Date(String(body.startsAt)).toISOString() : new Date().toISOString();
      const { data: sessionId, error } = await client.rpc("create_online_session", {
        p_institution_id: institutionId,
        p_session_type: sessionType,
        p_title: title,
        p_class_id: body?.classId || null,
        p_subject_id: body?.subjectId || null,
        p_academic_session_id: body?.academicSessionId || null,
        p_starts_at: startsAt,
        p_media_mode: mediaMode,
        p_target_user_ids: recipients,
      });
      if (error) throw error;
      const { data: session, error: readError } = await client
        .from("online_sessions")
        .select("id,session_type,title,class_id,subject_id,media_mode,starts_at,status,created_by")
        .eq("id", sessionId)
        .single();
      if (readError) throw readError;
      return json({ session });
    }

    if (action === "join") {
      const liveKitUrl = Deno.env.get("LIVEKIT_URL")?.trim();
      const apiKey = Deno.env.get("LIVEKIT_API_KEY")?.trim();
      const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")?.trim();
      if (!liveKitUrl || !apiKey || !apiSecret) {
        return json({ error: "EduSphere's self-hosted media server is not configured yet. The class or call can be scheduled, but live audio/video is not available." }, 503);
      }
      const sessionId = cleanText(body?.sessionId, 64);
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ error: "Select a valid class or call." }, 400);

      const { data: joined, error } = await client.rpc("join_online_session", { p_session_id: sessionId });
      if (error) throw error;
      const session = Array.isArray(joined) ? joined[0] : joined;
      if (!session?.room_name) throw new Error("The session did not return a secure room identity.");

      const profile = await client.from("profiles").select("full_name").eq("id", authData.user.id).maybeSingle();
      const participantName = cleanText(profile.data?.full_name || authData.user.user_metadata?.full_name || authData.user.email || "EduSphere member", 100);
      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity: authData.user.id,
        name: participantName,
        ttl: "10m",
        metadata: JSON.stringify({
          institutionId,
          sessionId,
          role: cleanText(session.participant_role, 24),
        }),
      });
      accessToken.addGrant({
        roomJoin: true,
        room: session.room_name,
        canPublish: true,
        canSubscribe: true,
      });
      const jwt = await accessToken.toJwt();
      return json({
        session: {
          id: session.id,
          title: session.title,
          sessionType: session.session_type,
          mediaMode: session.media_mode,
          startsAt: session.starts_at,
          participantRole: session.participant_role,
        },
        serverUrl: normaliseLiveKitUrl(liveKitUrl),
        token: jwt,
        tokenExpiresInSeconds: 600,
      });
    }

    if (action === "leave") {
      const sessionId = cleanText(body?.sessionId, 64);
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ error: "Select a valid session." }, 400);
      const { error } = await client.rpc("leave_online_session", { p_session_id: sessionId });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "end") {
      const sessionId = cleanText(body?.sessionId, 64);
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ error: "Select a valid session." }, 400);
      const { error } = await client.rpc("end_online_session", { p_session_id: sessionId });
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unsupported calling action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The calling request could not be completed.";
    return json({ error: message }, 400);
  }
});
