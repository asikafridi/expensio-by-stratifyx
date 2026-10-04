import { api, download } from '../core/api.js';
import { store } from '../core/store.js';
import { $, $$, on, icon, esc, money, toMajor, dateFmt, ago, avatar, toast, modal, confirmBox, withBtn, btnHtml, fieldErrors, confetti, CAT, GROUP_CATS, empty, currencies, animateNumbers } from '../core/ui.js';
import { nav } from '../app.js';

const EMOJIS = ['🧳', '🏖️', '🏔️', '🏠', '🎊', '🍕', '🎓', '💼', '🚗', '🎮', '⚽', '🛶'];
const METHODS = ['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank', 'Cash', 'Other'];
const curOptions = (sel) => Object.entries(currencies()).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k} — ${esc(v.name || k)}</option>`).join('');

// ───────────────────────── list ─────────────────────────
export async function list() {
  const { groups } = await api.get('/groups');
  let filter = 'active';
  const card = (x) => `<a class="card hover group-card reveal" href="#/groups/${x.id}" style="text-decoration:none;color:inherit"><div class="row"><div class="group-emoji">${esc(x.emoji)}</div><div class="grow truncate"><b style="font-size:1.05rem">${esc(x.name)}</b><div class="muted" style="font-size:.82rem">${GROUP_CATS[x.category]?.[1] || ''} · ${x.memberCount} members · ${x.expenseCount} expenses</div></div>${x.status === 'archived' ? '<span class="badge">Archived</span>' : ''}</div>
    <div class="row between"><div><div class="faint" style="font-size:.72rem;font-weight:700">TOTAL SPENT</div><b class="mono">${money(x.totalMinor, x.baseCurrency)}</b></div><div style="text-align:right"><div class="faint" style="font-size:.72rem;font-weight:700">${x.myNetMinor === 0 ? 'STATUS' : x.myNetMinor > 0 ? 'YOU’RE OWED' : 'YOU OWE'}</div><b class="mono ${x.myNetMinor > 0 ? 'money-pos' : x.myNetMinor < 0 ? 'money-neg' : ''}">${x.myNetMinor === 0 ? 'Settled ✓' : money(Math.abs(x.myNetMinor), x.baseCurrency)}</b></div></div></a>`;
  const html = `<div class="stack" style="gap:20px"><div class="row between wrap"><div class="pill-tabs" id="gf"><button class="chip on" data-f="active">Active</button><button class="chip" data-f="archived">Archived</button></div><button class="btn btn-primary" id="new">${icon('plus')} New group</button></div><div id="gl" class="grid g3"></div></div>`;
  return {
    title: 'Groups', html, mount(root) {
      const paint = () => { const l = groups.filter((x) => x.status === filter); $('#gl', root).innerHTML = l.length ? l.map(card).join('') : `<div class="card" style="grid-column:1/-1">${empty(filter === 'active' ? '🧳' : '🗄️', filter === 'active' ? 'No groups yet' : 'Nothing archived', filter === 'active' ? 'Create a group to start splitting expenses with friends.' : 'Archived groups will appear here.', filter === 'active' ? '<button class="btn btn-primary" data-new>Create a group</button>' : '')}</div>`; requestAnimationFrame(() => $$('.reveal', root).forEach((e) => e.classList.add('in'))); };
      paint();
      on(root, 'click', '[data-f]', (_e, b) => { filter = b.dataset.f; $$('#gf .chip', root).forEach((c) => c.classList.toggle('on', c === b)); paint(); });
      root.addEventListener('click', (e) => { if (e.target.closest('#new') || e.target.closest('[data-new]')) createGroupModal(); });
    }
  };
}

function createGroupModal() {
  if (!store.user.emailVerified) return toast('Verify your email to create groups.', 'bad');
  modal({
    title: 'New group', body: `<form class="stack" id="gf" novalidate><div class="field"><label>Pick an emoji</label><div class="row wrap" id="em">${EMOJIS.map((e, i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-e="${e}" style="font-size:1.3rem;padding:6px 10px">${e}</button>`).join('')}</div></div>
    <div class="field"><label for="n">Group name</label><input class="input" id="n" name="name" placeholder="e.g. Cox’s Bazar Trip" required maxlength="80"></div>
    <div class="form-grid two"><div class="field"><label>Type</label><select class="input" name="category">${Object.entries(GROUP_CATS).map(([k, [e, l]]) => `<option value="${k}">${e} ${l}</option>`).join('')}</select></div><div class="field"><label>Currency</label><select class="input" name="baseCurrency">${curOptions(store.user.baseCurrency)}</select></div></div>
    <div class="field"><label>Description (optional)</label><input class="input" name="description" maxlength="300"></div>
    <label class="check"><input type="checkbox" name="simplifyDebts" checked><span>Simplify debts — suggest the fewest payments to settle everyone.</span></label>${btnHtml('Create group', 'btn-primary block lg', 'type="submit"')}</form>`,
    onMount: (m) => {
      let emoji = EMOJIS[0]; on(m.el, 'click', '[data-e]', (_e, b) => { emoji = b.dataset.e; $$('[data-e]', m.el).forEach((x) => x.classList.toggle('on', x === b)); });
      $('#gf', m.el).addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target; fieldErrors(f);
        try { const d = await withBtn($('button[type=submit]', f), () => api.post('/groups', { name: f.elements.name.value, emoji, category: f.category.value, baseCurrency: f.baseCurrency.value, description: f.description.value, simplifyDebts: f.simplifyDebts.checked })); m.close(); confetti(60); nav(`/groups/${d.id}`); } catch (err) { if (err.details) fieldErrors(f, err.details); else toast(err.message, 'bad'); }
      });
    }
  });
}

