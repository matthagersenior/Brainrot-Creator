import {
  MONETIZATION,
  normalizeUsage,
  freeRemaining,
  consumeGeneration,
} from './monetization-core.mjs';

const USAGE_KEY = 'brainrot.monetization.usage.v1';
const BILLING_KEY = 'brainrot.monetization.billing.v1';
const DEVICE_KEY = 'brainrot.monetization.device.v1';
const PENDING_KEY = 'brainrot.monetization.pending-checkout.v1';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode/storage full */ }
}

function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID?.() || `brc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `brc-${Date.now().toString(36)}`;
  }
}

const deviceId = getDeviceId();
let usage = normalizeUsage(readJson(USAGE_KEY, {}));
let billing = {
  creatorActive: false,
  creatorSessionId: '',
  credits: 0,
  grantIds: [],
  ...readJson(BILLING_KEY, {}),
};
billing.credits = Math.max(0, Math.floor(Number(billing.credits) || 0));
billing.grantIds = Array.isArray(billing.grantIds) ? billing.grantIds.filter(Boolean).slice(-1000) : [];
let checkoutBusy = false;
let configChecked = false;
let config = {
  checkoutAvailable: false,
  offers: {
    creator_monthly: { label: 'Creator', amount: 5.99, interval: 'month' },
    pack_5: { label: '5 extra creations', amount: 1.99 },
    pack_15: { label: '15 extra creations', amount: 4.99 },
    pack_40: { label: '40 extra creations', amount: 9.99 },
  },
};

function pendingSession() {
  try { return localStorage.getItem(PENDING_KEY) || ''; } catch { return ''; }
}

function savePending(sessionId) {
  try { localStorage.setItem(PENDING_KEY, sessionId); } catch { /* storage may be unavailable */ }
}

function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* storage may be unavailable */ }
}

function persist() {
  usage = normalizeUsage(usage);
  writeJson(USAGE_KEY, usage);
  writeJson(BILLING_KEY, billing);
}

function validPromptForPaidGate() {
  const prompt = String(document.getElementById('promptInput')?.value || '').trim();
  if (!prompt) return false;
  return prompt.split(/\s+/u).filter(Boolean).length <= 60;
}

function currentSnapshot() {
  return {
    creatorActive: Boolean(billing.creatorActive),
    credits: billing.credits,
    freeRemaining: freeRemaining(usage),
    freeDailyLimit: MONETIZATION.freeDailyLimit,
  };
}

function injectUi() {
  if (document.getElementById('monetizationBtn')) return;
  const button = document.createElement('button');
  button.id = 'monetizationBtn';
  button.type = 'button';
  button.className = 'money-btn';
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => openDialog());
  document.querySelector('.utility-actions')?.prepend(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'monetizationDialog';
  dialog.className = 'money-dialog';
  dialog.setAttribute('aria-labelledby', 'moneyTitle');
  dialog.setAttribute('aria-describedby', 'moneySummary');
  dialog.innerHTML = `
    <div class="money-shell">
      <div class="money-head">
        <div><h2 id="moneyTitle">MAKE MORE ROT</h2><p id="moneySummary"></p></div>
        <button class="money-close" type="button" aria-label="Close">✕</button>
      </div>
      <section class="money-card">
        <div><h3>CREATOR</h3><div class="money-price">$5.99 / month</div><p>Unlimited creations while your subscription is active. No Brain Rot Creator watermark on exports. Keep this device ID to restore purchases.</p></div>
        <button class="money-action" data-offer="creator_monthly" type="button">GO CREATOR</button>
      </section>
      <section class="money-card">
        <div><h3>JUST NEED MORE?</h3><p>Buy extra creations without a subscription. Packs add generations; free exports still carry the small brand watermark.</p></div>
        <div class="money-packs">
          <button class="money-pack" data-offer="pack_5" type="button">5 MORE<br><strong>$1.99</strong></button>
          <button class="money-pack" data-offer="pack_15" type="button">15 MORE<br><strong>$4.99</strong></button>
          <button class="money-pack" data-offer="pack_40" type="button">40 MORE<br><strong>$9.99</strong></button>
        </div>
      </section>
      <div id="moneyStatus" class="money-status" role="status" aria-live="polite"></div>
      <button id="moneyRetry" class="money-action secondary" type="button" hidden>RETRY PURCHASE VERIFICATION</button>
      <p class="money-note">Free stays simple: 3 creations each day. Purchases are handled by the checkout provider; card details never pass through Brain Rot Creator.</p>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('.money-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll('[data-offer]').forEach(element => {
    element.addEventListener('click', () => startCheckout(element.dataset.offer));
  });
  dialog.querySelector('#moneyRetry')?.addEventListener('click', () => verifyPendingPurchase());
  updateUi();
}

