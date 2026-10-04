import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { icon, esc, money, firstName, animateNumbers, CAT, GROUP_CATS, empty, skeletons, toast, $ } from '../core/ui.js';
import { refreshUser } from '../app.js';

const COLORS = ['#1fc2bc', '#6d7bff', '#ff7ab6', '#f2c15b', '#34d399', '#fb923c', '#a78bfa', '#38bdf8'];

export default async function dashboard({ user }) {
  const [g, a, inv] = await Promise.all([api.get('/groups'), api.get('/analytics/overview').catch(() => null), user.emailVerified ? api.get('/invitations').catch(() => ({ invitations: [] })) : { invitations: [] }]);
  const groups = g.groups.filter((x) => x.status === 'active');
  const byCur = {};
  for (const x of groups) { const c = (byCur[x.baseCurrency] ||= { owed: 0, owe: 0 }); if (x.myNetMinor > 0) c.owed += x.myNetMinor; else c.owe += -x.myNetMinor; }
  const curs = Object.keys(byCur); if (!curs.length) curs.push(user.baseCurrency || 'BDT');
  const steps = [['Verify your email', user.emailVerified, '#/verify-email'], ['Create your first group', groups.length > 0, '#/groups'], ['Add your first expense', groups.some((x) => x.expenseCount > 0), '#/groups']];
  const showOnboard = !steps.every((s) => s[1]);
  const alerts = [];
  if (a?.pendingConfirmations) alerts.push(`<a class="card tight hover row" href="#/groups" style="gap:12px">${icon('check', 'money-pos')}<div class="grow"><b>${a.pendingConfirmations} payment${a.pendingConfirmations > 1 ? 's' : ''} waiting for your confirmation</b><div class="muted" style="font-size:.85rem">Open the group to confirm or decline.</div></div>${icon('arrow')}</a>`);
  if (inv.invitations.length) alerts.push(`<a class="card tight hover row" href="#/invitations" style="gap:12px">${icon('mail', 'money-pos')}<div class="grow"><b>${inv.invitations.length} pending invitation${inv.invitations.length > 1 ? 's' : ''}</b><div class="muted" style="font-size:.85rem">Join a group or business.</div></div>${icon('arrow')}</a>`);
  const cs = a?.currencies || [];
  const analytics = (c) => {
    const total = c.categories.reduce((s, x) => s + x.amountMinor, 0) || 1; let acc = 0;
    const grad = c.categories.map((x, i) => { const from = (acc / total) * 100; acc += x.amountMinor; return `${COLORS[i % 8]} ${from}% ${(acc / total) * 100}%`; }).join(',');
    const max = Math.max(...c.trend.map((t) => t.amountMinor), 1);
    return `<div class="grid g2"><div class="card"><h3>Spending by category</h3><div class="row wrap" style="gap:22px;justify-content:center"><div class="donut" style="background:conic-gradient(${grad || 'var(--glass-2) 0 100%'})"><div class="mid"><div class="faint" style="font-size:.7rem">6 MONTHS</div>${money(c.spent6mMinor, c.currency, { compact: true })}</div></div>
      <div class="stack-sm grow" style="min-width:150px">${c.categories.slice(0, 6).map((x, i) => `<div class="row" style="font-size:.88rem"><i style="width:10px;height:10px;border-radius:3px;background:${COLORS[i % 8]}"></i><span class="grow">${CAT[x.category]?.[0] || '📦'} ${CAT[x.category]?.[1] || x.category}</span><b class="mono">${money(x.amountMinor, c.currency, { compact: true })}</b></div>`).join('')}</div></div></div>
    <div class="card"><h3>Monthly trend</h3><div class="bars">${c.trend.map((t) => `<div class="bar"><span class="mono">${t.amountMinor ? money(t.amountMinor, c.currency, { compact: true }) : ''}</span><i style="height:${Math.max(3, (t.amountMinor / max) * 100)}%"></i><span>${new Date(`${t.month}-01`).toLocaleDateString('en-GB', { month: 'short' })}</span></div>`).join('')}</div></div></div>
    <div class="card row wrap glow" style="gap:18px"><span style="font-size:2.2rem">✨</span><div class="grow"><b>Your monthly recap</b><div class="muted">This month you’ve spent <b class="mono">${money(c.spentThisMonthMinor, c.currency)}</b>${c.topCategory ? ` — mostly on ${CAT[c.topCategory]?.[1] || c.topCategory} ${CAT[c.topCategory]?.[0] || ''}` : ''}. You’ve settled <b>${a.settledCount}</b> payment${a.settledCount === 1 ? '' : 's'} so far.</div></div></div>`;
  };
  const html = `<div class="stack" style="gap:22px">
    <div><h1 style="font-size:clamp(1.7rem,4vw,2.4rem);margin-bottom:4px">Hi ${esc(firstName(user.name))} <span class="wave" style="display:inline-block">👋</span></h1><p class="muted" style="margin:0">Here’s where your shared money stands.</p></div>
    ${alerts.length ? `<div class="grid g2">${alerts.join('')}</div>` : ''}
    <div class="grid g2">${curs.map((c, i) => { const v = byCur[c] || { owed: 0, owe: 0 }; const net = v.owed - v.owe; return `<div class="card balance-hero glow reveal in" style="--i:${i}"><div class="faint" style="font-weight:700;font-size:.8rem;letter-spacing:.08em">NET BALANCE · ${c}</div><div class="v mono ${net >= 0 ? 'money-pos' : 'money-neg'}" data-count="${net}" data-cur="${c}">${money(0, c)}</div>
      <div class="row wrap" style="margin-top:14px;gap:18px"><div class="kpi"><span class="l">You’re owed</span><b class="mono money-pos">${money(v.owed, c)}</b></div><div class="kpi"><span class="l">You owe</span><b class="mono money-neg">${money(v.owe, c)}</b></div></div></div>`; }).join('')}</div>
    ${showOnboard ? `<div class="card"><div class="row between"><h3 style="margin:0">🚀 Get started</h3><span class="badge info">${steps.filter((s) => s[1]).length}/3</span></div><div class="onboard" style="margin-top:14px">${steps.map(([t, d, h], i) => `<a href="${h}" class="ob-step ${d ? 'done' : ''}" style="text-decoration:none;color:inherit"><span class="n">${d ? '✓' : i + 1}</span><b class="grow">${t}</b>${d ? '' : icon('arrow')}</a>`).join('')}</div></div>` : ''}
    <div><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">Your groups</h3><a href="#/groups" style="font-weight:700">View all</a></div>
    ${groups.length ? `<div class="grid g3">${groups.slice(0, 6).map((x) => `<a class="card hover group-card" href="#/groups/${x.id}" style="text-decoration:none;color:inherit"><div class="row"><div class="group-emoji">${esc(x.emoji)}</div><div class="grow truncate"><b>${esc(x.name)}</b><div class="muted" style="font-size:.82rem">${GROUP_CATS[x.category]?.[1] || ''} · ${x.memberCount} members</div></div></div>
      <div class="row between"><span class="faint" style="font-size:.8rem;font-weight:700">${x.myNetMinor === 0 ? 'ALL SETTLED' : x.myNetMinor > 0 ? 'YOU’RE OWED' : 'YOU OWE'}</span><b class="mono ${x.myNetMinor > 0 ? 'money-pos' : x.myNetMinor < 0 ? 'money-neg' : ''}">${x.myNetMinor === 0 ? '✓' : money(Math.abs(x.myNetMinor), x.baseCurrency)}</b></div></a>`).join('')}</div>`
      : `<div class="card">${empty('🧳', 'No groups yet', 'Create a group for your next trip, home or event and invite your people.', '<a class="btn btn-primary" href="#/groups">Create your first group</a>')}</div>`}</div>
    ${cs.length ? `<div class="stack" style="gap:18px"><div class="row between wrap"><h3 style="margin:0">Insights</h3>${cs.length > 1 ? `<div class="pill-tabs" id="cur-tabs">${cs.map((c, i) => `<button class="chip ${i ? '' : 'on'}" data-c="${c.currency}">${c.currency}</button>`).join('')}</div>` : ''}</div><div id="analytics">${analytics(cs[0])}</div></div>` : ''}
  </div>`;
  return { title: 'Dashboard', html, mount(root) {
    animateNumbers(root);
    $('#cur-tabs', root)?.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; root.querySelectorAll('#cur-tabs .chip').forEach((x) => x.classList.toggle('on', x === b)); $('#analytics', root).innerHTML = analytics(cs.find((c) => c.currency === b.dataset.c)); });
    const w = $('.wave', root); if (w) w.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(18deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(0)' }], { duration: 1400, delay: 400 });
    if (!user.emailVerified) refreshUser().catch(() => {});
  } };
}
