// Cloudflare Pages Function: /api/live/ping
// Receives visitor heartbeats and updates live visitor state

import { updateSession, parseDevice, parseBrowser, recordEvent } from "./_store.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const data = await request.json().catch(() => ({}));
    const sessionId = data.sessionId;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cloudflare geolocation info
    const cf = request.cf || {};
    const city = cf.city || data.city || "Unknown City";
    const region = cf.region || "";
    const country = cf.country || "IN";
    const userAgent = request.headers.get("user-agent") || "";
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "";

    const device = parseDevice(userAgent, data.screenWidth || 0);
    const browser = parseBrowser(userAgent);

    const sessionPayload = {
      sessionId,
      visitorId: data.visitorId || sessionId,
      city,
      region,
      country,
      ip: ip ? ip.substring(0, ip.lastIndexOf(".") + 1) + "xxx" : "Unknown", // Privacy masked IP
      userAgent,
      device,
      browser,
      landingUrl: data.landingUrl || data.currentUrl || "/",
      currentUrl: data.currentUrl || "/",
      referrer: data.referrer || "Direct",
      utmSource: data.utmSource || data.utm_source || "",
      utmMedium: data.utmMedium || data.utm_medium || "",
      utmCampaign: data.utmCampaign || data.utm_campaign || "",
      utmContent: data.utmContent || data.utm_content || "",
      utmTerm: data.utmTerm || data.utm_term || "",
      isFirstPing: !!data.isFirstPing,
    };

    await updateSession(sessionPayload, env);

    // If first ping on a page, record a "Visited Page" event
    if (data.isFirstPing) {
      await recordEvent(
        {
          sessionId,
          type: "PAGEVIEW",
          action: `Landed on ${data.currentUrl || "/"}`,
          currentUrl: data.currentUrl || "/",
          city,
          country,
          device,
          source: data.utmSource ? `Ad / Campaign: ${data.utmSource}` : data.referrer ? `Referrer: ${data.referrer}` : "Direct Visit",
        },
        env
      );
    }

    return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to process ping" }), {
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