function status(message = '') {
  const element = document.getElementById('moneyStatus');
  if (element) element.textContent = typeof message === 'string' ? message : '';
}

function updateUi() {
  usage = normalizeUsage(usage);
  persist();
  const snapshot = currentSnapshot();
  const button = document.getElementById('monetizationBtn');
  if (button) {
    button.classList.toggle('creator', snapshot.creatorActive);
    button.textContent = snapshot.creatorActive
      ? 'CREATOR ✓'
      : snapshot.freeRemaining > 0
        ? `FREE · ${snapshot.freeRemaining} LEFT`
        : snapshot.credits > 0
          ? `${snapshot.credits} EXTRA LEFT`
          : 'GET MORE';
  }
  const summary = document.getElementById('moneySummary');
  if (summary) {
    summary.textContent = snapshot.creatorActive
      ? 'Creator is active — unlimited creations and clean exports.'
      : `${snapshot.freeRemaining} of ${snapshot.freeDailyLimit} free creations left today${snapshot.credits ? ` · ${snapshot.credits} extra saved` : ''}.`;
  }
  document.querySelectorAll('[data-offer]').forEach(buttonEl => {
    const disabled = checkoutBusy || !config.checkoutAvailable || snapshot.creatorActive;
    buttonEl.disabled = disabled;
    buttonEl.title = snapshot.creatorActive
      ? 'Creator is already active.'
      : !config.checkoutAvailable
        ? 'Purchases are currently unavailable.'
        : '';
  });
  const creatorButton = document.querySelector('[data-offer="creator_monthly"]');
  if (creatorButton) creatorButton.textContent = snapshot.creatorActive ? 'CREATOR ACTIVE ✓' : 'GO CREATOR';
  const retry = document.getElementById('moneyRetry');
  if (retry) retry.hidden = !pendingSession();
}

function openDialog(message = '') {
  injectUi();
  updateUi();
  const fallback = !configChecked
    ? 'Checking purchase availability…'
    : !config.checkoutAvailable
      ? 'Purchases are temporarily unavailable. Your 3 free creations reset each day.'
      : '';
  status(typeof message === 'string' && message ? message : fallback);
  const dialog = document.getElementById('monetizationDialog');
  if (dialog && !dialog.open) {
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/monetization-config', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Configuration unavailable');
    config = { ...config, ...(await response.json()) };
  } catch {
    config.checkoutAvailable = false; // Offline and GitHub Pages never permit checkout.
  } finally {
    configChecked = true;
    updateUi();
    const dialog = document.getElementById('monetizationDialog');
    if (dialog?.open && !document.getElementById('moneyStatus')?.textContent?.includes('purchase')) {
      status(config.checkoutAvailable ? '' : 'Purchases are temporarily unavailable. Your 3 free creations reset each day.');
    }
  }
}

