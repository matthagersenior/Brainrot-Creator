export const MONETIZATION = Object.freeze({
  freeDailyLimit: 3,
  creatorMonthlyUsd: 5.99,
  packs: Object.freeze({
    pack_5: Object.freeze({ credits: 5, usd: 1.99, label: '5 extra creations' }),
    pack_15: Object.freeze({ credits: 15, usd: 4.99, label: '15 extra creations' }),
    pack_40: Object.freeze({ credits: 40, usd: 9.99, label: '40 extra creations' }),
  }),
});

export function localDayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeUsage(value = {}, now = new Date()) {
  const today = localDayKey(now);
  const count = Number.isFinite(Number(value?.count)) ? Math.max(0, Math.floor(Number(value.count))) : 0;
  return value?.day === today ? { day: today, count } : { day: today, count: 0 };
}

export function freeRemaining(value = {}, now = new Date(), limit = MONETIZATION.freeDailyLimit) {
  const usage = normalizeUsage(value, now);
  return Math.max(0, Math.max(0, Number(limit) || 0) - usage.count);
}

export function consumeGeneration({ usage = {}, credits = 0, creatorActive = false } = {}, now = new Date()) {
  const normalized = normalizeUsage(usage, now);
  const safeCredits = Math.max(0, Math.floor(Number(credits) || 0));
  if (creatorActive) {
    return { allowed: true, source: 'creator', usage: normalized, credits: safeCredits };
  }
  if (freeRemaining(normalized, now) > 0) {
    return {
      allowed: true,
      source: 'free',
      usage: { ...normalized, count: normalized.count + 1 },
      credits: safeCredits,
    };
  }
  if (safeCredits > 0) {
    return { allowed: true, source: 'credit', usage: normalized, credits: safeCredits - 1 };
  }
  return { allowed: false, source: 'limit', usage: normalized, credits: safeCredits };
}

export function isValidOffer(value = '') {
  return value === 'creator_monthly' || Object.prototype.hasOwnProperty.call(MONETIZATION.packs, value);
}
