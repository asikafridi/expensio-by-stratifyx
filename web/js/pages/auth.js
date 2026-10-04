import { api, ApiError } from '../core/api.js';
import { store } from '../core/store.js';
import { $, $$, on, icon, esc, toast, withBtn, btnHtml, fieldErrors, confetti } from '../core/ui.js';
import { setSession, nav } from '../app.js';

const shell = (inner, { wide = false, side = true } = {}) => `<div class="container auth-wrap"><div class="auth-split ${wide ? 'wide' : ''}">
  <div class="auth-side reveal in"><span class="eyebrow"><b>EXPENSIO</b> by StratifyX Global</span><h2 style="margin-top:18px;font-size:clamp(2rem,3.4vw,2.9rem)">Money talk,<br><span class="grad-text">without the awkward.</span></h2>
  <div class="stack-sm" style="margin-top:24px">${['Fair splits to the last paisa', 'Payments confirmed by the receiver', 'NID-verified business partnerships'].map((t) => `<div class="row">${icon('check', 'money-pos')} <span>${t}</span></div>`).join('')}</div>
  <div class="card tight glass" style="margin-top:34px;max-width:360px;transform:rotate(-3deg)"><div class="row"><span class="avatar">🦊</span><div class="grow"><b>Hotel (2 nights)</b><div class="muted" style="font-size:.8rem">Ashik paid · 4 people</div></div><b class="mono">৳18,000</b></div></div></div>
  <div class="card auth-card ${wide ? 'wide' : ''} pad-lg glow">${inner}</div></div></div>`;

const pwField = (name = 'password', label = 'Password', auto = 'current-password') => `<div class="field"><label for="${name}">${label}</label><div class="pw-wrap"><input class="input" id="${name}" name="${name}" type="password" autocomplete="${auto}" required><button type="button" class="pw-toggle" data-pw aria-label="Show password">${icon('eye')}</button></div></div>`;
function bindPw(root) { on(root, 'click', '[data-pw]', (_e, b) => { const i = b.previousElementSibling; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eyeoff' : 'eye'); }); }
const strength = (p) => { let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w]/.test(p)) s++; return s; };
const next = (q) => (q.next && q.next.startsWith('/') ? q.next : '/dashboard');

async function otpStep(card, { challenge, email }, q) {
  card.innerHTML = `<div class="center"><span class="big-emoji">🔐</span><h2 style="font-size:1.7rem">Check your email</h2><p class="muted">We sent a 6-digit security code to <b>${esc(email)}</b>.</p></div>
  <form class="stack" id="otp-form" novalidate><div class="otp">${Array.from({ length: 6 }, (_, i) => `<input class="input" inputmode="numeric" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Digit ${i + 1}">`).join('')}</div><div class="error center" id="otp-err" style="color:var(--bad);font-weight:600"></div>${btnHtml('Verify & sign in', 'btn-primary block lg', 'type="submit"')}</form>`;
  const ins = $$('.otp input', card); ins[0].focus();
  ins.forEach((el, i) => {
    el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(-1); if (el.value && ins[i + 1]) ins[i + 1].focus(); if (ins.every((x) => x.value)) $('#otp-form', card).requestSubmit(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !el.value && ins[i - 1]) ins[i - 1].focus(); });
    el.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (t) { e.preventDefault(); t.split('').forEach((c, k) => { ins[k].value = c; }); ins[Math.min(t.length, 5)].focus(); if (t.length === 6) $('#otp-form', card).requestSubmit(); } });
  });
  $('#otp-form', card).addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button', e.target); const code = ins.map((x) => x.value).join('');
    if (code.length < 6) return; $('#otp-err', card).textContent = '';
    try { const d = await withBtn(btn, () => api.post('/auth/2fa/verify', { challenge, code })); setSession(d); toast(`Welcome back, ${d.user.name.split(' ')[0]}!`, 'good'); nav(next(q)); }
    catch (err) { $('#otp-err', card).textContent = err.message; ins.forEach((x) => { x.value = ''; }); ins[0].focus(); if (err.code === 'CHALLENGE_EXPIRED') setTimeout(() => nav('/login'), 1500); }
  });
}

export async function login({ query }) {
  const html = shell(`<div class="center" style="margin-bottom:22px"><h2 style="font-size:1.9rem">Welcome back 👋</h2><p class="muted">Sign in to your Expensio account</p></div>
  <form class="stack" id="f" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
  ${pwField()}<div class="row between"><span></span><a href="#/forgot-password" style="font-size:.88rem;font-weight:600">Forgot password?</a></div>${btnHtml('Sign in', 'btn-primary block lg', 'type="submit"')}</form>
  <div class="divider">New to Expensio?</div><a class="btn btn-glass block" href="#/register">Create a free account</a>`);
  return {
    title: 'Sign in', html, mount(root) {
      bindPw(root); const card = $('.auth-card', root);
      $('#f', root).addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target; fieldErrors(f);
        try {
          const d = await withBtn($('button[type=submit]', f), () => api.post('/auth/login', { email: f.email.value, password: f.password.value }));
          if (d.requires2fa) return otpStep(card, d, query);
          setSession(d); toast(`Welcome back, ${d.user.name.split(' ')[0]}!`, 'good'); nav(next(query));
        } catch (err) { if (err.details) fieldErrors(f, err.details); else toast(err.message, 'bad'); }
      });
    }
  };
}

