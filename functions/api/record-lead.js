// Cloudflare Pages Function: /api/record-lead
// Captures all stages of customer journey: Form Started, Order Initiated, Checkout Dismissed, Payment Failed, Paid

import { recordEvent } from "./live/_store.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const data = await request.json();

    // Log to real-time live events store
    try {
      await recordEvent(
        {
          action: data.status || "Lead Action",
          type: "LEAD",
          currentUrl: data.source || "/",
          product: data.product || null,
          amount: data.amount || null,
          details: data.email || data.phone ? `${data.email || ""} ${data.phone || ""}`.trim() : "",
        },
        env
      );
    } catch (e) {}
    const webhookUrl = env.LEAD_WEBHOOK_URL || "";

    if (webhookUrl) {
      const payload = {
        timestamp: new Date().toISOString(),
        status: data.status || "Initiated",
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        amount: data.amount || "₹999",
        order_id: data.order_id || "",
        payment_id: data.payment_id || "",
        notes: data.notes || data.reason || "",
        source: data.source || "vatsal.arqostudio.com/vault",
      };

      if (context.waitUntil) {
        context.waitUntil(
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {})
        );
      } else {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to record lead" }), {
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
