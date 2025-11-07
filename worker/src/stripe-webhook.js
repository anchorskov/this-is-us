// worker/src/stripe-webhook.js
// Purpose: Verify Stripe signature and handle ACH finalization events.

const enc = new TextEncoder();

// HMAC-SHA256 over `${timestamp}.${payload}`
async function computeHmac(secret, signedPayload) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const bytes = Array.from(new Uint8Array(sigBuf));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

function parseStripeSig(header) {
  // format: t=timestamp,v1=signature,...
  const out = {};
  header.split(",").forEach(part => {
    const [k, v] = part.split("=");
    out[k.trim()] = v;
  });
  return { t: out.t, v1: out.v1 };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export default async function handleStripeWebhook(request, env) {
  const sigHeader = request.headers.get("stripe-signature");
  if (!sigHeader) return new Response("Missing signature", { status: 400 });

  const payload = await request.text(); // raw body required for signature check
  const { t, v1 } = parseStripeSig(sigHeader || "");
  if (!t || !v1) return new Response("Bad signature header", { status: 400 });

  const signedPayload = `${t}.${payload}`;
  const expected = await computeHmac(env.STRIPE_WEBHOOK_SECRET, signedPayload);
  if (!safeEqual(expected, v1)) return new Response("Signature verification failed", { status: 400 });

  // Signature verified. Process the event.
  const event = JSON.parse(payload);

  // Minimal examples that matter for ACH:
  // - checkout.session.completed fires when the donation flow finishes, but ACH may still be pending.
  // - payment_intent.processing indicates ACH is pending.
  // - payment_intent.succeeded means funds cleared.
  // - payment_intent.payment_failed means it failed or was returned.
  switch (event.type) {
    case "checkout.session.completed":
      // Mark donation as created/pending in logs or DB
      console.log("checkout.session.completed", event.data.object.id);
      break;

    case "payment_intent.processing":
      console.log("payment_intent.processing", event.data.object.id);
      break;

    case "payment_intent.succeeded": {
      const pi = event.data.object;
      console.log("CLEARED donation", pi.id, pi.amount_received, pi.currency);
      // Optional: write to D1 or Firestore here
      break;
    }

    case "payment_intent.payment_failed":
      console.log("FAILED donation", event.data.object.id);
      break;

    default:
      console.log("Unhandled event", event.type);
  }

  return new Response("OK", { status: 200 });
}
