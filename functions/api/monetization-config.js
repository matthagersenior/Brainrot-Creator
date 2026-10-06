const OFFERS = Object.freeze({
  creator_monthly: { label: 'Creator', amount: 5.99, interval: 'month' },
  pack_5: { label: '5 extra creations', amount: 1.99, credits: 5 },
  pack_15: { label: '15 extra creations', amount: 4.99, credits: 15 },
  pack_40: { label: '40 extra creations', amount: 9.99, credits: 40 },
});

export async function onRequestGet({ env }) {
  return Response.json({
    checkoutAvailable: Boolean(env?.STRIPE_SECRET_KEY),
    currency: 'USD',
    freeDailyLimit: 3,
    offers: OFFERS,
  }, {
    headers: { 'cache-control': 'public, max-age=60' },
  });
}
