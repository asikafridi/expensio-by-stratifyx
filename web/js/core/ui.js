// UI toolkit: escaping, icons, formatting, toast, modal, confetti, animations.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const on = (root, ev, sel, fn) => root.addEventListener(ev, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>', bell: '<path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 004 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 018 0v3"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/>', zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>', wallet: '<path d="M3 7a3 3 0 013-3h12v4"/><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="16.5" cy="13.5" r="1.3"/>',
  split: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>', download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6 8-6s7.2 1.8 8 6"/>', logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6A16.6 16.6 0 002 12s3.6 7 10 7a9.6 9.6 0 004.4-1"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/>', id: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.6 1.6-2.2 2.5-2.2s2 .6 2.5 2.2M14 10h4M14 14h3"/>',
  file: '<path d="M6 3h8l5 5v13H6V3z"/><path d="M14 3v5h5"/>', alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.1"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>', copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
  refresh: '<path d="M21 12a9 9 0 01-15.5 6.2L3 16M3 12a9 9 0 0115.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>', trend: '<path d="M3 17l6-6 4 4 8-9M15 6h6v6"/>', layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .6-1.5 1.2-1.5 2.5M12 17v.1"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>', down: '<path d="M6 9l6 6 6-6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>', building: '<rect x="4" y="3" width="10" height="18" rx="2"/><path d="M14 9h4a2 2 0 012 2v10H14M8 7h2M8 11h2M8 15h2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.4-1-1.5-1.5-2.8-1.5-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2.1 2.7.9 2.7 2.1-1.1 2-2.7 2c-1.4 0-2.5-.6-2.9-1.6M12 6v1.7M12 16.3V18"/>', twitter: '<path d="M22 5.8c-.7.3-1.5.6-2.3.7a4 4 0 001.8-2.2 8 8 0 01-2.6 1A4 4 0 0012 9a11.5 11.5 0 01-8.4-4.3 4 4 0 001.2 5.4 4 4 0 01-1.8-.5 4 4 0 003.2 4 4 4 0 01-1.8.1 4 4 0 003.8 2.8A8 8 0 012 18.4 11.3 11.3 0 008.1 20c7.4 0 11.5-6.2 11.3-11.8.8-.6 1.9-1.4 2.6-2.4z"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>', linkedin: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 10v7M8 7v.1M12 17v-4a2.5 2.5 0 015 0v4M12 10v7"/>', github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
};
export const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
export const logo = (small = false) => `<a class="logo" href="#/" aria-label="Expensio by StratifyX Global"><svg viewBox="0 0 64 64"><use href="/assets/logo.svg#mark"/></svg><span><b>Expensio</b>${small ? '' : '<small>BY STRATIFYX GLOBAL</small>'}</span></a>`;

export const CAT = { general: ['🧾', 'General'], food: ['🍽️', 'Food & drinks'], groceries: ['🛒', 'Groceries'], transport: ['🚌', 'Transport'], stay: ['🏨', 'Stay'], travel: ['✈️', 'Travel'], shopping: ['🛍️', 'Shopping'], entertainment: ['🎉', 'Fun'], bills: ['💡', 'Bills'], health: ['💊', 'Health'], other: ['📦', 'Other'] };
export const GROUP_CATS = { trip: ['🧳', 'Trip'], home: ['🏠', 'Home / mess'], event: ['🎊', 'Event'], friends: ['👯', 'Friends'], work: ['💼', 'Work'], other: ['📦', 'Other'] };

// ---------- formatting ----------
let CUR = { BDT: { symbol: '৳', exp: 2 } };
export const setCurrencies = (c) => { CUR = c; };
export const currencies = () => CUR;
export function money(minor, cur = 'BDT', { sign = false, compact = false } = {}) {
  const c = CUR[cur] || { symbol: cur, exp: 2 }; const v = (minor || 0) / 10 ** c.exp;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: compact && Number.isInteger(v) ? 0 : c.exp, maximumFractionDigits: c.exp });
  return `${v < 0 ? '−' : sign && v > 0 ? '+' : ''}${c.symbol}${s}`;
}
export const toMajor = (minor, cur = 'BDT') => (minor || 0) / 10 ** ((CUR[cur] || { exp: 2 }).exp);
export const dateFmt = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(d).toLocaleDateString('en-GB', o);
export function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return dateFmt(d);
}
export const avatar = (u, cls = '') => `<span class="avatar ${cls}" style="--c:${esc(u?.avatar?.color || '#0E7C7B')}" title="${esc(u?.name || '')}">${esc(u?.avatar?.emoji || '🙂')}</span>`;
export const firstName = (n) => String(n || '').split(' ')[0];

