// Cloudflare Pages Function: /api/capi
// Meta Conversions API (CAPI) & Dataset Quality integration (v22.0)
// High Match Quality (EMQ): Hashes user_data (SHA-256), extracts CF-Connecting-IP,
// User-Agent, _fbp, _fbc, and deduplicates with browser Pixel via event_id.

const DEFAULT_PIXEL_ID = "940315292130796";
const DEFAULT_ACCESS_TOKEN =
  "EAA9fPMYjrtEBS71pF0uXpZCMqMht0VQNVN1RdGThtQEyZAoeGz4WuIZC8yxrHtOIKyJ9L909t712mpRKw8wUUgqSRo2NFsSnZC1fCM1ZAZBfAZAw6ivyEOmnwRZCZAaoJCknf78V4WVBOXs3adRUbHWdMe7Mg9gtFnrZA9ZBnkdjSsFMmTJAWCEZA7OZAN28QJZAAjfgMI9gZDZD";

async function sha256(str) {
  if (!str) return null;
  const clean = String(str).trim().toLowerCase();
  if (!clean) return null;
  const buffer = new TextEncoder().encode(clean);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(rawPhone) {
  if (!rawPhone) return "";
  let digits = String(rawPhone).replace(/\D/g, "");
  if (!digits) return "";
  // Strip leading zero
  if (digits.startsWith("0")) digits = digits.substring(1);
  // Default to India country code 91 if 10-digit number
  if (digits.length === 10) {
    digits = "91" + digits;
  }
  return digits;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((pair) => {
    const parts = pair.split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  });
  return cookies;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json().catch(() => ({}));
    const pixelId = env.META_PIXEL_ID || DEFAULT_PIXEL_ID;
    const accessToken = env.META_CAPI_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN;

    const eventName = body.event_name || body.eventName || "PageView";
    const eventId = body.event_id || body.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const eventSourceUrl = body.event_source_url || body.eventSourceUrl || request.headers.get("referer") || "https://vatsal.arqostudio.com";

    // 1. Extract client IP and User Agent from Cloudflare request headers
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      body.client_ip_address ||
      null;

    const userAgent =
      request.headers.get("user-agent") ||
      body.client_user_agent ||
      "Mozilla/5.0";

    // 2. Extract _fbp and _fbc cookies
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = parseCookies(cookieHeader);

    let fbp = cookies["_fbp"] || body.fbp || null;
    let fbc = cookies["_fbc"] || body.fbc || null;

    // Fallback: If fbc cookie is missing but fbclid was provided, construct the standard Meta fbc string
    if (!fbc && (body.fbclid || body.utm_fbclid)) {
      const fbclid = body.fbclid || body.utm_fbclid;
      fbc = `fb.1.${eventTime}.${fbclid}`;
    }

    // 3. User Data preparation & hashing for maximum Event Match Quality (EMQ)
    const rawUser = body.user_data || body.userData || {};
    const email = rawUser.email || body.email || "";
    const phone = rawUser.phone || body.phone || "";
    const fullName = rawUser.name || body.name || "";

    let firstName = rawUser.first_name || rawUser.fn || "";
    let lastName = rawUser.last_name || rawUser.ln || "";

    if (!firstName && fullName) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || "";
      if (parts.length > 1) {
        lastName = parts.slice(1).join(" ") || "";
      }
    }

    const userData = {
      client_user_agent: userAgent,
    };

    if (clientIp) userData.client_ip_address = clientIp;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    // Hash PII using SHA-256
    const hashedEmail = await sha256(email);
    if (hashedEmail) userData.em = [hashedEmail];

    const normalizedPh = normalizePhone(phone);
    const hashedPhone = await sha256(normalizedPh);
    if (hashedPhone) userData.ph = [hashedPhone];

    const hashedFn = await sha256(firstName);
    if (hashedFn) userData.fn = [hashedFn];

    const hashedLn = await sha256(lastName);
    if (hashedLn) userData.ln = [hashedLn];

    const hashedCountry = await sha256(rawUser.country || "in");
    if (hashedCountry) userData.country = [hashedCountry];

    // 4. Custom Data (value, currency, contents, order_id)
    const rawCustom = body.custom_data || body.customData || {};
    const customData = { ...rawCustom };

    if (body.value !== undefined && customData.value === undefined) {
      customData.value = Number(body.value);
    }
    if (body.currency && customData.currency === undefined) {
      customData.currency = body.currency;
    }
    if (body.content_name && customData.content_name === undefined) {
      customData.content_name = body.content_name;
    }
    if (body.order_id && customData.order_id === undefined) {
      customData.order_id = body.order_id;
    }

    // 5. Construct Meta CAPI Payload
    const singleEvent = {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: "website",
      user_data: userData,
    };

    if (Object.keys(customData).length > 0) {
      singleEvent.custom_data = customData;
    }

    const capiPayload = {
      data: [singleEvent],
    };

    // Support Meta test_event_code for Events Manager live debugging
    const testCode = body.test_event_code || env.META_TEST_EVENT_CODE;
    if (testCode) {
      capiPayload.test_event_code = testCode;
    }

    // 6. Transmit to Meta Graph API
    const metaApiUrl = `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`;
    const metaRes = await fetch(metaApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(capiPayload),
    });

    const metaJson = await metaRes.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: metaRes.ok,
        status: metaRes.status,
        event_name: eventName,
        event_id: eventId,
        events_received: metaJson.events_received || 0,
        fbtrace_id: metaJson.fbtrace_id || null,
        meta_response: metaJson,
      }),
      {
        status: metaRes.ok ? 200 : metaRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process CAPI event" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