export async function quickAdd() {
  if (!store.user.emailVerified) return toast('Verify your email first.', 'bad');
  const { groups } = await api.get('/groups'); const act = groups.filter((g) => g.status === 'active');
  if (!act.length) { toast('Create a group first 🙂', 'info'); return nav('/groups'); }
  if (act.length === 1) return openExpense(act[0].id);
  modal({ title: 'Add expense to…', body: `<div class="stack-sm">${act.map((g) => `<button class="card tight hover row" data-g="${g.id}" style="width:100%;text-align:left;cursor:pointer;color:inherit"><span class="group-emoji" style="width:42px;height:42px;font-size:1.3rem">${esc(g.emoji)}</span><b class="grow">${esc(g.name)}</b>${icon('arrow')}</button>`).join('')}</div>`, onMount: (m) => on(m.el, 'click', '[data-g]', (_e, b) => { m.close(); openExpense(b.dataset.g); }) });
}
async function openExpense(gid) {
  const d = await api.get(`/groups/${gid}`);
  expenseModal(d, null, () => { if (location.hash === `#/groups/${gid}`) window.dispatchEvent(new HashChangeEvent('hashchange')); else nav(`/groups/${gid}`); });
}

// ───────────────────────── detail ─────────────────────────
export async function detail({ params, user }) {
  let D = await api.get(`/groups/${params.id}`);
  let tab = 'expenses'; let expenses = []; let page = 1; let pages = 1; let query = ''; let cat = '';
  const name = (id) => D.members.find((m) => m.id === id)?.name || 'Someone';
  const mem = (id) => D.members.find((m) => m.id === id);
  const active = () => D.members.filter((m) => m.active);
  const base = () => D.group.baseCurrency; const archived = () => D.group.status === 'archived';
  const isAdmin = () => D.myRole === 'admin';
  const myNet = () => D.balances.net.find((n) => n.userId === user.id)?.amountMinor || 0;

  const head = () => `<div class="card pad-lg glow"><div class="row wrap" style="gap:18px"><div class="group-emoji" style="width:68px;height:68px;font-size:2.2rem">${esc(D.group.emoji)}</div>
    <div class="grow"><div class="row wrap" style="gap:8px"><h2 style="margin:0;font-size:1.7rem">${esc(D.group.name)}</h2>${archived() ? '<span class="badge">Archived</span>' : ''}</div><div class="muted">${GROUP_CATS[D.group.category]?.[1] || ''}${D.group.destination ? ` · ${esc(D.group.destination)}` : ''} · ${base()}</div><div class="avatars" style="margin-top:10px">${active().slice(0, 7).map((m) => avatar(m, 'sm')).join('')}${active().length > 7 ? `<span class="avatar sm" style="--c:var(--glass-hi)">+${active().length - 7}</span>` : ''}</div></div>
    <div class="row wrap">${archived() ? '' : `<button class="btn btn-primary" data-add>${icon('plus')} Add expense</button><button class="btn btn-glass" data-invite>${icon('users')} Invite</button>`}</div></div>
    <div class="grid g3" style="margin-top:20px;gap:12px"><div class="kpi"><span class="l">Total spent</span><b class="v mono" data-count="${D.balances.totalMinor}" data-cur="${base()}">${money(0, base())}</b></div>
    <div class="kpi"><span class="l">${myNet() === 0 ? 'Your balance' : myNet() > 0 ? 'You’re owed' : 'You owe'}</span><b class="v mono ${myNet() > 0 ? 'money-pos' : myNet() < 0 ? 'money-neg' : ''}">${myNet() === 0 ? 'Settled ✓' : money(Math.abs(myNet()), base())}</b></div>
    <div class="kpi"><span class="l">Members</span><b class="v">${active().length}</b></div></div></div>
    <div class="tabs" id="tabs">${[['expenses', 'receipt', 'Expenses'], ['settle', 'zap', 'Settle up'], ['members', 'users', 'Members'], ['activity', 'refresh', 'Activity']].map(([k, i, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${icon(i)}${l}${k === 'settle' && D.balances.pending.length ? ` <span class="badge warn">${D.balances.pending.length}</span>` : ''}</button>`).join('')}</div><div id="tabbody"></div>`;

  const expRow = (e) => {
    const paidBy = e.paid.map((p) => name(p.userId)).join(', '); const mine = e.owed.find((o) => o.userId === user.id); return `<div class="expense-row" data-eid="${e.id}"><div class="cat-ico">${CAT[e.category]?.[0] || '🧾'}</div><div class="grow truncate"><b>${esc(e.title)}${e.recurring ? ` <span class="badge info">${icon('repeat')} recurring</span>` : ''}</b><div class="muted truncate" style="font-size:.82rem">${esc(paidBy)} paid · ${dateFmt(e.date, { day: 'numeric', month: 'short' })} · ${e.splitType}</div></div>
    <div style="text-align:right"><b class="mono">${money(e.amountMinor, e.currency)}</b>${e.currency !== e.baseCurrency ? `<div class="faint mono" style="font-size:.74rem">≈ ${money(e.baseAmountMinor, e.baseCurrency)}</div>` : ''}<div style="font-size:.76rem;font-weight:700" class="${mine ? 'money-neg' : 'faint'}">${mine ? `your share ${money(mine.amountMinor, e.baseCurrency)}` : 'not involved'}</div></div></div>`;
  };

  async function loadExpenses(reset = true) {
    if (reset) { page = 1; expenses = []; }
    const d = await api.get(`/groups/${D.group.id}/expenses?page=${page}&q=${encodeURIComponent(query)}&category=${cat}`); expenses = reset ? d.expenses : [...expenses, ...d.expenses]; pages = d.pages;
  }
  const paintExpenses = (root) => {
    $('#tabbody', root).innerHTML = `<div class="card"><div class="row wrap" style="margin-bottom:12px"><div class="grow" style="min-width:160px;position:relative"><input class="input" id="q" placeholder="Search expenses…" value="${esc(query)}" style="padding-left:40px"><span style="position:absolute;left:13px;top:13px;color:var(--faint)">${icon('search')}</span></div><select class="input" id="cat" style="width:auto"><option value="">All categories</option>${Object.entries(CAT).map(([k, [e, l]]) => `<option value="${k}" ${cat === k ? 'selected' : ''}>${e} ${l}</option>`).join('')}</select>
      <button class="btn btn-glass sm" data-export>${icon('download')} CSV</button><button class="btn btn-glass sm" data-print>${icon('file')} Print / PDF</button>${archived() ? '' : `<button class="btn btn-glass sm" data-recurring>${icon('repeat')} Recurring</button>`}</div>
      ${expenses.length ? expenses.map(expRow).join('') + (page < pages ? '<button class="btn btn-glass block" data-more style="margin-top:12px">Load more</button>' : '') : empty('🧾', 'No expenses yet', archived() ? 'This group is archived.' : 'Add the first expense and Expensio does the maths.', archived() ? '' : '<button class="btn btn-primary" data-add>Add expense</button>')}</div>`;
  };

  const paintSettle = (root) => {
    const b = D.balances; const settled = b.net.every((n) => n.amountMinor === 0) && b.totalMinor > 0;
    const mineActions = (p) => (p.from === user.id || p.to === user.id) && !archived();
    $('#tabbody', root).innerHTML = `<div class="stack" style="gap:18px">
    ${settled ? `<div class="card center glow"><span class="big-emoji">🎉</span><h3>Everyone’s settled up!</h3><p class="muted" style="margin:0">No balances left in this group.</p></div>` : ''}
    ${b.pending.length ? `<div class="card"><h3>⏳ Awaiting confirmation</h3>${b.pending.map((p) => { const from = String(p.from); const to = String(p.to); const mineToConfirm = String(p.createdBy) !== user.id && (from === user.id || to === user.id); const creator = String(p.createdBy) === user.id; return `<div class="plan-row" style="margin-top:10px">${avatar(mem(from), 'sm')}<b>${esc(name(from))}</b><span class="arrow">${icon('arrow')}</span>${avatar(mem(to), 'sm')}<b>${esc(name(to))}</b><span class="grow"></span><b class="mono">${money(p.amountMinor, base())}</b><span class="badge">${esc(p.method)}${p.reference ? ` · ${esc(p.reference)}` : ''}</span>${mineToConfirm ? `<button class="btn btn-good sm" data-st="confirm" data-id="${p._id}">${icon('check')} Confirm</button><button class="btn btn-danger sm" data-st="reject" data-id="${p._id}">Decline</button>` : creator ? `<button class="btn btn-ghost sm" data-st="cancel" data-id="${p._id}">Cancel</button>` : ''}</div>`; }).join('')}</div>` : ''}
    <div class="card"><div class="row between wrap"><h3 style="margin:0">⚡ ${D.group.simplifyDebts ? 'Simplified settlement plan' : 'Who owes whom'}</h3>${isAdmin() && !archived() ? `<label class="row" style="gap:8px;font-size:.85rem" class="muted"><span class="switch"><input type="checkbox" id="simp" ${D.group.simplifyDebts ? 'checked' : ''}><span></span></span>Simplify</label>` : ''}</div>
    ${b.plan.length ? b.plan.map((p) => `<div class="plan-row" style="margin-top:10px">${avatar(mem(p.from), 'sm')}<b>${esc(name(p.from))}</b><span class="arrow">${icon('arrow')}</span>${avatar(mem(p.to), 'sm')}<b>${esc(name(p.to))}</b><span class="grow"></span><b class="mono">${money(p.amountMinor, base())}</b>${mineActions(p) ? `<button class="btn btn-primary sm" data-pay data-from="${p.from}" data-to="${p.to}" data-amt="${p.amountMinor}">${p.from === user.id ? 'Pay' : 'Record received'}</button>${p.to === user.id ? `<button class="btn btn-glass sm" data-remind="${p.from}">${icon('bell')} Remind</button>` : ''}` : ''}</div>`).join('') : '<p class="muted" style="margin:14px 0 0">Nothing to settle right now. ✨</p>'}</div>
    <div class="card"><h3>Balances</h3>${b.net.map((n) => `<div class="list-item">${avatar(mem(n.userId))}<b class="grow">${esc(name(n.userId))}${n.userId === user.id ? ' <span class="badge info">You</span>' : ''}</b><b class="mono ${n.amountMinor > 0 ? 'money-pos' : n.amountMinor < 0 ? 'money-neg' : 'faint'}">${n.amountMinor === 0 ? 'settled' : `${n.amountMinor > 0 ? 'gets' : 'owes'} ${money(Math.abs(n.amountMinor), base())}`}</b></div>`).join('')}</div>
    <div class="card"><h3>Payment history</h3><div id="hist"><div class="skeleton" style="height:60px"></div></div></div></div>`;
    api.get(`/groups/${D.group.id}/settlements`).then(({ settlements }) => { const h = settlements.filter((s) => s.status !== 'pending'); const el = $('#hist', root); if (!el) return; el.innerHTML = h.length ? h.map((s) => `<div class="list-item"><div class="grow"><b>${esc(name(s.from))} → ${esc(name(s.to))}</b><div class="muted" style="font-size:.8rem">${esc(s.method)}${s.reference ? ` · ${esc(s.reference)}` : ''} · ${ago(s.respondedAt || s.createdAt)}</div></div><b class="mono">${money(s.amountMinor, base())}</b><span class="badge ${s.status === 'confirmed' ? 'good' : 'bad'}">${s.status}</span></div>`).join('') : '<p class="muted">No payments recorded yet.</p>'; });
  };

  const paintMembers = (root) => {
    $('#tabbody', root).innerHTML = `<div class="grid g2"><div class="card"><div class="row between"><h3 style="margin:0">Members</h3>${archived() ? '' : `<button class="btn btn-primary sm" data-invite>${icon('plus')} Invite by email</button>`}</div>
      ${active().map((m) => `<div class="list-item">${avatar(m)}<div class="grow truncate"><b>${esc(m.name)}</b> ${m.id === user.id ? '<span class="badge info">You</span>' : ''}<div class="muted truncate" style="font-size:.8rem">${esc(m.email || '')}${m.banking?.provider ? ` · ${esc(m.banking.provider)} ${esc(m.banking.number || '')}` : ''}</div></div><span class="badge ${m.role === 'admin' ? 'warn' : ''}">${m.role}</span>
      ${(isAdmin() || m.id === user.id) ? `<button class="btn btn-ghost sm" data-rm="${m.id}" title="${m.id === user.id ? 'Leave' : 'Remove'}">${icon(m.id === user.id ? 'logout' : 'trash')}</button>` : ''}</div>`).join('')}
      ${D.invites.length ? `<hr><div class="lbl">PENDING INVITES</div>${D.invites.map((i) => `<div class="list-item"><span class="cat-ico">✉️</span><div class="grow truncate">${esc(i.email)}<div class="faint" style="font-size:.76rem">expires ${dateFmt(i.expiresAt)}</div></div>${isAdmin() ? `<button class="btn btn-ghost sm" data-revoke="${i._id}">${icon('x')}</button>` : ''}</div>`).join('')}` : ''}</div>
      <div class="card"><h3>Group settings</h3>${isAdmin() ? `<form class="stack" id="gs" novalidate><div class="field"><label>Name</label><input class="input" name="name" value="${esc(D.group.name)}"></div><div class="field"><label>Description</label><input class="input" name="description" value="${esc(D.group.description || '')}"></div>${btnHtml('Save changes', 'btn-glass', 'type="submit"')}</form><hr><button class="btn ${archived() ? 'btn-good' : 'btn-danger'} block" data-archive>${archived() ? 'Restore group' : 'Archive group'}</button>` : '<p class="muted">Only group admins can change settings.</p>'}</div></div>`;
  };
  const paintActivity = async (root) => {
    $('#tabbody', root).innerHTML = '<div class="card"><div class="skeleton" style="height:200px"></div></div>';
    const { events } = await api.get(`/groups/${D.group.id}/activity`);
    const label = { expense_added: '🧾 added', expense_edited: '✏️ updated', expense_deleted: '🗑️ deleted', settlement_confirmed: '✅ confirmed payment', settlement_pending: '⏳ requested payment', settlement_rejected: '❌ declined payment', settlement_cancelled: '↩️ cancelled payment' };
    $('#tabbody', root).innerHTML = `<div class="card"><div class="timeline">${events.map((e) => `<div class="tl-item"><div><b>${esc(e.actor)}</b> ${label[e.type] || e.type} <b>${esc(e.text)}</b> · <span class="mono">${money(e.amountMinor, e.currency)}</span></div><div class="faint" style="font-size:.78rem">${ago(e.at)}</div></div>`).join('') || '<p class="muted">No activity yet.</p>'}</div></div>`;
  };

  const html = `<div class="stack" style="gap:20px" id="gd">${head()}</div>`;
  return {
    title: D.group.name, html, async mount(root) {
      const paint = async () => { if (tab === 'expenses') paintExpenses(root); else if (tab === 'settle') paintSettle(root); else if (tab === 'members') paintMembers(root); else await paintActivity(root); };
      const reload = async (keepTab = true) => { D = await api.get(`/groups/${D.group.id}`); await loadExpenses(); $('#gd', root).innerHTML = head(); animateNumbers(root); if (!keepTab) tab = 'expenses'; await paint(); if (D.balances.totalMinor > 0 && D.balances.net.every((n) => n.amountMinor === 0) && tab === 'settle') confetti(); };
      await loadExpenses(); animateNumbers(root); await paint();
      const refreshHandler = () => reload().catch(() => { }); window.addEventListener('ex:notification', refreshHandler);
      on(root, 'click', '[data-tab]', async (_e, b) => { tab = b.dataset.tab; $$('#tabs .tab', root).forEach((t) => t.classList.toggle('on', t === b)); await paint(); });
      on(root, 'click', '[data-add]', () => expenseModal(D, null, () => reload()));
      on(root, 'click', '[data-eid]', async (_e, el) => { const d = await api.get(`/expenses/${el.dataset.eid}`); expenseDetail(d.expense, D, user, () => reload()); });
      on(root, 'click', '[data-more]', async () => { page += 1; await loadExpenses(false); paintExpenses(root); });
      on(root, 'click', '[data-export]', () => download(`/groups/${D.group.id}/export.csv`, `${D.group.name}-expensio.csv`).catch((e) => toast(e.message, 'bad')));
      on(root, 'click', '[data-recurring]', () => recurringModal(D, () => reload()));
      on(root, 'click', '[data-invite]', () => inviteModal(D, () => reload()));
      on(root, 'click', '[data-pay]', (_e, b) => paymentModal(D, b.dataset.from, b.dataset.to, Number(b.dataset.amt), user, () => reload()));
      on(root, 'click', '[data-st]', async (_e, b) => { try { await withBtn(b, () => api.post(`/settlements/${b.dataset.id}/${b.dataset.st}`)); toast(b.dataset.st === 'confirm' ? 'Payment confirmed ✅' : 'Updated', 'good'); await reload(); } catch (e) { toast(e.message, 'bad'); } });
      on(root, 'click', '[data-remind]', async (_e, b) => { try { await api.post(`/groups/${D.group.id}/remind`, { userId: b.dataset.remind }); toast('Friendly reminder sent 💌', 'good'); } catch (e) { toast(e.message, 'bad'); } });
      on(root, 'click', '[data-revoke]', async (_e, b) => { await api.del(`/groups/${D.group.id}/invites/${b.dataset.revoke}`); reload(); });
      on(root, 'click', '[data-rm]', async (_e, b) => { const self = b.dataset.rm === user.id; if (!(await confirmBox({ title: self ? 'Leave group?' : 'Remove member?', text: self ? 'You can be re-invited later.' : `${name(b.dataset.rm)} will be removed from this group.`, ok: self ? 'Leave' : 'Remove', danger: true }))) return; try { await api.del(`/groups/${D.group.id}/members/${b.dataset.rm}`); if (self) return nav('/groups'); reload(); } catch (e) { toast(e.message, 'bad'); } });
      on(root, 'click', '[data-archive]', async () => { await api.patch(`/groups/${D.group.id}`, { status: archived() ? 'active' : 'archived' }); toast(archived() ? 'Group restored' : 'Group archived', 'good'); reload(); });
      root.addEventListener('change', async (e) => {
        if (e.target.id === 'simp') { await api.patch(`/groups/${D.group.id}`, { simplifyDebts: e.target.checked }); reload(); }
        if (e.target.id === 'cat') { cat = e.target.value; await loadExpenses(); paintExpenses(root); }
      });
      let t; root.addEventListener('input', (e) => { if (e.target.id === 'q') { clearTimeout(t); t = setTimeout(async () => { query = e.target.value; await loadExpenses(); paintExpenses(root); $('#q', root).focus(); $('#q', root).setSelectionRange(query.length, query.length); }, 300); } });
      root.addEventListener('submit', async (e) => { if (e.target.id !== 'gs') return; e.preventDefault(); const f = e.target; try { await withBtn($('button', f), () => api.patch(`/groups/${D.group.id}`, { name: f.elements.name.value, description: f.description.value })); toast('Saved', 'good'); reload(); } catch (err) { toast(err.message, 'bad'); } });
      return () => window.removeEventListener('ex:notification', refreshHandler);
    }
  };
}

// ───────────────────────── modals ─────────────────────────
function inviteModal(D, done) {
  modal({ title: `Invite to ${D.group.name}`, body: `<form class="stack" id="f" novalidate><p class="muted" style="margin:0">They’ll get an email. No account yet? They can create one with that address and join in one tap.</p><div class="field"><label>Email address</label><input class="input" name="email" type="email" required placeholder="friend@example.com"></div>${btnHtml('Send invitation', 'btn-primary block lg', 'type="submit"')}</form>`, onMount: (m) => $('#f', m.el).addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; try { await withBtn($('button', f), () => api.post(`/groups/${D.group.id}/invite`, { email: f.email.value })); toast('Invitation sent ✉️', 'good'); m.close(); done(); } catch (err) { fieldErrors(f, err.details); if (!err.details) toast(err.message, 'bad'); } }) });
}

function paymentModal(D, from, to, amt, user, done) {
  const base = D.group.baseCurrency; const mem = (id) => D.members.find((m) => m.id === id); const iPay = from === user.id; const recv = mem(to);
  modal({
    title: iPay ? 'Record your payment' : 'Record payment received', body: `<form class="stack" id="f" novalidate><div class="plan-row">${avatar(mem(from), 'sm')}<b>${esc(mem(from)?.name)}</b><span class="arrow">${icon('arrow')}</span>${avatar(recv, 'sm')}<b>${esc(recv?.name)}</b></div>
    ${iPay && recv?.banking?.number ? `<div class="tip">💸 Send to <b>${esc(recv.name)}</b> via <b>${esc(recv.banking.provider || 'mobile banking')}</b>: <b class="mono" id="num">${esc(recv.banking.number)}</b> <button type="button" class="btn btn-ghost sm" data-copy>${icon('copy')} Copy</button></div>` : ''}
    <div class="form-grid two"><div class="field"><label>Amount (${base})</label><input class="input mono" name="amount" inputmode="decimal" value="${toMajor(amt, base)}"></div><div class="field"><label>Method</label><select class="input" name="method">${METHODS.map((m) => `<option ${m === (recv?.banking?.provider || 'Cash') ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
    <div class="field"><label>Transaction ID (optional)</label><input class="input" name="reference" maxlength="60" placeholder="e.g. bKash TrxID"></div><div class="field"><label>Note (optional)</label><input class="input" name="note" maxlength="200"></div>
    <p class="faint" style="font-size:.82rem;margin:0">${esc(iPay ? recv?.name : mem(from)?.name)} will be asked to confirm. Balances update once confirmed.</p>${btnHtml('Send for confirmation', 'btn-primary block lg', 'type="submit"')}</form>`,
    onMount: (m) => {
      m.el.querySelector('[data-copy]')?.addEventListener('click', () => { navigator.clipboard?.writeText($('#num', m.el).textContent); toast('Number copied', 'good'); });
      $('#f', m.el).addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; fieldErrors(f); try { await withBtn($('button[type=submit]', f), () => api.post(`/groups/${D.group.id}/settlements`, { from, to, amount: f.amount.value, method: f.method.value, reference: f.reference.value, note: f.note.value })); toast('Sent for confirmation ✅', 'good'); m.close(); done(); } catch (err) { toast(err.message, 'bad'); } });
    }
  });
}

