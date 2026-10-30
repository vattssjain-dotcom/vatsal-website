// Cloudflare Pages Function: /api/create-order
// Creates a server-side order with Razorpay and captures buyer lead info

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const { name, email, phone, product } = body;

    const keyId = env.RAZORPAY_KEY_ID || "rzp_live_TtfTXCvpVj11jF";
    const keySecret = env.RAZORPAY_KEY_SECRET || "3ajAWLff4xw5OkW11cxtw5Yj";

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine product and amount
    let orderAmount = 99900; // default 999 INR in paise
    let orderProduct = "The Static Ad Vault";

    if (
      body.amount === 3500 ||
      body.amount === 350000 ||
      product === "custom-ads" ||
      product === "25 Custom Static Ads" ||
      product === "25 Custom Static Ads Package"
    ) {
      orderAmount = 350000; // 3,500 INR in paise
      orderProduct = "25 Custom Static Ads Package";
    }

    // Check for test coupon or test mode (₹1 verification)
    const coupon = (body.coupon || "").trim().toUpperCase();
    const isTestMode =
      coupon === "TEST1" ||
      coupon === "ARQO1" ||
      body.isTest === true ||
      body.amount === 1 ||
      body.amount === 100;

    if (isTestMode) {
      orderAmount = 100; // 1 INR in paise (minimum allowed on Razorpay)
      orderProduct = `[TEST ₹1] ${orderProduct}`;
    }

    // 1. Create Order on Razorpay
    const auth = btoa(`${keyId}:${keySecret}`);
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: orderAmount,
        currency: "INR",
        receipt: receiptId,
        notes: {
          name: name || "",
          email: email || "",
          phone: phone || "",
          product: orderProduct,
          coupon: isTestMode ? (coupon || "TEST1") : "NONE",
          is_test: isTestMode ? "true" : "false",
          source: body.source || "vatsal.arqostudio.com/vault",
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text();
      return new Response(JSON.stringify({ error: "Failed to create order on Razorpay", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderData = await rzpResponse.json();

    // 2. Optional: Forward lead to external Google Sheets Webhook if provided
    const webhookUrl = env.LEAD_WEBHOOK_URL || "";
    if (webhookUrl && context.waitUntil) {
      context.waitUntil(
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            name: name || "",
            email: email || "",
            phone: phone || "",
            product: orderProduct,
            price: isTestMode ? "₹1 (Test Verification)" : (orderAmount === 350000 ? "₹3,500" : "₹999"),
            order_id: orderData.id,
            source: body.source || "vatsal.arqostudio.com/vault",
          }),
        }).catch(() => {})
      );
    }

    // 3. Return order details to client
    return new Response(
      JSON.stringify({
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId: keyId,
        isTest: isTestMode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
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
