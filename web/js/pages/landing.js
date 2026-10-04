import { icon, esc, tilt, animateNumbers, $, money } from '../core/ui.js';
import { store } from '../core/store.js';

const features = [
  ['split', 'Five ways to split', 'Equal, percentage, shares, exact amounts or itemized bills — with multiple payers and tax/tip spread fairly.'],
  ['coin', 'Penny-perfect maths', 'Every split is calculated in integer minor units and reconciles to the exact total. No lost or phantom paisa.'],
  ['zap', 'Smart settle-up', 'Debt simplification turns a tangle of IOUs into the fewest possible payments. Pay via bKash, Nagad, Rocket or cash.'],
  ['check', 'Two-step confirmation', 'A payment only counts once the receiver confirms it. Trust, built into the workflow.'],
  ['globe', 'Multi-currency', 'Spent in USD, settling in BDT? Convert at the rate you choose — saved with every expense for transparency.'],
  ['repeat', 'Recurring bills', 'Rent, internet, subscriptions — add them once and Expensio posts them weekly, monthly or yearly.'],
  ['chart', 'Insights & export', 'See spending by category and month. Export any group to CSV for your records.'],
  ['bell', 'Live notifications', 'Real-time alerts and email for new expenses, payments and invitations — with preferences you control.'],
];
const faqs = [
  ['Is Expensio free?', 'Yes — creating groups, splitting expenses and settling up is free. We’ll announce any future paid plans well in advance.'],
  ['Does Expensio move my money?', 'No. Expensio is a ledger and calculator, not a bank or wallet. You pay each other with bKash, Nagad, Rocket, bank transfer or cash, and the receiver confirms in the app.'],
  ['Why do I need to verify my email?', 'Verification keeps accounts real and lets us send you invitations, security codes and payment confirmations safely.'],
  ['Why does the Business module ask for my NID?', 'Money partnerships need real, accountable people. Partners verify identity with a National ID; it’s encrypted at rest, masked everywhere and reviewed by our compliance team. One NID can only link to one account.'],
  ['Can I invite friends who aren’t on Expensio yet?', 'Absolutely. Invite by email — they’ll get a link, create an account with that address, and join your group or business after accepting.'],
  ['Is there a mobile app?', 'Expensio works beautifully in your phone’s browser and can be installed to your home screen. Native iOS & Android apps from StratifyX Global are on our roadmap.'],
];