export async function register() {
  const html = shell(`<div class="center" style="margin-bottom:20px"><h2 style="font-size:1.8rem">Create your account ✨</h2><p class="muted">Free forever for groups. Takes under a minute.</p></div>
  <form class="stack" id="f" novalidate><div class="form-grid two"><div class="field"><label for="name">Full name</label><input class="input" id="name" name="name" autocomplete="name" required placeholder="Ashik"></div><div class="field"><label for="phone">Phone</label><input class="input" id="phone" name="phone" type="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></div></div>
  <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"><span class="hint">We’ll send a verification code to this address.</span></div>
  <div class="form-grid two"><div class="field"><label for="provider">Mobile banking</label><select class="input" id="provider" name="provider"><option value="">Select (optional)</option>${['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank'].map((p) => `<option>${p}</option>`).join('')}</select></div><div class="field"><label for="bnum">Account number</label><input class="input" id="bnum" name="bnum" inputmode="numeric" placeholder="So friends can pay you"></div></div>
  <div>${pwField('password', 'Password', 'new-password')}<div class="pw-meter" style="margin-top:8px"><i id="meter"></i></div><span class="hint">8+ characters with upper & lower case and a number.</span></div>
  <label class="check"><input type="checkbox" name="acceptTerms"><span>I agree to the <a href="#/terms" target="_blank">Terms</a> and <a href="#/privacy" target="_blank">Privacy Policy</a>.</span></label>
  ${btnHtml('Create account', 'btn-primary block lg', 'type="submit"')}</form><div class="divider">Already registered?</div><a class="btn btn-glass block" href="#/login">Sign in</a>`, { wide: true });
  return {
    title: 'Create account', html, mount(root) {
      bindPw(root); const m = $('#meter', root);
      $('#password', root).addEventListener('input', (e) => { const s = strength(e.target.value); m.style.width = `${s * 20}%`; m.style.background = ['var(--bad)', 'var(--bad)', 'var(--warn)', 'var(--warn)', 'var(--good)', 'var(--good)'][s]; });
      $('#f', root).addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target; fieldErrors(f);
        try {
          const d = await withBtn($('button[type=submit]', f), () => api.post('/auth/register', { name: f.elements.name.value, email: f.email.value, password: f.password.value, phone: f.phone.value, mobileBanking: { provider: f.provider.value, number: f.bnum.value }, acceptTerms: f.acceptTerms.checked ? true : false }));
          setSession(d); confetti(); toast('Account created! Check your email for the verification code.', 'good', 6000); nav('/verify-email');
        } catch (err) { if (err.details) fieldErrors(f, err.details); else toast(err.message, 'bad'); }
      });
    }
  };
}

export async function verifyEmail({ query }) {
  if (query.token) {
    let ok = false; let msg = '';
    try { await api.post('/auth/verify-email', { token: query.token }); ok = true; } catch (e) { msg = e.message; }
    if (ok && store.user) store.user.emailVerified = true;
    return { title: 'Verify email', html: shell(`<div class="center">${ok ? `<svg class="check-anim" viewBox="0 0 84 84" fill="none" stroke="var(--good)" stroke-width="5" stroke-linecap="round"><circle cx="42" cy="42" r="38"/><path d="M26 43l11 11 21-23"/></svg><h2 style="margin-top:14px">Email verified!</h2><p class="muted">You’re all set. Let’s start splitting.</p><a class="btn btn-primary lg" href="#/${store.user ? 'dashboard' : 'login'}">${store.user ? 'Go to dashboard' : 'Sign in'}</a>` : `<span class="big-emoji">😕</span><h2>Link problem</h2><p class="muted">${esc(msg)}</p><a class="btn btn-primary" href="#/verify-email">Enter a code instead</a>`}</div>`), mount() { if (ok) confetti(90); } };
  }
  const email = store.user?.email || '';
  if (store.user?.emailVerified) return { title: 'Verified', html: shell(`<div class="center"><span class="big-emoji">✅</span><h2>You’re already verified</h2><a class="btn btn-primary" href="#/dashboard">Dashboard</a></div>`) };
  const html = shell(`<div class="center"><span class="big-emoji">📬</span><h2 style="font-size:1.7rem">Verify your email</h2><p class="muted">Enter the 6-digit code we sent${email ? ` to <b>${esc(email)}</b>` : ''}, or click the link in the email.</p></div>
  <form class="stack" id="f" novalidate>${email ? '' : '<div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" required></div>'}<div class="field"><label for="code">6-digit code</label><input class="input mono" id="code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" style="text-align:center;font-size:1.6rem;letter-spacing:.5em;font-weight:800"></div>
  ${btnHtml('Verify email', 'btn-primary block lg', 'type="submit"')}<button type="button" class="btn btn-ghost block" id="resend">Resend code</button></form>`);
  return {
    title: 'Verify email', html, mount(root) {
      $('#f', root).addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target;
        try { await withBtn($('button[type=submit]', f), () => api.post('/auth/verify-email', { email: email || f.email.value, code: f.code.value })); if (store.user) store.user.emailVerified = true; confetti(); toast('Email verified! 🎉', 'good'); nav(store.user ? '/dashboard' : '/login'); } catch (err) { toast(err.message, 'bad'); }
      });
      $('#resend', root).addEventListener('click', async (e) => { const em = email || $('#f', root).email?.value; if (!em) return toast('Enter your email first', 'bad'); await withBtn(e.currentTarget, () => api.post('/auth/resend-verification', { email: em })).catch(() => { }); toast('If the account needs it, a new code is on its way.', 'good'); });
    }
  };
}

