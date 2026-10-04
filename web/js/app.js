import { api, refresh, setToken } from './core/api.js';
import { store, emit } from './core/store.js';
import { $, $$, on, icon, logo, esc, toast, setCurrencies, setTheme, theme, ripple, revealOnScroll, avatar, ago } from './core/ui.js';
import { BRAND } from './core/brand.js';

// ───────── routes ─────────
const R = (path, auth, loader, layout = 'public') => ({ re: new RegExp(`^${path.replace(/:[a-z]+/g, '([^/]+)')}$`), keys: (path.match(/:[a-z]+/g) || []).map((k) => k.slice(1)), auth, loader, layout });
const routes = [
  R('/', 'any', () => import('./pages/landing.js')),
  R('/login', 'guest', () => import('./pages/auth.js').then((m) => ({ default: m.login }))),
  R('/register', 'guest', () => import('./pages/auth.js').then((m) => ({ default: m.register }))),
  R('/verify-email', 'any', () => import('./pages/auth.js').then((m) => ({ default: m.verifyEmail }))),
  R('/forgot-password', 'guest', () => import('./pages/auth.js').then((m) => ({ default: m.forgot }))),
  R('/reset-password', 'any', () => import('./pages/auth.js').then((m) => ({ default: m.reset }))),
  R('/invite/:token', 'any', () => import('./pages/auth.js').then((m) => ({ default: m.invite }))),
  R('/about', 'any', () => import('./pages/info.js').then((m) => ({ default: m.about }))),
  R('/contact', 'any', () => import('./pages/info.js').then((m) => ({ default: m.contact }))),
  R('/terms', 'any', () => import('./pages/info.js').then((m) => ({ default: m.legal('terms') }))),
  R('/privacy', 'any', () => import('./pages/info.js').then((m) => ({ default: m.legal('privacy') }))),
  R('/cookies', 'any', () => import('./pages/info.js').then((m) => ({ default: m.legal('cookies') }))),
  R('/security', 'any', () => import('./pages/info.js').then((m) => ({ default: m.legal('security') }))),
  R('/dashboard', 'user', () => import('./pages/dashboard.js'), 'app'),
  R('/groups', 'user', () => import('./pages/groups.js').then((m) => ({ default: m.list })), 'app'),
  R('/groups/:id', 'user', () => import('./pages/groups.js').then((m) => ({ default: m.detail })), 'app'),
  R('/business', 'user', () => import('./pages/business.js').then((m) => ({ default: m.list })), 'app'),
  R('/business/:id', 'user', () => import('./pages/business.js').then((m) => ({ default: m.detail })), 'app'),
  R('/invitations', 'user', () => import('./pages/business.js').then((m) => ({ default: m.invitations })), 'app'),
  R('/notifications', 'user', () => import('./pages/settings.js').then((m) => ({ default: m.notifications })), 'app'),
  R('/settings', 'user', () => import('./pages/settings.js').then((m) => ({ default: m.settings })), 'app'),
  R('/support', 'user', () => import('./pages/info.js').then((m) => ({ default: m.myTickets })), 'app'),
  R('/admin', 'staff', () => import('./admin/admin.js'), 'app'),
  R('/admin/:section', 'staff', () => import('./admin/admin.js'), 'app'),
];

export const nav = (p) => { location.hash = `#${p}`; };
const parse = () => { const h = location.hash.slice(1) || '/'; const [path, qs] = h.split('?'); return { path: path.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) }; };
const root = document.getElementById('root');
let layout = null; let cleanup = null; let token = 0;

