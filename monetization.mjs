import {
  MONETIZATION,
  normalizeUsage,
  freeRemaining,
  consumeGeneration,
} from './monetization-core.mjs';

const USAGE_KEY = 'brainrot.monetization.usage.v1';
const BILLING_KEY = 'brainrot.monetization.billing.v1';
const DEVICE_KEY = 'brainrot.monetization.device.v1';

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
billing.grantIds = Array.isArray(billing.grantIds) ? billing.grantIds.filter(Boolean).slice(-100) : [];
let config = {
  checkoutAvailable: false,
  offers: {
    creator_monthly: { label: 'Creator', amount: 5.99, interval: 'month' },
    pack_5: { label: '5 extra creations', amount: 1.99 },
    pack_15: { label: '15 extra creations', amount: 4.99 },
    pack_40: { label: '40 extra creations', amount: 9.99 },
  },
};

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
  const style = document.createElement('style');
  style.textContent = `
    .money-btn{border:1px solid rgba(198,255,0,.55);background:#11151a;color:#eaff9a;border-radius:999px;padding:.56rem .78rem;font:800 .72rem/1 ui-sans-serif,system-ui;letter-spacing:.04em;white-space:nowrap}
    .money-btn.creator{border-color:rgba(0,229,255,.65);color:#9bf7ff}
    .money-dialog{width:min(94vw,520px);max-height:min(86vh,760px);overflow:auto;border:1px solid rgba(255,255,255,.16);border-radius:24px;background:#0a0710;color:#fff;padding:0;box-shadow:0 28px 80px rgba(0,0,0,.7)}
    .money-dialog::backdrop{background:rgba(0,0,0,.75);backdrop-filter:blur(6px)}
    .money-shell{padding:22px;display:grid;gap:15px}
    .money-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
    .money-head h2{margin:0;font:950 clamp(1.45rem,6vw,2.1rem)/.98 Impact,Arial Black,sans-serif;letter-spacing:.02em}
    .money-head p,.money-card p,.money-note{margin:.35rem 0 0;color:rgba(255,255,255,.7);font:650 .92rem/1.4 ui-sans-serif,system-ui}
    .money-close{border:0;background:#211b2a;color:#fff;border-radius:999px;width:38px;height:38px;font-size:1.1rem}
    .money-card{border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:16px;background:linear-gradient(145deg,rgba(255,46,196,.08),rgba(0,229,255,.05));display:grid;gap:11px}
    .money-card h3{margin:0;font:900 1.05rem/1.1 ui-sans-serif,system-ui}
    .money-price{font:950 1.65rem/1 Impact,Arial Black,sans-serif;color:#c6ff00}
    .money-action{min-height:46px;border:0;border-radius:14px;padding:.8rem 1rem;font:900 .9rem/1 ui-sans-serif,system-ui;background:#c6ff00;color:#090011}
    .money-action.secondary{background:#1d2630;color:#fff;border:1px solid rgba(255,255,255,.14)}
    .money-action:disabled{opacity:.45}
    .money-packs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .money-pack{border:1px solid rgba(255,255,255,.13);background:#14101b;color:#fff;border-radius:14px;padding:11px 8px;font:850 .78rem/1.25 ui-sans-serif,system-ui}
    .money-status{min-height:1.25em;color:#9bf7ff;font:750 .82rem/1.35 ui-sans-serif,system-ui}
    @media(max-width:430px){.money-packs{grid-template-columns:1fr}.money-shell{padding:17px}}
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = 'monetizationBtn';
  button.type = 'button';
  button.className = 'money-btn';
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', openDialog);
  document.querySelector('.utility-actions')?.prepend(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'monetizationDialog';
  dialog.className = 'money-dialog';
  dialog.innerHTML = `
    <div class="money-shell">
      <div class="money-head">
        <div><h2>MAKE MORE ROT</h2><p id="moneySummary"></p></div>
        <button class="money-close" type="button" aria-label="Close">✕</button>
      </div>
      <section class="money-card">
        <div><h3>CREATOR</h3><div class="money-price">$5.99 / month</div><p>Unlimited creations on this device. No Brain Rot Creator watermark on exports.</p></div>
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
  updateUi();
}

function status(message = '') {
  const element = document.getElementById('moneyStatus');
  if (element) element.textContent = message;
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
    buttonEl.disabled = !config.checkoutAvailable;
    buttonEl.title = config.checkoutAvailable ? '' : 'Checkout is waiting for payment credentials.';
  });
}

function openDialog(message = '') {
  injectUi();
  updateUi();
  status(message || (!config.checkoutAvailable ? 'Checkout code is live; payment credentials still need to be connected.' : ''));
  const dialog = document.getElementById('monetizationDialog');
  if (dialog?.showModal) dialog.showModal();
  else dialog?.setAttribute('open', '');
}

async function loadConfig() {
  try {
    const response = await fetch('/api/monetization-config', { headers: { accept: 'application/json' } });
    if (response.ok) config = { ...config, ...(await response.json()) };
  } catch { /* offline keeps free tier usable */ }
  updateUi();
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
    billing.grantIds = billing.grantIds.slice(-100);
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

async function processCheckoutReturn() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('checkout') !== 'success') return;
  const sessionId = url.searchParams.get('session_id');
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  if (!sessionId) return;
  try {
    const result = await verifySession(sessionId);
    openDialog(result.kind === 'creator' ? 'Creator is active. Go cook unlimited rot.' : `${result.credits} extra creations added.`);
  } catch {
    openDialog('Payment completed, but this device could not verify it yet. Reopen the app while online and try again.');
  }
}

async function startCheckout(offer) {
  status('Opening secure checkout…');
  document.querySelectorAll('[data-offer]').forEach(element => { element.disabled = true; });
  try {
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ offer, deviceId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || 'Checkout is not configured yet.');
    window.location.assign(data.url);
  } catch (error) {
    status(error?.message || 'Checkout is unavailable.');
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
refreshCreator();
processCheckoutReturn();
