import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (
    supabaseUrl === undefined ||
    supabaseAnonKey === undefined ||
    serviceRoleKey === undefined
  ) {
    return jsonResponse({ error: "missing_configuration" }, 500);
  }

  if (authorization === null) {
    return jsonResponse({ error: "not_authenticated" }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } }
  });

  const { data: userId, error: cascadeError } = await userClient.rpc(
    "delete_family_cascade"
  );

  if (cascadeError !== null || typeof userId !== "string") {
    return jsonResponse({ error: "delete_family_failed" }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteUserError !== null) {
    return jsonResponse({ error: "delete_user_failed" }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
