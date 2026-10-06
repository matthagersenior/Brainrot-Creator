const OFFERS = Object.freeze({
  creator_monthly: { mode: 'subscription', name: 'Brain Rot Creator — Creator', amount: 599, recurring: 'month' },
  pack_5: { mode: 'payment', name: 'Brain Rot Creator — 5 extra creations', amount: 199, credits: 5 },
  pack_15: { mode: 'payment', name: 'Brain Rot Creator — 15 extra creations', amount: 499, credits: 15 },
  pack_40: { mode: 'payment', name: 'Brain Rot Creator — 40 extra creations', amount: 999, credits: 40 },
});

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function validDeviceId(value = '') {
  return /^[a-z0-9-]{8,100}$/i.test(String(value));
}

export async function onRequestPost({ request, env }) {
  if (!env?.STRIPE_SECRET_KEY) return json({ error: 'Payments are not configured yet.', code: 'payments_not_configured' }, 503);

  const body = await request.json().catch(() => ({}));
  const offerKey = String(body?.offer || '');
  const deviceId = String(body?.deviceId || '');
  const offer = OFFERS[offerKey];
  if (!offer || !validDeviceId(deviceId)) return json({ error: 'Invalid checkout request.' }, 400);

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set('mode', offer.mode);
  params.set('success_url', `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/`);
  params.set('client_reference_id', deviceId);
  params.set('metadata[device_id]', deviceId);
  params.set('metadata[offer]', offerKey);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(offer.amount));
  params.set('line_items[0][price_data][product_data][name]', offer.name);
  params.set('allow_promotion_codes', 'true');
  if (offer.recurring) params.set('line_items[0][price_data][recurring][interval]', offer.recurring);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url) {
    return json({ error: data?.error?.message || 'Checkout provider rejected the request.' }, 502);
  }
  return json({ url: data.url, sessionId: data.id });
}