// ───────── layouts ─────────
function publicShell() {
  root.innerHTML = `${store.config.banner ? `<div class="banner">${esc(store.config.banner)}</div>` : ''}
  <header class="nav" id="nav"><div class="container">${logo()}
    <nav class="nav-links" aria-label="Main"><a href="#/" data-scroll="features">Features</a><a href="#/" data-scroll="how">How it works</a><a href="#/" data-scroll="business">Business</a><a href="#/" data-scroll="faq">FAQ</a><a href="#/about">About</a></nav>
    <div class="nav-cta"><button class="icon-btn" data-theme-toggle aria-label="Toggle theme">${icon(theme() === 'dark' ? 'sun' : 'moon')}</button><span id="nav-auth"></span><button class="icon-btn burger" data-burger aria-label="Open menu" aria-haspopup="dialog" aria-expanded="false">${icon('menu')}</button></div></div></header>
  <main id="view"></main>
  <footer class="footer"><div class="container"><div class="footer-grid">
    <div>${logo()}<p class="muted" style="max-width:340px;margin-top:16px">${esc(BRAND.tagline)} Fair splits, confirmed settlements and NID-verified business partnerships — a product of <b>${esc(BRAND.company)}</b>.</p>
      <div class="socials">${Object.entries(BRAND.socials).filter(([, u]) => u).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${k}">${icon(k)}</a>`).join('')}</div></div>
    <div><h4>Product</h4><a href="#/" data-scroll="features">Features</a><a href="#/" data-scroll="how">How it works</a><a href="#/" data-scroll="business">For business</a><a href="#/register">Create account</a></div>
    <div><h4>Company</h4><a href="#/about">About ${esc(BRAND.company)}</a><a href="#/contact">Contact & support</a><a href="#/security">Security</a></div>
    <div><h4>Legal</h4><a href="#/terms">Terms &amp; Conditions</a><a href="#/privacy">Privacy Policy</a><a href="#/cookies">Cookie Policy</a><a href="#/security">Responsible disclosure</a></div>
  </div><div class="footer-bottom"><span>© ${BRAND.year} ${esc(BRAND.company)}. All rights reserved. Expensio is a trademark of ${esc(BRAND.company)}.</span><span>Not a bank or payment provider · Made with ♥ in Bangladesh 🇧🇩</span></div></div></footer>`;
  const n = $('#nav'); const sc = () => n.classList.toggle('scrolled', scrollY > 12); addEventListener('scroll', sc, { passive: true }); sc();
  paintNavAuth();
}
function paintNavAuth() {
  const el = $('#nav-auth'); if (!el) return;
  el.innerHTML = store.user ? `<a class="btn btn-primary sm" href="#/dashboard">Open app ${icon('arrow')}</a>` : `<a class="btn btn-ghost sm hide-sm" href="#/login">Sign in</a><a class="btn btn-primary sm" href="#/register">Get started</a>`;
}
const NAV = [['dashboard', 'Dashboard', 'home'], ['groups', 'Groups', 'users'], ['business', 'Business', 'briefcase'], ['notifications', 'Notifications', 'bell'], ['settings', 'Settings', 'settings'], ['support', 'Help & support', 'help']];
function appShell() {
  const u = store.user;
  root.innerHTML = `${store.config.banner ? `<div class="banner">${esc(store.config.banner)}</div>` : ''}<div class="app">
  <aside class="sidebar"><div style="padding:6px 8px 18px">${logo()}</div>
    ${NAV.map(([p, l, i]) => `<a class="side-link" href="#/${p}" data-nav="${p}">${icon(i)}<span>${l}</span>${p === 'notifications' ? '<span class="count" data-unread hidden></span>' : ''}</a>`).join('')}
    ${u?.isStaff ? `<a class="side-link" href="#/admin" data-nav="admin">${icon('shield')}<span>Admin panel</span></a>` : ''}
    <div class="grow"></div>
    <div class="card tight row" style="gap:10px">${avatar(u)}<div class="grow"><div class="truncate" style="font-weight:700">${esc(u.name)}</div><div class="truncate faint" style="font-size:.78rem">${esc(u.email)}</div></div></div>
    <div class="row"><button class="btn btn-glass sm grow" data-theme-toggle>${icon(theme() === 'dark' ? 'sun' : 'moon')} Theme</button><button class="btn btn-glass sm grow" data-logout>${icon('logout')} Sign out</button></div></aside>
  <div class="main"><header class="topbar"><div class="hide-lg">${logo(true)}</div><h2 id="page-title" class="hide-sm grow"></h2><div class="grow hide-lg"></div>
    <button class="btn btn-primary sm hide-sm" data-add-expense>${icon('plus')} Add expense</button>
    <div style="position:relative"><button class="icon-btn" data-bell aria-label="Notifications">${icon('bell')}<i class="notif-dot" data-unread-dot hidden></i></button><div id="bell-pop"></div></div>
    <button class="icon-btn hide-lg" data-account-menu aria-label="Account menu" aria-haspopup="dialog" style="padding:0">${avatar(u, 'sm')}</button></header>
    <div id="verify-slot"></div><main id="view"></main></div>
  <nav class="tabbar" aria-label="Primary"><i class="tab-ind" id="tab-ind" aria-hidden="true"></i><a href="#/dashboard" data-nav="dashboard" data-col="0">${icon('home')}Home</a><a href="#/groups" data-nav="groups" data-col="1">${icon('users')}Groups</a>
    <button class="fab" data-add-expense aria-label="Add expense">${icon('plus')}</button>
    <a href="#/business" data-nav="business" data-col="3">${icon('briefcase')}Business</a><a href="#/settings" data-nav="settings" data-col="4">${icon('user')}Me</a></nav></div>`;
  paintVerify(); paintUnread();
}
function paintVerify() {
  const s = $('#verify-slot'); if (!s) return;
  s.innerHTML = store.user && !store.user.emailVerified ? `<div class="verify-banner">${icon('mail')}<span class="grow">Verify your email to create groups and record expenses. Check <b>${esc(store.user.email)}</b>.</span><a class="btn btn-gold sm" href="#/verify-email">Enter code</a></div>` : '';
}
function paintUnread() {
  $$('[data-unread]').forEach((e) => { e.hidden = !store.unread; e.textContent = store.unread > 9 ? '9+' : store.unread; });
  $$('[data-unread-dot]').forEach((e) => { e.hidden = !store.unread; });
}

// ───────── global delegated actions ─────────
document.addEventListener('click', (e) => {
  ripple(e);
  const t = e.target.closest('[data-theme-toggle]'); if (t) { setTheme(theme() === 'dark' ? 'light' : 'dark'); $$('[data-theme-toggle]').forEach((b) => { const ic = b.querySelector('.ico'); if (ic) ic.outerHTML = icon(theme() === 'dark' ? 'sun' : 'moon'); }); }
  if (e.target.closest('[data-reload]')) location.reload();
  if (e.target.closest('[data-print]')) window.print();
  if (e.target.closest('[data-logout]')) { closeMenu(true); signOut(); }
  const sc = e.target.closest('[data-scroll]'); if (sc) { e.preventDefault(); closeMenu(); scrollToSection(sc.dataset.scroll); }
  if (e.target.closest('[data-burger]')) openMenu('public');
  if (e.target.closest('[data-account-menu]')) openMenu('account');
  if (e.target.closest('[data-close-menu]') || e.target.classList?.contains('lg-overlay')) closeMenu();
  if (e.target.closest('[data-add-expense]')) import('./pages/groups.js').then((m) => m.quickAdd());
  if (e.target.closest('[data-bell]')) toggleBell(); else if (!e.target.closest('#bell-pop')) $('#bell-pop') && ($('#bell-pop').innerHTML = '');
  if (e.target.closest('.lg-sheet a[href]') && !e.target.closest('[data-scroll]')) closeMenu(true);
});
function scrollToSection(id) {
  const go = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (parse().path !== '/') { nav('/'); setTimeout(go, 450); } else go();
}
let menuReturnFocus = null;
const tile = (href, ico, label, i, extra = '') => `<a class="lg-link" href="${href}" style="--i:${i}" ${extra}><span class="li">${icon(ico)}</span><span>${label}</span>${icon('arrow', 'chev')}</a>`;
function menuHtml(kind) {
  const u = store.user;
  if (kind === 'account') {
    return `<div class="lg-user">${avatar(u)}<div class="grow" style="min-width:0"><div class="truncate" style="font-weight:800">${esc(u.name)}</div><div class="truncate faint" style="font-size:.8rem">${esc(u.email)}</div></div></div>
    <div class="lg-list">${tile('#/settings', 'settings', 'Profile & settings', 0)}${tile('#/invitations', 'mail', 'Invitations', 1)}
      <a class="lg-link" href="#/notifications" style="--i:2"><span class="li">${icon('bell')}</span><span>Notifications</span>${store.unread ? `<span class="count">${store.unread > 9 ? '9+' : store.unread}</span>` : icon('arrow', 'chev')}</a>
      ${tile('#/support', 'help', 'Help & support', 3)}${u.isStaff ? tile('#/admin', 'shield', 'Admin panel', 4) : ''}</div>
    <div class="lg-actions"><button class="btn btn-glass" data-theme-toggle>${icon(theme() === 'dark' ? 'sun' : 'moon')} Theme</button><button class="btn btn-danger" data-logout>${icon('logout')} Sign out</button></div>`;
  }
  return `<div class="lg-list">${[['sparkle', 'Features', 'features'], ['zap', 'How it works', 'how'], ['briefcase', 'Business', 'business'], ['help', 'FAQ', 'faq']].map(([i, l, id], k) => `<a class="lg-link" href="#/" data-scroll="${id}" style="--i:${k}"><span class="li">${icon(i)}</span><span>${l}</span>${icon('arrow', 'chev')}</a>`).join('')}${tile('#/about', 'building', 'About us', 4)}${tile('#/contact', 'mail', 'Contact', 5)}</div>
    <div class="lg-actions ${store.user ? 'one' : ''}"><button class="btn btn-glass" data-theme-toggle>${icon(theme() === 'dark' ? 'sun' : 'moon')} Theme</button>${store.user ? '<a class="btn btn-primary" href="#/dashboard">Open app</a>' : '<a class="btn btn-glass" href="#/login">Sign in</a>'}</div>${store.user ? '' : '<a class="btn btn-primary lg block" href="#/register" style="margin-top:8px;border-radius:20px">Get started free</a>'}`;
}
function openMenu(kind = 'public') {
  if ($('.lg-overlay')) return closeMenu();
  menuReturnFocus = document.activeElement;
  const o = document.createElement('div'); o.className = 'lg-overlay';
  o.innerHTML = `<div class="lg-sheet liquid" role="dialog" aria-modal="true" aria-label="${kind === 'account' ? 'Account menu' : 'Site menu'}"><div class="lg-head">${logo(true)}<button class="lg-close" data-close-menu aria-label="Close menu">${icon('x')}</button></div>${menuHtml(kind)}</div>`;
  document.body.appendChild(o); document.body.style.overflow = 'hidden';
  $('[data-burger]')?.setAttribute('aria-expanded', 'true');
  $('[data-close-menu]', o).focus({ preventScroll: true });
}
function closeMenu(immediate = false) {
  const o = $('.lg-overlay'); if (!o) return;
  const done = () => { o.remove(); if (!$('.overlay')) document.body.style.overflow = ''; $('[data-burger]')?.setAttribute('aria-expanded', 'false'); try { menuReturnFocus?.focus({ preventScroll: true }); } catch (e) { /* element gone */ } };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
  o.classList.add('out'); setTimeout(done, 260);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
// Liquid-glass specular highlight follows the finger / pointer.
document.addEventListener('pointermove', (e) => { const g = e.target.closest?.('.liquid'); if (!g) return; const r = g.getBoundingClientRect(); g.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`); g.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`); }, { passive: true });
function setTabIndicator() {
  const ind = $('#tab-ind'); if (!ind) return; const on = $('.tabbar a.on'); const prev = ind.dataset.col;
  if (!on) { ind.style.setProperty('--on', 0); return; }
  ind.style.setProperty('--on', 1); ind.style.setProperty('--i', on.dataset.col);
  if (prev !== undefined && prev !== on.dataset.col) { ind.classList.add('moving'); setTimeout(() => ind.classList.remove('moving'), 330); }
  ind.dataset.col = on.dataset.col;
}

async function toggleBell() {
  const pop = $('#bell-pop'); if (pop.innerHTML) { pop.innerHTML = ''; return; }
  pop.innerHTML = `<div class="popover glass"><div class="skeleton" style="height:60px"></div></div>`;
  try {
    const d = await api.get('/notifications');
    pop.innerHTML = `<div class="popover glass"><div class="row between" style="padding:8px 10px"><b>Notifications</b><button class="btn btn-ghost sm" data-readall>Mark all read</button></div>
      ${d.notifications.slice(0, 8).map((n) => `<div class="notif-item ${n.read ? '' : 'unread'}" data-nid="${n.id}" data-link="${esc(n.link || '')}"><div class="grow"><b>${esc(n.title)}</b><div class="muted" style="font-size:.85rem">${esc(n.body || '')}</div><div class="faint" style="font-size:.74rem">${ago(n.createdAt)}</div></div></div>`).join('') || '<p class="muted center" style="padding:24px">You’re all caught up 🎉</p>'}
      <a class="btn btn-glass sm block" href="#/notifications" style="margin-top:6px">See all</a></div>`;
    on(pop, 'click', '[data-readall]', async () => { await api.post('/notifications/read-all'); store.unread = 0; paintUnread(); pop.innerHTML = ''; });
    on(pop, 'click', '[data-nid]', async (_e, el) => { api.post(`/notifications/${el.dataset.nid}/read`).catch(() => { }); store.unread = Math.max(0, store.unread - (el.classList.contains('unread') ? 1 : 0)); paintUnread(); pop.innerHTML = ''; if (el.dataset.link) nav(el.dataset.link); });
  } catch (err) { pop.innerHTML = ''; toast(err.message, 'bad'); }
}

// ───────── realtime ─────────
let es; let poll;
async function startRealtime() {
  stopRealtime(); if (!store.user) return;
  const refreshCount = async () => { try { const d = await api.get('/notifications/unread-count'); store.unread = d.unread; paintUnread(); } catch { /* ignore */ } };
  refreshCount(); poll = setInterval(refreshCount, 60000);
  try {
    const { ticket } = await api.post('/notifications/stream-ticket');
    es = new EventSource(`/api/v1/notifications/stream?ticket=${ticket}`);
    es.addEventListener('notification', (ev) => { const n = JSON.parse(ev.data); store.unread += 1; paintUnread(); toast(`🔔 ${n.title}`, 'info', 5000); window.dispatchEvent(new CustomEvent('ex:notification', { detail: n })); });
    es.onerror = () => { es.close(); es = null; };
  } catch { /* polling continues */ }
}
function stopRealtime() { es?.close(); es = null; clearInterval(poll); }

export async function signOut(silent) {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  setToken(null); store.user = null; store.unread = 0; stopRealtime(); layout = null;
  if (!silent) toast('Signed out. See you soon 👋', 'info');
  nav('/');
}
export function setSession(d) { setToken(d.accessToken); store.user = d.user; emit(); startRealtime(); }
window.addEventListener('ex:signedout', () => { if (store.user) { store.user = null; layout = null; stopRealtime(); toast('Your session expired. Please sign in again.', 'bad'); nav('/login'); } });
window.addEventListener('ex:maintenance', () => toast('Expensio is in maintenance mode. Back shortly!', 'bad'));
window.addEventListener('hashchange', render);
export const refreshUser = async () => { const d = await api.get('/me'); store.user = d.user; paintVerify(); return d.user; };

// ───────── render ─────────
async function render() {
  const my = ++token; cleanup?.(); cleanup = null; closeMenu(true);
  const { path, query } = parse();
  let match = null; let params = {};
  for (const r of routes) { const m = path.match(r.re); if (m) { match = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; } }
  if (!match) match = { auth: 'any', layout: 'public', loader: () => import('./pages/info.js').then((m) => ({ default: m.notFound })) };
  if (match.auth === 'guest' && store.user) return nav('/dashboard');
  if ((match.auth === 'user' || match.auth === 'staff') && !store.user) return nav(`/login?next=${encodeURIComponent(path)}`);
  if (match.auth === 'staff' && !store.user.isStaff) return nav('/dashboard');
  const want = match.layout;
  if (layout !== want) { layout = want; want === 'app' ? appShell() : publicShell(); }
  else if (want === 'public') paintNavAuth();
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', path === `/${a.dataset.nav}` || path.startsWith(`/${a.dataset.nav}/`))); setTabIndicator();
  const view = $('#view'); window.scrollTo({ top: 0 });
  view.innerHTML = '<div class="page"><div class="skeleton" style="height:120px;margin-bottom:16px"></div><div class="skeleton" style="height:240px"></div></div>';
  try {
    const mod = await match.loader();
    const page = await mod.default({ params, query, user: store.user, nav });
    if (my !== token) return;
    view.innerHTML = `<div class="${want === 'app' ? 'page' : 'view-in'}">${page.html}</div>`;
    const pt = $('#page-title'); if (pt) pt.textContent = page.title || '';
    document.title = `${page.title ? `${page.title} · ` : ''}Expensio — ${BRAND.company}`;
    cleanup = (await page.mount?.(view)) || null; revealOnScroll(view);
  } catch (e) {
    if (my !== token) return;
    console.error(e);
    view.innerHTML = `<div class="page"><div class="card empty"><span class="big">😵</span><h3>Couldn’t load this page</h3><p class="muted">${esc(e.message || 'Unexpected error')}</p><button class="btn btn-primary" data-reload>Reload</button></div></div>`;
  }
}

// ───────── boot ─────────
(async function boot() {
  try {
    const cfg = await api.get('/config'); store.config = cfg; setCurrencies(cfg.currencies);
  } catch (e) { console.warn('config failed', e); }
  try { const d = await refresh(); if (d) { store.user = d.user; startRealtime(); } } catch { /* signed out */ }
  await render();
  document.getElementById('splash')?.classList.add('gone'); setTimeout(() => document.getElementById('splash')?.remove(), 600);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => { });
})();