function expenseDetail(e, D, user, done) {
  const base = D.group.baseCurrency; const name = (id) => D.members.find((m) => m.id === id)?.name || 'Someone'; const can = (e.createdBy === user.id || D.myRole === 'admin') && D.group.status === 'active';
  modal({
    title: e.title, body: `<div class="stack"><div class="row"><div class="cat-ico">${CAT[e.category]?.[0] || '🧾'}</div><div class="grow"><b class="mono" style="font-size:1.6rem">${money(e.amountMinor, e.currency)}</b>${e.currency !== base ? `<div class="muted mono">≈ ${money(e.baseAmountMinor, base)} @ ${e.fxRate}</div>` : ''}</div><span class="badge">${e.splitType}</span></div>
    <div class="muted">${dateFmt(e.date)} · added by ${esc(name(e.createdBy))}${e.version > 1 ? ` · edited (v${e.version})` : ''}</div>${e.note ? `<div class="tip">${esc(e.note)}</div>` : ''}
    <div><div class="lbl">PAID BY</div>${e.paid.map((p) => `<div class="list-item">${avatar(D.members.find((m) => m.id === p.userId), 'sm')}<b class="grow">${esc(name(p.userId))}</b><b class="mono money-pos">${money(p.amountMinor, base)}</b></div>`).join('')}</div>
    <div><div class="lbl">SPLIT BETWEEN</div>${e.owed.map((p) => `<div class="list-item">${avatar(D.members.find((m) => m.id === p.userId), 'sm')}<b class="grow">${esc(name(p.userId))}</b><b class="mono">${money(p.amountMinor, base)}</b></div>`).join('')}</div>
    ${can ? `<div class="row end wrap"><button class="btn btn-danger" data-del>${icon('trash')} Delete</button><button class="btn btn-primary" data-edit>${icon('edit')} Edit</button></div>` : ''}</div>`,
    onMount: (m) => {
      m.el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await confirmBox({ title: 'Delete expense?', text: 'Balances will be recalculated for everyone.', ok: 'Delete', danger: true }))) return; try { await api.del(`/expenses/${e.id}`); m.close(); toast('Expense deleted', 'good'); done(); } catch (err) { toast(err.message, 'bad'); } });
      m.el.querySelector('[data-edit]')?.addEventListener('click', () => { m.close(); expenseModal(D, e, done); });
    }
  });
}