async function verifySession(sessionId) {
  const query = new URLSearchParams({ session_id: sessionId, device_id: deviceId });
  const response = await fetch(`/api/verify-checkout?${query}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not verify purchase.');
  const result = await response.json();
  if (result.kind === 'creator') {
    billing.creatorActive = Boolean(result.active);
    billing.creatorSessionId = result.active ? sessionId : '';
  } else if (result.kind === 'pack' && result.grantId && !billing.grantIds.includes(result.grantId)) {
    billing.credits += Math.max(0, Math.floor(Number(result.credits) || 0));
    billing.grantIds.push(result.grantId);
    billing.grantIds = billing.grantIds.slice(-1000);
  }
  persist();
  updateUi();
  return result;
}

async function refreshCreator() {
  if (!billing.creatorSessionId) return;
  try {
    const result = await verifySession(billing.creatorSessionId);
    billing.creatorActive = result.kind === 'creator' && Boolean(result.active);
  } catch {
    // Keep the last known state during transient network failures. Stripe is rechecked on the next load.
  }
  persist();
  updateUi();
}

async function verifyPendingPurchase() {
  const sessionId = pendingSession();
  if (!sessionId) {
    openDialog('No pending purchase on this device.');
    return;
  }
  status('Verifying purchase with the checkout provider…');
  try {
    const result = await verifySession(sessionId);
    if (result.kind === 'creator' && !result.active) {
      throw new Error('Your subscription is not active yet. Try again shortly.');
    }
    if (result.kind !== 'creator' && result.kind !== 'pack') {
      throw new Error('No purchase entitlement was returned.');
    }
    clearPending();
    updateUi();
    openDialog(result.kind === 'creator'
      ? 'Creator is active. Unlimited creations and clean exports are unlocked.'
      : `${result.credits} extra creations confirmed. Your balance is now ${billing.credits}.`);
  } catch (error) {
    openDialog(`${error?.message || 'Purchase could not be verified.'} Tap Retry Purchase Verification while online. No credits have been granted.`);
  }
}

async function processCheckoutReturn() {
  const url = new URL(window.location.href);
  const checkout = url.searchParams.get('checkout');
  const sessionId = url.searchParams.get('session_id');
  if (checkout) {
    url.searchParams.delete('checkout');
    url.searchParams.delete('session_id');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  if (checkout === 'cancel') {
    clearPending();
    openDialog('Checkout canceled. You were not charged by this attempt.');
    return;
  }
  if (checkout === 'success' && sessionId) savePending(sessionId);
  if (pendingSession()) await verifyPendingPurchase();
  else if (checkout === 'success') openDialog('Missing checkout session. No credits were granted; contact support if you were charged.');
}

async function startCheckout(offer) {
  if (checkoutBusy) return;
  if (!config.checkoutAvailable || billing.creatorActive) {
    openDialog('Purchases are not currently available for this account or device.');
    return;
  }
  checkoutBusy = true;
  status('Opening secure checkout…');
  updateUi();
  try {
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ offer, deviceId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url || !data.sessionId) throw new Error(data.error || 'Checkout is not configured yet.');
    const checkoutUrl = new URL(data.url);
    if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
      throw new Error('Invalid secure checkout destination.');
    }
    savePending(String(data.sessionId));
    window.location.assign(checkoutUrl.href);
  } catch (error) {
    status(error?.message || 'Checkout is unavailable. Please try again later.');
  } finally {
    checkoutBusy = false;
    updateUi();
  }
}

function useGenerationAllowance() {
  const result = consumeGeneration({
    usage,
    credits: billing.credits,
    creatorActive: billing.creatorActive,
  });
  if (!result.allowed) return false;
  usage = result.usage;
  billing.credits = result.credits;
  persist();
  updateUi();
  return true;
}

document.addEventListener('click', event => {
  const button = event.target?.closest?.('#genBtn,#quickBtn,#nextTrendBtn');
  if (!button || button.disabled) return;
  if (button.id === 'genBtn' && !validPromptForPaidGate()) return;
  if (useGenerationAllowance()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openDialog('You used today’s 3 free creations. Go Creator or grab an extra pack to keep cooking.');
}, true);

window.BrainrotMonetization = {
  open: openDialog,
  snapshot: currentSnapshot,
  shouldWatermark: () => !billing.creatorActive,
  drawWatermark(ctx, canvas) {
    if (billing.creatorActive || !ctx || !canvas) return;
    const label = 'BRAIN ROT CREATOR';
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '900 21px ui-sans-serif, system-ui, sans-serif';
    const width = ctx.measureText(label).width;
    const x = canvas.width - 18;
    const y = canvas.height - 18;
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillRect(x - width - 28, y - 32, width + 38, 38);
    ctx.fillStyle = '#c6ff00';
    ctx.fillText(label, x, y - 5);
    ctx.restore();
  },
};

injectUi();
loadConfig();
refreshCreator().then(() => processCheckoutReturn());