export async function forgot() {
  const html = shell(`<div class="center" style="margin-bottom:18px"><span class="big-emoji">🔑</span><h2 style="font-size:1.7rem">Forgot your password?</h2><p class="muted">Enter your email and we’ll send a reset link.</p></div><form class="stack" id="f" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" required></div>${btnHtml('Send reset link', 'btn-primary block lg', 'type="submit"')}<a class="btn btn-ghost block" href="#/login">Back to sign in</a></form>`);
  return {
    title: 'Reset password', html, mount(root) {
      $('#f', root).addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; try { await withBtn($('button[type=submit]', f), () => api.post('/auth/forgot-password', { email: f.email.value })); $('.auth-card', root).innerHTML = '<div class="center"><span class="big-emoji">📨</span><h2>Check your inbox</h2><p class="muted">If an account exists for that email, a reset link is on its way. It expires in 60 minutes.</p><a class="btn btn-primary" href="#/login">Back to sign in</a></div>'; } catch (err) { fieldErrors(f, err.details); if (!err.details) toast(err.message, 'bad'); } });
    }
  };
}

export async function reset({ query }) {
  const html = shell(`<div class="center" style="margin-bottom:18px"><span class="big-emoji">🛡️</span><h2 style="font-size:1.7rem">Choose a new password</h2></div><form class="stack" id="f" novalidate>${pwField('password', 'New password', 'new-password')}${btnHtml('Update password', 'btn-primary block lg', 'type="submit"')}</form>`);
  return {
    title: 'New password', html, mount(root) {
      bindPw(root);
      $('#f', root).addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; fieldErrors(f); try { await withBtn($('button[type=submit]', f), () => api.post('/auth/reset-password', { token: query.token || '', password: f.password.value })); toast('Password updated. Please sign in.', 'good'); nav('/login'); } catch (err) { if (err.details) fieldErrors(f, err.details); else toast(err.message, 'bad'); } });
    }
  };
}

// Invitation landing: previews publicly, then routes to sign-in/register or the accept screen.
export async function invite({ params }) {
  let p; try { p = await api.get(`/invitations/preview/${params.token}`); } catch (e) { return { title: 'Invitation', html: shell(`<div class="center"><span class="big-emoji">🔗</span><h2>Invitation not found</h2><p class="muted">${esc(e.message)}</p><a class="btn btn-primary" href="#/">Home</a></div>`) }; }
  const biz = p.kind === 'business';
  const html = shell(`<div class="center"><span class="big-emoji">${biz ? '🤝' : '🎉'}</span><h2 style="font-size:1.6rem">${esc(p.inviterName)} invited you</h2><p class="muted">to ${biz ? `partner in <b>${esc(p.targetName)}</b> as <b>${esc(p.role)}</b>${p.ownershipPercent ? ` (${p.ownershipPercent}% share)` : ''}` : `join the group <b>${esc(p.targetName)}</b>`}.</p>
  <p class="faint" style="font-size:.85rem">Invited address: ${esc(p.emailHint)}</p>${biz ? `<div class="secure-note" style="text-align:left;margin-bottom:16px">${icon('id')}<span>Business partners verify their identity with a National ID. It’s encrypted and masked.</span></div>` : ''}
  ${p.status !== 'pending' ? `<div class="badge bad">This invitation is ${esc(p.status)}</div>` : store.user ? `<div id="acc" class="stack"></div>` : `<div class="stack"><a class="btn btn-primary lg" href="#/${p.accountExists ? 'login' : 'register'}?next=${encodeURIComponent(`/invite/${params.token}`)}">${p.accountExists ? 'Sign in to accept' : 'Create account to accept'}</a></div>`}</div>`);
  return {
    title: 'Invitation', html, async mount(root) {
      if (!store.user || p.status !== 'pending') return;
      const box = $('#acc', root);
      try {
        const d = await api.get(`/invitations/by-token/${params.token}`);
        if (!d.verified) { box.innerHTML = '<p class="muted">Verify your email first.</p><a class="btn btn-gold" href="#/verify-email">Verify email</a>'; return; }
        const { inviteAcceptForm } = await import('./business.js'); inviteAcceptForm(box, d.invitation, d.hasNid, (link) => nav(link));
      } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    }
  };
}