function recurringModal(D, done) {
  api.get(`/groups/${D.group.id}/recurring`).then(({ rules }) => modal({ title: 'Recurring expenses', body: `<div class="stack">${rules.length ? rules.map((r) => `<div class="list-item"><span class="cat-ico">${icon('repeat')}</span><div class="grow"><b>${esc(r.title)}</b><div class="muted" style="font-size:.82rem">${money(Math.round(Number(r.amount) * 100), r.currency)} · ${r.frequency} · next ${dateFmt(r.nextRunAt)}</div></div><button class="btn btn-ghost sm" data-del="${r.id}">${icon('trash')}</button></div>`).join('') : '<p class="muted">No recurring expenses. Turn on “Repeat” when adding an expense.</p>'}</div>`, onMount: (m) => on(m.el, 'click', '[data-del]', async (_e, b) => { await api.del(`/recurring/${b.dataset.del}`); m.close(); toast('Stopped', 'good'); done(); }) }));
}

// ───────────────────────── expense editor ─────────────────────────
export function expenseModal(D, existing, done) {
  const members = D.members.filter((m) => m.active); const base = D.group.baseCurrency; const me = store.user.id;
  const inp = existing?.input || {};
  const S = {
    title: existing?.title || '', amount: inp.amount ?? (existing ? toMajor(existing.amountMinor, existing.currency) : ''), currency: existing?.currency || base, fxRate: inp.fxRate || '', category: existing?.category || 'general',
    date: (existing?.date ? new Date(existing.date) : new Date()).toISOString().slice(0, 10), note: existing?.note || '', splitType: existing?.splitType || 'equal',
    selected: new Set(existing ? (inp.participants?.length ? inp.participants.map((p) => p.userId) : existing.owed.map((o) => o.userId)) : members.map((m) => m.id)),
    values: Object.fromEntries((inp.participants || []).map((p) => [p.userId, p.value ?? ''])),
    items: (inp.items || []).map((i) => ({ name: i.name, amount: i.amount, assignees: new Set(i.assignees) })),
    multi: (inp.payers || []).length > 1, payer: inp.payers?.[0]?.userId || existing?.paid?.[0]?.userId || me, payerAmts: Object.fromEntries((inp.payers || []).map((p) => [p.userId, p.amount])),
    repeat: false, freq: 'monthly',
  };
  if (S.splitType === 'itemized' && !S.items.length) S.items = [{ name: '', amount: '', assignees: new Set(members.map((m) => m.id)) }];
  const rate = () => Number(S.fxRate) || store.config.fxRates?.[base] / store.config.fxRates?.[S.currency] || 1;

  const payload = () => {
    const p = { title: S.title.trim() || 'Untitled', amount: S.amount === '' ? 0 : S.amount, currency: S.currency, category: S.category, note: S.note, date: S.date, splitType: S.splitType };
    if (S.currency !== base && S.fxRate) p.fxRate = Number(S.fxRate);
    const ids = [...S.selected];
    p.participants = S.splitType === 'itemized' ? [] : ids.map((id) => ({ userId: id, value: S.splitType === 'equal' ? undefined : S.values[id] === undefined || S.values[id] === '' ? 0 : S.values[id] }));
    if (S.splitType === 'itemized') p.items = S.items.map((i) => ({ name: i.name || 'Item', amount: i.amount === '' ? 0 : i.amount, assignees: [...i.assignees] }));
    p.payers = S.multi ? members.filter((m) => Number(S.payerAmts[m.id]) > 0).map((m) => ({ userId: m.id, amount: S.payerAmts[m.id] })) : [{ userId: S.payer, amount: p.amount }];
    return p;
  };

  const body = () => `<form id="ef" class="stack" novalidate>
    <div class="field"><label>What was it for?</label><input class="input" name="title" value="${esc(S.title)}" placeholder="Dinner, hotel, taxi…" maxlength="120" required></div>
    <div class="form-grid two"><div class="field"><label>Amount</label><input class="input mono" name="amount" inputmode="decimal" value="${esc(S.amount)}" placeholder="0.00" style="font-size:1.2rem;font-weight:800"></div><div class="field"><label>Currency</label><select class="input" name="currency">${curOptions(S.currency)}</select></div></div>
    ${S.currency !== base ? `<div class="field"><label>Exchange rate (1 ${S.currency} = ? ${base})</label><input class="input mono" name="fxRate" inputmode="decimal" value="${esc(S.fxRate)}" placeholder="${(store.config.fxRates ? store.config.fxRates[base] / store.config.fxRates[S.currency] : 1).toFixed(4)} (indicative)"><span class="hint">Leave empty to use the indicative rate. The rate used is saved with the expense.</span></div>` : ''}
    <div class="form-grid two"><div class="field"><label>Category</label><select class="input" name="category">${Object.entries(CAT).map(([k, [e, l]]) => `<option value="${k}" ${S.category === k ? 'selected' : ''}>${e} ${l}</option>`).join('')}</select></div><div class="field"><label>Date</label><input class="input" type="date" name="date" value="${S.date}"></div></div>
    <div class="field"><label>Paid by</label>${S.multi ? `<div class="stack-sm">${members.map((m) => `<div class="split-row" style="grid-template-columns:auto 1fr 120px">${avatar(m, 'sm')}<span class="truncate">${esc(m.name)}</span><input class="input mono" data-pa="${m.id}" inputmode="decimal" placeholder="0.00" value="${esc(S.payerAmts[m.id] ?? '')}"></div>`).join('')}</div>` : `<select class="input" name="payer">${members.map((m) => `<option value="${m.id}" ${S.payer === m.id ? 'selected' : ''}>${esc(m.name)}${m.id === me ? ' (you)' : ''}</option>`).join('')}</select>`}<label class="check" style="margin-top:6px"><input type="checkbox" data-multi ${S.multi ? 'checked' : ''}><span>Multiple people paid</span></label></div>
    <div class="field"><label>Split</label><div class="tabs" id="stabs">${[['equal', 'Equally'], ['percent', '%'], ['shares', 'Shares'], ['exact', 'Exact'], ['itemized', 'Itemized']].map(([k, l]) => `<button type="button" class="tab ${S.splitType === k ? 'on' : ''}" data-split="${k}" style="padding:9px 12px">${l}</button>`).join('')}</div></div>
    <div id="split-area">${splitArea()}</div>
    <div id="preview" class="preview-box" style="display:none"></div>
    <div class="field"><label>Note (optional)</label><input class="input" name="note" value="${esc(S.note)}" maxlength="500"></div>
    ${existing ? '' : `<label class="check"><input type="checkbox" data-repeat ${S.repeat ? 'checked' : ''}><span>Repeat this expense <select class="input" data-freq style="display:inline-block;width:auto;min-height:34px;padding:2px 30px 2px 10px;margin-left:6px"><option value="weekly">weekly</option><option value="monthly" selected>monthly</option><option value="yearly">yearly</option></select></span></label>`}
    ${btnHtml(existing ? 'Save changes' : 'Add expense', 'btn-primary block lg', 'type="submit"')}</form>`;

  function splitArea() {
    if (S.splitType === 'itemized') return `<div class="stack-sm">${S.items.map((it, i) => `<div class="card tight flat" data-item="${i}"><div class="row"><input class="input grow" data-in="name" placeholder="Item (e.g. Pizza)" value="${esc(it.name)}"><input class="input mono" data-in="amount" inputmode="decimal" style="width:110px" placeholder="0.00" value="${esc(it.amount)}">${S.items.length > 1 ? `<button type="button" class="icon-btn" data-ritem="${i}" style="width:40px;height:40px">${icon('x')}</button>` : ''}</div><div class="person-pick" style="margin-top:10px">${members.map((m) => `<span class="person ${it.assignees.has(m.id) ? 'on' : ''}" data-asg="${m.id}">${avatar(m, 'sm')}${esc(m.name.split(' ')[0])}</span>`).join('')}</div></div>`).join('')}<button type="button" class="btn btn-glass sm" data-additem>${icon('plus')} Add item</button><p class="faint" style="font-size:.8rem;margin:0">Any extra (tax, tip, service charge) is shared in proportion to what each person ordered.</p></div>`;
    const unit = { percent: '%', shares: '×', exact: currencies()[S.currency]?.symbol || '' }[S.splitType];
    return `<div class="row between" style="margin-bottom:6px"><span class="lbl">${S.splitType === 'equal' ? 'SPLIT BETWEEN' : 'ENTER VALUES'}</span><span><button type="button" class="btn btn-ghost sm" data-all>All</button>${S.splitType !== 'equal' ? '<button type="button" class="btn btn-ghost sm" data-even>Even out</button>' : ''}</span></div>${members.map((m) => `<div class="split-row ${S.selected.has(m.id) ? '' : 'off'}" style="grid-template-columns:auto 1fr ${S.splitType === 'equal' ? 'auto' : '120px'}"><span class="person ${S.selected.has(m.id) ? 'on' : ''}" data-sel="${m.id}" style="padding:4px 12px 4px 4px">${avatar(m, 'sm')}</span><span class="truncate" data-sel="${m.id}" style="cursor:pointer;font-weight:700">${esc(m.name)}${m.id === me ? ' (you)' : ''}</span>${S.splitType === 'equal' ? '<span></span>' : `<div style="position:relative"><input class="input mono" data-val="${m.id}" inputmode="decimal" value="${esc(S.values[m.id] ?? '')}" ${S.selected.has(m.id) ? '' : 'disabled'} style="padding-right:30px"><span class="faint" style="position:absolute;right:10px;top:10px;font-size:.8rem">${unit}</span></div>`}</div>`).join('')}`;
  }

  const modalApi = modal({
    title: existing ? 'Edit expense' : 'Add expense', lg: true, body: body(), onMount: (m) => {
      const root = m.el; let tmr; let seq = 0;
      const prev = async () => {
        const box = $('#preview', root); const my = ++seq; const p = payload();
        if (!(Number(p.amount) > 0)) { box.style.display = 'none'; return; }
        try {
          const d = await api.post(`/groups/${D.group.id}/expenses/preview`, p); if (my !== seq) return; const nm = (id) => members.find((x) => x.id === id)?.name || '';
          box.style.display = 'block'; box.innerHTML = `<div class="lbl" style="margin-bottom:8px">LIVE PREVIEW${S.currency !== base ? ` · ${money(d.baseAmountMinor, base)} @ ${d.fxRate}` : ''}</div>${d.owed.map((o) => `<div class="row between" style="padding:3px 0"><span>${esc(nm(o.userId))}</span><b class="mono">${money(o.amountMinor, base)}</b></div>`).join('')}`; box.style.borderColor = '';
        }
        catch (e) { if (my !== seq) return; box.style.display = 'block'; box.innerHTML = `<span style="color:var(--warn);font-weight:600">${esc(e.message)}</span>`; }
      };
      const sched = () => { clearTimeout(tmr); tmr = setTimeout(prev, 350); };
      const rerender = (keepFocus) => { const f = document.activeElement?.dataset?.val; $('#split-area', root).innerHTML = splitArea(); if (keepFocus && f) $(`[data-val="${f}"]`, root)?.focus(); sched(); };
      const evenOut = () => { const ids = [...S.selected]; if (!ids.length) return; const amt = Number(S.amount) || 0; ids.forEach((id, i) => { if (S.splitType === 'percent') S.values[id] = i === ids.length - 1 ? +(100 - +(100 / ids.length).toFixed(2) * (ids.length - 1)).toFixed(2) : +(100 / ids.length).toFixed(2); else if (S.splitType === 'shares') S.values[id] = 1; else if (S.splitType === 'exact') { const per = Math.floor((amt / ids.length) * 100) / 100; S.values[id] = i === ids.length - 1 ? +(amt - per * (ids.length - 1)).toFixed(2) : per; } }); };
      if (!existing && S.splitType !== 'equal') evenOut();
      root.addEventListener('input', (e) => {
        const t = e.target; const n = t.name;
        if (n === 'title') S.title = t.value; else if (n === 'amount') { S.amount = t.value.replace(/,/g, ''); sched(); } else if (n === 'fxRate') { S.fxRate = t.value; sched(); } else if (n === 'note') S.note = t.value; else if (n === 'date') S.date = t.value;
        else if (t.dataset.val) { S.values[t.dataset.val] = t.value; sched(); } else if (t.dataset.pa) { S.payerAmts[t.dataset.pa] = t.value; sched(); }
        else if (t.dataset.in) { const i = Number(t.closest('[data-item]').dataset.item); S.items[i][t.dataset.in] = t.value; sched(); }
      });
      root.addEventListener('change', (e) => {
        const t = e.target; const n = t.name;
        if (n === 'currency') { S.currency = t.value; S.fxRate = ''; m.el.innerHTML = body(); sched(); } else if (n === 'category') S.category = t.value; else if (n === 'payer') { S.payer = t.value; sched(); }
        else if (t.dataset.multi !== undefined) { S.multi = t.checked; if (S.multi) { S.payerAmts = { [S.payer]: S.amount }; } m.el.innerHTML = body(); sched(); }
        else if (t.dataset.repeat !== undefined) S.repeat = t.checked; else if (t.dataset.freq !== undefined) S.freq = t.value;
      });
      on(root, 'click', '[data-split]', (_e, b) => { S.splitType = b.dataset.split; if (S.splitType !== 'equal' && S.splitType !== 'itemized') evenOut(); if (S.splitType === 'itemized' && !S.items.length) S.items = [{ name: '', amount: '', assignees: new Set(members.map((x) => x.id)) }]; $$('#stabs .tab', root).forEach((t) => t.classList.toggle('on', t === b)); rerender(); });
      on(root, 'click', '[data-sel]', (_e, el) => { const id = el.dataset.sel; S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); if (S.splitType !== 'equal') evenOut(); rerender(); });
      on(root, 'click', '[data-all]', () => { members.forEach((x) => S.selected.add(x.id)); if (S.splitType !== 'equal') evenOut(); rerender(); });
      on(root, 'click', '[data-even]', () => { evenOut(); rerender(); });
      on(root, 'click', '[data-asg]', (_e, el) => { const i = Number(el.closest('[data-item]').dataset.item); const a = S.items[i].assignees; a.has(el.dataset.asg) ? a.delete(el.dataset.asg) : a.add(el.dataset.asg); rerender(); });
      on(root, 'click', '[data-additem]', () => { S.items.push({ name: '', amount: '', assignees: new Set(members.map((x) => x.id)) }); rerender(); });
      on(root, 'click', '[data-ritem]', (_e, el) => { S.items.splice(Number(el.dataset.ritem), 1); rerender(); });
      root.addEventListener('submit', async (e) => {
        if (e.target.id !== 'ef') return; e.preventDefault(); const btn = $('button[type=submit]', root); const p = payload(); if (!S.title.trim()) { toast('Add a title', 'bad'); return; }
        try {
          await withBtn(btn, async () => {
            if (existing) await api.put(`/expenses/${existing.id}`, p); else {
              await api.post(`/groups/${D.group.id}/expenses`, p);
              if (S.repeat) { const d = new Date(S.date); if (S.freq === 'weekly') d.setDate(d.getDate() + 7); else if (S.freq === 'monthly') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1); await api.post(`/groups/${D.group.id}/recurring`, { expense: p, frequency: S.freq, startDate: d.toISOString() }); }
            }
          });
          toast(existing ? 'Expense updated ✏️' : 'Expense added 🎉', 'good'); if (!existing) confetti(50); m.close(); done();
        } catch (err) { toast(err.message, 'bad'); }
      });
      sched();
    }
  });
  return modalApi;
}
