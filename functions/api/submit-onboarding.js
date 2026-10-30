// Cloudflare Pages Function: /api/submit-onboarding
// Captures client onboarding responses and forwards to team webhook

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const data = await request.json();
    const webhookUrl = env.LEAD_WEBHOOK_URL || "";

    const payload = {
      event: "CLIENT_ONBOARDING_SUBMITTED",
      timestamp: new Date().toISOString(),
      business_name: data.business_name || "",
      website_url: data.website_url || "",
      contact_name: data.name || "",
      contact_email: data.email || "",
      contact_phone: data.phone || "",
      product_summary: data.product_summary || "",
      target_customer: data.target_customer || "",
      competitor_links: data.competitor_links || "",
      assets_link: data.assets_link || "",
      special_instructions: data.special_instructions || "",
      order_id: data.order_id || "",
      payment_id: data.payment_id || "",
      amount: "₹3,500",
      product: "25 Custom Static Ads Package",
      source: "vatsal.arqostudio.com/vault/onboarding",
    };

    if (webhookUrl) {
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

    return new Response(JSON.stringify({ success: true, message: "Onboarding details saved successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to submit onboarding" }), {
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