// ---------- toast ----------
export function toast(msg, type = 'info', ms = 4200) {
  const box = document.getElementById('toasts'); const t = document.createElement('div');
  t.className = `toast ${type}`; t.innerHTML = `<span>${type === 'good' ? '✅' : type === 'bad' ? '⚠️' : '💬'}</span><span>${esc(msg)}</span>`;
  box.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}

// ---------- modal ----------
export function modal({ title, body, lg = false, onMount, closable = true }) {
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `<div class="modal glass ${lg ? 'lg' : ''}"><div class="modal-head"><h3>${esc(title)}</h3>${closable ? `<button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>` : ''}</div><div class="modal-body">${body}</div></div>`;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); if (!document.querySelector('.overlay')) document.body.style.overflow = ''; document.removeEventListener('keydown', esck); };
  const esck = (e) => { if (e.key === 'Escape' && closable) close(); };
  document.addEventListener('keydown', esck);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov && closable) close(); });
  ov.querySelector('[data-close]')?.addEventListener('click', close);
  const api = { el: ov.querySelector('.modal-body'), close, root: ov };
  onMount?.(api); ov.querySelector('input:not([type=checkbox]),select,textarea')?.focus({ preventScroll: true });
  return api;
}
export const confirmBox = ({ title, text, ok = 'Confirm', danger = false }) => new Promise((res) => {
  const m = modal({ title, body: `<p class="muted">${esc(text)}</p><div class="row end wrap" style="margin-top:20px"><button class="btn btn-glass" data-n>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-y>${esc(ok)}</button></div>`, onMount: (m) => { m.el.querySelector('[data-n]').onclick = () => { m.close(); res(false); }; m.el.querySelector('[data-y]').onclick = () => { m.close(); res(true); }; } });
  m.root.addEventListener('mousedown', (e) => { if (e.target === m.root) res(false); });
});

// ---------- button helpers ----------
export async function withBtn(btn, fn) {
  btn.classList.add('loading'); const had = btn.disabled; btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('loading'); btn.disabled = had; }
}
export const btnHtml = (label, cls = 'btn-primary', attrs = '') => `<button class="btn ${cls}" ${attrs}><span class="spin"></span><span>${label}</span></button>`;

export function fieldErrors(form, details = {}) {
  form.querySelectorAll('.field.err').forEach((f) => { f.classList.remove('err'); f.querySelector('.error')?.remove(); });
  for (const [k, msg] of Object.entries(details || {})) {
    const inp = form.querySelector(`[name="${k.replace(/^.*\./, '')}"]`) || form.querySelector(`[name="${k}"]`); const f = inp?.closest('.field');
    if (f) { f.classList.add('err'); const e = document.createElement('div'); e.className = 'error'; e.textContent = msg; f.appendChild(e); }
  }
}

// ---------- motion ----------
export function countUp(el, to, { dur = 900, fmt = (v) => Math.round(v).toLocaleString('en-US') } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - (1 - p) ** 4; el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export function animateNumbers(root = document) {
  $$('[data-count]', root).forEach((el) => { const to = Number(el.dataset.count); const cur = el.dataset.cur; countUp(el, to, { fmt: cur ? (v) => money(Math.round(v), cur) : undefined }); });
}
let io;
export function revealOnScroll(root = document) {
  io ||= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px' });
  $$('.reveal:not(.in)', root).forEach((el, i) => { el.style.setProperty('--i', el.dataset.i ?? i % 6); io.observe(el); });
}
export function ripple(e) {
  const b = e.target.closest('.btn'); if (!b) return;
  const r = b.getBoundingClientRect(); const s = document.createElement('span'); const d = Math.max(r.width, r.height);
  s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 650);
}
export function tilt(el, max = 10) {
  if (matchMedia('(hover: none)').matches) return;
  el.addEventListener('mousemove', (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; el.style.animation = 'none'; el.style.transform = `rotateY(${x * max}deg) rotateX(${-y * max}deg)`; });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; el.style.animation = ''; });
}
export function confetti(n = 140) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.getElementById('confetti'); const ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#1fc2bc', '#6d7bff', '#ff7ab6', '#f2c15b', '#34d399'];
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .55, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, s: 5 + Math.random() * 7, c: colors[Math.floor(Math.random() * 5)], r: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 0 }));
  let f = 0; (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height); f++;
    for (const p of ps) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= .99; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - f / 130); ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); ctx.restore(); }
    if (f < 130) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}
export function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('ex_theme', t); } catch (e) { /* ignore */ } document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#eef3fa' : '#0d1428'; }
export const theme = () => document.documentElement.dataset.theme;
export const skeletons = (n = 3, h = 84) => Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}px;margin-bottom:12px"></div>`).join('');
export const empty = (emoji, title, text, action = '') => `<div class="empty"><span class="big">${emoji}</span><h3>${esc(title)}</h3><p class="muted" style="max-width:380px;margin:0 auto 18px">${esc(text)}</p>${action}</div>`;