export default async function landing() {
  const html = `
  <section class="hero"><div class="container hero-grid">
    <div>
      <span class="eyebrow"><b>NEW</b> NID-verified business partnerships</span>
      <h1>Split expenses.<br><span class="grad-text">Settle with trust.</span></h1>
      <p class="lead">Expensio makes shared money feel effortless — from weekend trips and hostel messes to small business partnerships. Fair maths, friendly reminders, and payments that are confirmed, not assumed.</p>
      <div class="hero-actions"><a class="btn btn-primary lg" href="#/${store.user ? 'dashboard' : 'register'}">${store.user ? 'Open dashboard' : 'Start free'} ${icon('arrow')}</a><a class="btn btn-glass lg" href="#/" data-scroll="how">See how it works</a></div>
      <div class="trust"><span>${icon('shield')} Encrypted NID storage</span><span>${icon('check')} Email-verified accounts</span><span>${icon('lock')} 2-factor sign-in</span></div>
    </div>
    <div class="hero-visual">
      <div class="float-card glass a"><span style="font-size:1.4rem">🍽️</span><div>Seafood dinner<div class="muted" style="font-size:.75rem;font-weight:600">Split 3 ways · itemized</div></div></div>
      <div class="phone" id="phone"><div class="screen">
        <div class="row between"><div><div class="muted" style="font-size:.75rem;font-weight:700">COX’S BAZAR TRIP</div><b style="font-size:1.1rem">You are owed</b></div><span style="font-size:1.8rem">🏖️</span></div>
        <div class="grad-text mono" style="font-size:2.3rem;font-weight:800" data-count="684550" data-cur="BDT">৳0.00</div>
        <div class="progress"><i style="width:72%"></i></div>
        ${[['🦄', 'Ashik', '৳3,150.00', 'owes you'], ['🐼', 'Nafil', '৳3,695.50', 'owes you']].map(([e, n, a, t]) => `<div class="row glass" style="padding:10px 12px;border-radius:16px"><span class="avatar sm">${e}</span><div class="grow"><b>${n}</b><div class="muted" style="font-size:.72rem">${t}</div></div><b class="money-pos mono">${a}</b></div>`).join('')}
        <button class="btn btn-primary block" style="margin-top:auto" tabindex="-1">Request payment</button>
      </div></div>
      <div class="float-card glass b"><span style="font-size:1.4rem">✅</span><div>Payment confirmed<div class="muted" style="font-size:.75rem;font-weight:600">via bKash</div></div></div>
      <div class="float-card glass c"><span style="font-size:1.4rem">⚡</span><div>3 payments → 2<div class="muted" style="font-size:.75rem;font-weight:600">debts simplified</div></div></div>
    </div>
  </div></section>

  <section class="container" style="padding-bottom:20px"><div class="marquee reveal"><div class="track">${[...Array(2)].map(() => ['🧳 Trips', '🏠 Mess & hostels', '🎊 Weddings', '👯 Roommates', '💼 Small businesses', '🍕 Dinners', '🎓 Study groups', '🚗 Carpools'].map((t) => `<span class="chip">${t}</span>`).join('')).join('')}</div></div></section>

  <section class="section" id="demo"><div class="container"><div class="section-head reveal"><h2>Try the engine, <span class="grad-text">right here</span></h2><p>Every cent accounted for — even when the bill doesn’t divide evenly.</p></div>
    <div class="card pad-lg glow reveal" style="max-width:860px;margin:auto"><div class="form-grid two">
      <div class="field"><label>Bill total (৳)</label><input class="input" id="d-amt" inputmode="decimal" value="1000.00"></div>
      <div class="field"><label>People: <b id="d-n-v">3</b></label><input type="range" id="d-n" min="2" max="9" value="3" style="accent-color:var(--primary);width:100%;height:48px"></div></div>
      <div id="d-out" class="row wrap" style="margin-top:14px"></div>
      <p class="faint" style="margin:14px 0 0;font-size:.85rem">Largest-remainder allocation: shares always add up to the exact total.</p></div></div></section>

  <section class="section" id="features"><div class="container"><div class="section-head reveal"><span class="eyebrow">Everything you need</span><h2 style="margin-top:14px">Powerful where it matters, <span class="grad-text">simple where it counts</span></h2><p>The features of the big apps, tuned for how people in Bangladesh actually share money.</p></div>
    <div class="grid g4 stagger">${features.map(([i, t, d], k) => `<div class="card feature hover reveal" data-i="${k % 4}"><div class="ico-wrap">${icon(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></div></section>

  <section class="section" id="how"><div class="container"><div class="section-head reveal"><h2>From “who paid?” to <span class="warm-text">all settled</span> in 3 steps</h2></div>
    <div class="grid g3 steps stagger">${[['Create a group', 'Trip, home, event — invite friends by email. They join in one tap.'], ['Add expenses', 'Pick who paid and how to split. Preview the exact shares before you save.'], ['Settle up', 'Follow the simplified plan, pay your way, and the receiver confirms. 🎉']].map(([t, d], k) => `<div class="card step reveal" data-i="${k}"><h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}</div></div></section>

  <section class="section" id="business"><div class="container"><div class="grid g2" style="align-items:center;gap:40px">
    <div class="reveal"><span class="eyebrow"><b>BUSINESS</b> For partners who mean business</span><h2 style="margin-top:16px">A partnership ledger with <span class="grad-text">real accountability</span></h2>
      <p class="muted" style="font-size:1.05rem">Track investment, profit, expenses and withdrawals with the people you do business with — each verified by National ID.</p>
      <div class="stack-sm" style="margin:20px 0 28px">${['Invite partners by email — even before they have an account', 'Role-based access: owner, partner, investor, accountant', 'NID encrypted at rest and masked everywhere', 'Append-only ledger with a full audit trail', 'Automatic profit share by ownership percentage'].map((t) => `<div class="row">${icon('check', 'money-pos')}<span>${t}</span></div>`).join('')}</div>
      <a class="btn btn-primary" href="#/register">Create a business ${icon('arrow')}</a></div>
    <div class="card pad-lg glow reveal" data-i="2"><div class="stack">
      <div class="row between"><b>Sunrise Traders</b><span class="badge good">Active</span></div>
      <div class="grid g2" style="gap:12px"><div class="kpi"><span class="l">Net profit</span><span class="v money-pos">৳1,24,500</span></div><div class="kpi"><span class="l">Partners</span><span class="v">3</span></div></div>
      ${[['🦊', 'Ashik', 'Owner · 50%', 'good', 'NID verified'], ['🦄', 'Nafil', 'Partner · 30%', 'good', 'NID verified'], ['🐼', 'Dristy', 'Investor · 20%', 'warn', 'In review']].map(([e, n, r, c, b]) => `<div class="row glass" style="padding:10px 12px;border-radius:16px"><span class="avatar sm">${e}</span><div class="grow"><b>${n}</b><div class="muted" style="font-size:.78rem">${r}</div></div><span class="badge ${c}">${b}</span></div>`).join('')}
      <div class="secure-note">${icon('lock')}<span>NID: <b class="mono">••••••4821</b> — encrypted with AES-256-GCM. Only compliance staff can review, and every view is logged.</span></div></div></div></div></div></section>

  <section class="section"><div class="container"><div class="section-head reveal"><h2>Built on <span class="grad-text">trust & security</span></h2></div>
    <div class="grid g4">${[['lock', 'Hardened accounts', 'bcrypt hashing, rotating sessions, rate limits and lockouts.'], ['mail', 'Verified emails', 'Every account proves ownership of its email.'], ['id', 'Verified identity', 'NID checks for every business partner.'], ['file', 'Audit trails', 'Immutable logs of business and admin actions.']].map(([i, t, d], k) => `<div class="card feature reveal" data-i="${k}"><div class="ico-wrap">${icon(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></div></section>

  <section class="section" id="faq"><div class="container" style="max-width:820px"><div class="section-head reveal"><h2>Questions, answered</h2></div><div class="card reveal">${faqs.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>

  <section class="container section" style="padding-top:0"><div class="card cta-band reveal"><h2>Ready to make shared money <span class="warm-text">stress-free</span>?</h2><p class="muted" style="max-width:520px;margin:0 auto 26px">Join Expensio today. Create your first group in under a minute.</p><a class="btn btn-gold lg" href="#/${store.user ? 'dashboard' : 'register'}">${store.user ? 'Go to dashboard' : 'Create free account'} ${icon('arrow')}</a></div></section>`;

  return {
    title: '', html, mount(root) {
      animateNumbers(root); tilt($('#phone', root), 8);
      const amt = $('#d-amt', root); const n = $('#d-n', root); const out = $('#d-out', root);
      const calc = () => {
        $('#d-n-v', root).textContent = n.value;
        const total = Math.round(parseFloat(amt.value.replace(/,/g, '') || 0) * 100); const k = Number(n.value);
        if (!(total > 0)) { out.innerHTML = '<span class="muted">Enter an amount</span>'; return; }
        const base = Math.floor(total / k); const left = total - base * k;
        out.innerHTML = Array.from({ length: k }, (_, i) => `<div class="card tight" style="min-width:104px;flex:1"><div class="faint" style="font-size:.72rem;font-weight:700">PERSON ${i + 1}</div><b class="mono" style="font-size:1.1rem">${money(base + (i < left ? 1 : 0), 'BDT')}</b></div>`).join('') + `<div class="badge good" style="align-self:center">Σ = ${money(total, 'BDT')} ✓</div>`;
      };
      amt.addEventListener('input', calc); n.addEventListener('input', calc); calc();
    }
  };
}
