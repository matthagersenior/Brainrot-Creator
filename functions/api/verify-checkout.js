const PACK_CREDITS = Object.freeze({ pack_5: 5, pack_15: 15, pack_40: 40 });

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function safeSessionId(value = '') {
  const id = String(value || '');
  return /^cs_[A-Za-z0-9_]+$/.test(id) ? id : '';
}

export async function onRequestGet({ request, env }) {
  if (!env?.STRIPE_SECRET_KEY) return json({ error: 'Payments are not configured yet.' }, 503);
  const url = new URL(request.url);
  const sessionId = safeSessionId(url.searchParams.get('session_id'));
  const deviceId = String(url.searchParams.get('device_id') || '');
  if (!sessionId || !deviceId) return json({ error: 'Missing purchase verification data.' }, 400);

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const session = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: session?.error?.message || 'Unable to verify checkout.' }, 502);

  const boundDevice = String(session?.metadata?.device_id || session?.client_reference_id || '');
  if (!boundDevice || boundDevice !== deviceId) return json({ error: 'This purchase belongs to another device.' }, 403);
  if (session.status !== 'complete') return json({ error: 'Checkout is not complete.' }, 409);

  const offer = String(session?.metadata?.offer || '');
  if (offer === 'creator_monthly') {
    const subscription = session.subscription;
    const subscriptionStatus = typeof subscription === 'object' ? String(subscription?.status || '') : '';
    const active = ['active', 'trialing'].includes(subscriptionStatus) && ['paid', 'no_payment_required'].includes(String(session.payment_status || ''));
    return json({
      kind: 'creator',
      active,
      sessionId,
      subscriptionStatus,
      currentPeriodEnd: typeof subscription === 'object' ? Number(subscription?.current_period_end || 0) : 0,
    });
  }

  const credits = PACK_CREDITS[offer] || 0;
  if (!credits || session.payment_status !== 'paid') return json({ error: 'Paid entitlement not found.' }, 409);
  return json({ kind: 'pack', credits, grantId: sessionId });
}
