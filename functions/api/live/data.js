// Cloudflare Pages Function: /api/live/data
// Returns live visitor sessions and event ticker (Password Protected)

import { getLiveState } from "./_store.js";

const DEFAULT_ADMIN_PASSWORD = "arqo2026";

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-password",
  };

  try {
    const expectedPassword = env.LIVE_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    // Check authorization: Bearer token, custom header, or query param
    const authHeader = request.headers.get("Authorization") || "";
    const customHeader = request.headers.get("x-admin-password") || "";
    const url = new URL(request.url);
    const queryKey = url.searchParams.get("key") || "";

    let providedKey = "";
    if (authHeader.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7).trim();
    } else if (customHeader) {
      providedKey = customHeader.trim();
    } else if (queryKey) {
      providedKey = queryKey.trim();
    }

    if (providedKey !== expectedPassword) {
      return new Response(JSON.stringify({ error: "Unauthorized. Incorrect password." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = await getLiveState(env);

    return new Response(JSON.stringify({ success: true, ...state }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to fetch live data" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-password",
    },
  });
}
