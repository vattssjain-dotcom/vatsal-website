// Cloudflare Pages Function: /api/live/event
// Logs real-time funnel actions (e.g. "Opened Checkout Modal", "Paid ₹999", "Booked Call")

import { recordEvent, updateSession } from "./_store.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const data = await request.json().catch(() => ({}));
    const cf = request.cf || {};

    const city = cf.city || data.city || "Unknown City";
    const country = cf.country || data.country || "IN";

    await recordEvent(
      {
        sessionId: data.sessionId || "",
        type: data.type || "FUNNEL_ACTION",
        action: data.action || data.eventName || "User Interaction",
        currentUrl: data.currentUrl || "/",
        details: data.details || "",
        city,
        country,
        amount: data.amount || null,
        product: data.product || null,
      },
      env
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to record live event" }), {
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
