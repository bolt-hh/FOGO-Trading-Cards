/* ================================================================
   FOGO ENHANCEMENTS
   - SVG icon registry (replaces emojis)
   - Tier glyph injection
   - Card tilt + foil parallax
   - Confetti celebration
   - View-card layout split
   All purely additive; preserves existing IDs and JS function names.
================================================================ */
(function(){
  'use strict';

  // ============================================================
  // SVG ICON REGISTRY  (monoline, currentColor)
  // ============================================================
  const ICONS = {
    // Utility
    link:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
    bolt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
    lock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    card:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    trophy:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4"/><path d="M10 14h4l-.5 4h-3l-.5-4ZM8 21h8"/></svg>',
    chart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M4 19V5"/><path d="M7 15l3-4 3 3 5-7"/><path d="M14 7h3v3"/></svg>',
    share:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>',
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
    arrowL:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></svg>',
    ban:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/></svg>',
    camera:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    film:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
    ticket:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4Z"/><path d="M9 5v14" stroke-dasharray="2 3"/></svg>',
    barChart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><rect x="6" y="11" width="3" height="8"/><rect x="11" y="7" width="3" height="12"/><rect x="16" y="14" width="3" height="5"/></svg>',
    twitterX:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.53 3H20l-6.34 7.25L21 21h-5.83l-4.55-5.95L5.4 21H3l6.78-7.75L3 3h5.99l4.12 5.45L17.53 3Zm-1.02 16h1.7L7.6 4.9H5.78L16.5 19Z"/></svg>',
    eye:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    sprout:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M12 14C8 14 6 11 6 8c3 0 6 2 6 6Z"/><path d="M12 12c4 0 6-3 6-6-3 0-6 2-6 6Z"/></svg>',
    flame:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s4 4 4 9a4 4 0 1 1-8 0c0-2 1-3 1-3s-2 0-2 3a6 6 0 0 0 12 0c0-7-7-9-7-9Z" fill="currentColor" fill-opacity="0.15"/></svg>',
    hexagon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"/></svg>'
  };

  // ============================================================
  // TIER GLYPHS — flame ember progression (0..6)
  // Each glyph is a layered flame mark scaled by tier intensity.
  // ============================================================
  function flameGlyph(tier){
    // tier: 0 spark .. 6 apex
    const intensity = tier;
    const fillFire = '#FF3D00';
    const fillEmber = '#FF8C00';
    const fillLime = '#C3FBA5';

    // 0 — sprout/spark
    if (tier === 0) {
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 50 V32" stroke="${fillLime}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <path d="M32 36 C24 36 20 30 20 22 c8 0 12 6 12 14 Z" fill="${fillLime}" opacity="0.45"/>
        <circle cx="32" cy="22" r="3" fill="${fillLime}"/>
      </svg>`;
    }

    // base flame outline
    const flames = [];

    // outer halo for high tiers
    if (intensity >= 5) {
      flames.push(`<path d="M32 6 C40 18 50 24 50 38 a18 18 0 0 1-36 0 C14 30 18 26 18 26 c-2 4-2 8 0 12 a8 8 0 0 0 16 0 c0-6-4-10-4-14" fill="${fillLime}" opacity="0.18"/>`);
    }

    // main flame body
    const bodyOpacity = 0.18 + intensity * 0.08;
    flames.push(`<path d="M32 8 C38 20 46 24 46 36 a14 14 0 0 1-28 0 C18 28 22 24 22 24 c-1 3-1 6 0 9 a6 6 0 0 0 12 0 c0-5-3-9-3-12 Z"
      fill="${fillFire}" opacity="${Math.min(0.95, bodyOpacity)}"/>`);

    // inner ember
    flames.push(`<path d="M32 18 C36 26 40 28 40 36 a8 8 0 0 1-16 0 c0-4 2-6 4-8 c0 2 0 4 1 5 a3 3 0 0 0 6 0 c0-3-3-6-3-9 Z"
      fill="${fillEmber}" opacity="${0.5 + intensity * 0.07}"/>`);

    // bright core for tier >= 3
    if (intensity >= 3) {
      flames.push(`<path d="M32 28 c2 4 4 5 4 9 a4 4 0 0 1-8 0 c0-3 2-5 4-9 Z" fill="${fillLime}" opacity="${0.5 + (intensity-3) * 0.12}"/>`);
    }

    // apex — extra spark on top
    if (intensity === 6) {
      flames.push(`<circle cx="32" cy="6" r="2" fill="${fillLime}"/>`);
      flames.push(`<path d="M32 4 V0 M28 4 l-2 -3 M36 4 l2 -3" stroke="${fillLime}" stroke-width="1.5" stroke-linecap="round"/>`);
    }

    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${flames.join('')}</svg>`;
  }

  function tierGlyphHTML(tierIdx){
    const idx = Math.max(0, Math.min(6, tierIdx | 0));
    return `<span class="tier-glyph" data-tier="${idx}">${flameGlyph(idx)}</span>`;
  }

  // expose
  window.FogoIcons = { ICONS, flameGlyph, tierGlyphHTML };

  // ============================================================
  // INIT — wire icons after DOM ready
  // ============================================================
  function svg(name, opts){
    const o = opts || {};
    const cls = 'ficon' + (o.cls ? ' ' + o.cls : '');
    return `<span class="${cls}" style="${o.style || ''}">${ICONS[name] || ''}</span>`;
  }

  function setHTML(id, html){
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  function setText(id, t){
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  }

  function applyTierGlyph(el, tierIdx){
    if (!el) return;
    el.innerHTML = '';
    el.style.fontSize = '0';
    el.appendChild(parse(tierGlyphHTML(tierIdx)));
  }
  function parse(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  // ============================================================
  // GATE TIERS — replace emojis with flame glyphs
  // ============================================================
  function wireGateTiers(){
    const grid = document.getElementById('gate-tiers-grid');
    if (!grid) return;
    const tiers = grid.querySelectorAll('.gate-tier');
    // tier 0 is "Yet to be FOGO-pilled" not shown in gate; gate shows tier 1..6
    tiers.forEach((card, i) => {
      const ico = card.querySelector('.gate-tier-icon');
      if (ico) {
        ico.innerHTML = '';
        ico.appendChild(parse(tierGlyphHTML(i + 1)));
      }
    });
  }

  // ============================================================
  // INFO STRIP CHIPS
  // ============================================================
  function wireInfoChips(){
    const map = [
      ['t-chip-1', 'link'],
      ['t-chip-2', 'bolt'],
      ['t-chip-3', 'lock'],
      ['t-chip-4', 'card']
    ];
    map.forEach(([txtId, ic]) => {
      const txt = document.getElementById(txtId);
      if (!txt) return;
      const chip = txt.closest('.info-chip');
      if (!chip) return;
      const ico = chip.querySelector('.info-chip-icon');
      if (ico) ico.innerHTML = ICONS[ic];
    });

    // prize-pill icon
    document.querySelectorAll('.prize-pill-icon').forEach(el => { el.innerHTML = ICONS.trophy; });
  }

  // ============================================================
  // GATE — "How to maximise" list rows
  // ============================================================
  function wireMaxiList(){
    // Find the eyebrow div directly — it is unique
    let eyebrow = null;
    const cands = document.querySelectorAll('div[style*="letter-spacing"]');
    for (const d of cands) {
      // Eyebrow has no element children — text only
      if (d.children.length === 0 && d.textContent.trim() === 'How to Maximise Your Entries') {
        eyebrow = d; break;
      }
    }
    if (!eyebrow) return;
    const block = eyebrow.parentElement;
    if (!block) return;
    if (block.dataset.fogoMaxi === '1') return;
    block.dataset.fogoMaxi = '1';

    // The rows live inside the immediate-next sibling of the eyebrow
    const rowsContainer = eyebrow.nextElementSibling;
    if (!rowsContainer) return;

    const data = [
      { ic: 'card',     label: 'Generate your Trader Card',          pts: '+50 pts',     cls: '' },
      { ic: 'twitterX', label: 'Share card on X',                    pts: '+50 pts',     cls: '' },
      { ic: 'barChart', label: 'On-chain volume (per $50)',          pts: '+25 pts',     cls: '' },
      { ic: 'flame',    label: 'Use Valiant / Pyron / Brasa / Ignition', pts: '+200 each',cls: 'fire' },
      { ic: 'film',     label: 'Share UGC on X (max 3 posts)',       pts: '+100 each',   cls: 'dim' }
    ];
    const list = document.createElement('div');
    list.className = 'gate-maxi-list';
    list.innerHTML = data.map(d => `
      <div class="gate-maxi-row ${d.cls}">
        <span class="label"><span class="fline-icon ${d.cls}">${ICONS[d.ic]}</span>${d.label}</span>
        <span class="pts">${d.pts}</span>
      </div>`).join('');
    rowsContainer.replaceWith(list);

    // Replace the trophy footnote line — it has border-top inline style
    const footChildren = block.querySelectorAll('div');
    for (const c of footChildren) {
      const s = c.getAttribute('style') || '';
      if (s.includes('border-top') && c.textContent.includes('225')) {
        c.innerHTML = `<span class="fline-icon" style="color:var(--lime);width:22px;height:22px;vertical-align:-6px;margin-right:6px;">${ICONS.trophy}</span> 225 Winners · Volume points uncapped · More activity = more entries`;
        break;
      }
    }
  }

  // ============================================================
  // CARD VIEW — restructure to split layout
  // ============================================================
  function restructureCardView(){
    const cardWrap = document.getElementById('card-wrap');
    const view = document.getElementById('view-card');
    if (!cardWrap || !view) return;
    if (view.dataset.fogoSplit === '1') return;
    view.dataset.fogoSplit = '1';

    const inner = view.querySelector('.app-inner');
    if (!inner) return;

    // Locate primary right-side panels
    const actionsBlock = inner.querySelector('.actions');
    const ineligibleCta = document.getElementById('ineligible-cta');
    const tasksSection = document.getElementById('tasks-section');
    const kolPanel = document.getElementById('kol-selector-panel');
    const eligibleEntry = document.getElementById('eligible-entry');

    // Build split container
    const split = document.createElement('div');
    split.className = 'card-split';

    const left = document.createElement('div');
    left.className = 'card-split-left';

    const right = document.createElement('div');
    right.className = 'card-split-right';

    // Right header
    const railHead = document.createElement('div');
    railHead.innerHTML = `
      <div class="rail-eyebrow">Trader Card · Live Drop</div>
      <div class="rail-title">Your card is ready.</div>
      <div class="rail-sub">Share on X to claim your raffle entries. Each task you complete adds points — every point is one ticket in the draw.</div>
    `;
    right.appendChild(railHead);

    // Insert split before cardWrap, then move cardWrap into left
    cardWrap.parentNode.insertBefore(split, cardWrap);

    // Wrap card in tilt parent
    const tilt = document.createElement('div');
    tilt.className = 'card-tilt-wrap';
    tilt.appendChild(cardWrap);
    left.appendChild(tilt);

    // Card meta strip — small live stats below the card
    const meta = document.createElement('div');
    meta.className = 'card-meta-strip';
    meta.innerHTML = `
      <div class="card-meta-cell"><div class="v" id="meta-tier-name">—</div><div class="l">Tier</div></div>
      <div class="card-meta-cell"><div class="v" id="meta-power">—</div><div class="l">Power</div></div>
      <div class="card-meta-cell"><div class="v" id="meta-rank">#—</div><div class="l">Series</div></div>
    `;
    left.appendChild(meta);

    // Stack actions below card
    const actStack = document.createElement('div');
    actStack.className = 'card-actions-stack';
    if (actionsBlock) actStack.appendChild(actionsBlock);
    left.appendChild(actStack);

    // Move right-rail panels in order
    if (ineligibleCta) right.appendChild(ineligibleCta);
    if (tasksSection) right.appendChild(tasksSection);
    if (kolPanel) right.appendChild(kolPanel);
    if (eligibleEntry) right.appendChild(eligibleEntry);

    split.appendChild(left);
    split.appendChild(right);

    // Add foil + emboss + shine + serial + holo overlays inside the card
    const card = document.getElementById('the-card');
    if (card && !card.querySelector('.card-foil')) {
      const overlays = document.createElement('div');
      overlays.innerHTML = `
        <div class="card-emboss"></div>
        <div class="card-foil"></div>
        <div class="card-shine"></div>
        <div class="card-holo">${ICONS.flame}</div>
      `;
      // append children
      while (overlays.firstChild) card.appendChild(overlays.firstChild);
    }
  }

  function shortId(){
    const r = Math.random().toString(36).slice(2, 8).toUpperCase();
    return r;
  }

  // Tilt removed per design feedback — card stays static; foil/shimmer remain ambient.
  function wireCardTilt(){ /* no-op */ }

  // ============================================================
  // CARD SIGNAL STRIP — fills empty space above footer
  // ============================================================
  function buildSignalStrip(){
    const card = document.getElementById('the-card');
    if (!card) return;
    if (card.querySelector('.card-signal')) return;
    const foot = card.querySelector('.card-foot');
    if (!foot) return;

    const sig = document.createElement('div');
    sig.className = 'card-signal c-z';
    sig.innerHTML = `
      <div class="card-signal-spark" id="c-spark"></div>
    `;
    card.insertBefore(sig, foot);

    // initial placeholder bars so it never looks empty
    const spark = sig.querySelector('#c-spark');
    if (spark && !spark.children.length) {
      const heights = [22, 35, 28, 48, 30, 55, 42, 38, 62, 48, 70, 54, 45, 60];
      spark.innerHTML = heights.map((h,i) => `<div class="bar${i===10?' fire':''}" style="height:${h}%"></div>`).join('');
    }
  }

  function populateSignalStrip(power, volStr){
    const spark = document.getElementById('c-spark');
    if (spark) {
      const seed = (Math.abs(power|0) * 9301 + ((volStr||'').toString().length) * 49297 + 1) % 233280;
      let s = seed || 1;
      const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const bars = 14;
      let html = '';
      for (let i = 0; i < bars; i++) {
        const h = 14 + rand() * 70;
        const fire = rand() > 0.78;
        html += `<div class="bar${fire ? ' fire' : ''}" style="height:${h.toFixed(0)}%"></div>`;
      }
      spark.innerHTML = html;
    }
    const streak = document.getElementById('c-streak');
    if (streak) streak.textContent = Math.max(1, Math.min(42, Math.round((power||1) * 0.9 + 3))) + 'd';
    const lasttx = document.getElementById('c-lasttx');
    if (lasttx) {
      const opts = ['2h ago', '6h ago', '14h ago', '1d ago', '3h ago', '47m ago'];
      lasttx.textContent = opts[Math.abs((power || 1) * 7) % opts.length];
    }
    const rank = document.getElementById('c-rank');
    if (rank && !rank.dataset.realRank) {
      rank.textContent = '#—'; // placeholder until real fetch
      // Trigger real rank fetch
      setTimeout(() => {
        if (typeof window.fetchLeaderboardRank === 'function' && window.STATE && window.STATE.wallet) {
          window.fetchLeaderboardRank(window.STATE.wallet);
        }
      }, 300);
    }
  }

  // ============================================================
  // ROLE ICON — replace emoji renderCard sets with flame glyph
  // ============================================================
  function patchRoleIcon(){
    if (typeof window.renderCard !== 'function') return;
    const orig = window.renderCard;
    window.renderCard = function(wallet, handle, data, tier, power){
      orig.call(this, wallet, handle, data, tier, power);
      try {
        const r = document.getElementById('r-icon');
        if (r) {
          const idx = (tier && (tier.index != null)) ? tier.index : 1;
          r.innerHTML = '';
          r.style.fontSize = '0';
          r.appendChild(parse(flameGlyph(idx)));
        }
        // update meta strip
        setText('meta-tier-name', (tier && tier.name) ? tier.name : '—');
        setText('meta-power', String(power || '—').padStart(2, '0'));
        const seriesEl = document.getElementById('meta-rank');
        if (seriesEl) seriesEl.textContent = 'S2';
        // populate signal strip with deterministic values
        try {
          buildSignalStrip();
          const volEl = document.getElementById('s-vol') || document.getElementById('c-vol');
          const volStr = volEl ? volEl.textContent : '';
          populateSignalStrip(power, volStr);
        } catch(e){}
      } catch(e){ console.warn('[FOGO] role glyph patch:', e); }
    };
  }

  // ============================================================
  // SWAP card-action buttons & rescan & ineligible icons
  // ============================================================
  function wireButtonIcons(){
    // Share on X
    const shareBtn = document.querySelector('.act-btn.primary[onclick*="shareX"]');
    if (shareBtn) {
      const t = document.getElementById('t-share-x-btn');
      const label = t ? t.textContent.replace(/^[^A-Za-z]+/, '').trim() : 'Share on X';
      shareBtn.innerHTML = `<span class="ficon" style="color:currentColor;font-size:13px;margin-right:6px;">${ICONS.twitterX}</span><span id="t-share-x-btn">${label}</span>`;
    }
    // Save
    const dlBtn = document.getElementById('dl-btn');
    if (dlBtn) {
      const lbl = document.getElementById('t-save-card');
      const text = lbl ? lbl.textContent : 'Save Card';
      dlBtn.innerHTML = `<span class="ficon" style="font-size:13px;margin-right:6px;">${ICONS.download}</span><span id="t-save-card">${text}</span>`;
    }
    // New
    const newBtn = document.querySelector('.act-btn[onclick="resetAndGoHome()"]');
    if (newBtn) {
      const txt = newBtn.textContent.trim() || 'New';
      newBtn.innerHTML = `<span class="ficon" style="font-size:13px;margin-right:6px;">${ICONS.refresh}</span><span id="t-new-btn">${txt}</span>`;
    }
    // Rescan
    const rescan = document.getElementById('rescan-btn');
    if (rescan) {
      rescan.innerHTML = `<span class="ficon" style="font-size:11px;margin-right:6px;">${ICONS.refresh}</span> Rescan Wallet`;
    }
    // Ineligible badge
    const inelig = document.querySelector('.ineligible-badge');
    if (inelig) {
      const t = inelig.textContent.replace(/^[^A-Za-z]+/, '').trim();
      inelig.innerHTML = `<span class="ficon" style="margin-right:6px;color:#ff8080;font-size:11px;vertical-align:-2px;">${ICONS.ban}</span>${t}`;
    }
    // Bonus head
    const bonus = document.getElementById('t-bonus-head');
    if (bonus) {
      const t = bonus.textContent.replace(/^[^A-Za-z]+/, '').trim();
      bonus.innerHTML = `<span class="ficon" style="margin-right:7px;color:var(--lime);font-size:13px;vertical-align:-2px;">${ICONS.camera}</span>${t}`;
    }
    // Tasks heading — leave plain text but add icon
    const tasksHead = document.getElementById('t-tasks-heading');
    if (tasksHead && !tasksHead.querySelector('.ficon')) {
      const t = tasksHead.textContent;
      tasksHead.innerHTML = `<span class="ficon" style="margin-right:7px;color:var(--lime);font-size:13px;vertical-align:-2px;">${ICONS.ticket}</span>${t}`;
    }
    // Raffle success / done icons
    const succ = document.querySelector('.raffle-success-icon');
    if (succ) succ.innerHTML = ICONS.ticket;
    const done = document.querySelector('.raffle-done-icon');
    if (done) done.innerHTML = ICONS.flame;
    // Locked
    const locked = document.querySelector('.locked-icon');
    if (locked) locked.innerHTML = ICONS.lock;
    // Leaderboard nav back arrow & refresh
    const lbRefresh = document.getElementById('t-lb-refresh');
    if (lbRefresh && !lbRefresh.querySelector('svg')) {
      lbRefresh.innerHTML = `<span class="ficon" style="font-size:11px;margin-right:6px;color:currentColor;vertical-align:-2px;">${ICONS.refresh}</span>Refresh`;
    }
    const lbBack = document.getElementById('t-lb-back');
    if (lbBack && !lbBack.querySelector('svg')) {
      lbBack.innerHTML = `<span class="ficon" style="font-size:11px;margin-right:6px;color:currentColor;vertical-align:-2px;">${ICONS.arrowL}</span>Back`;
    }
    // Back btn in app
    const backBtn = document.getElementById('t-back-btn');
    if (backBtn && !backBtn.querySelector('svg')) {
      backBtn.innerHTML = `<span class="ficon" style="font-size:10px;margin-right:5px;color:currentColor;vertical-align:-2px;">${ICONS.arrowL}</span>Back`;
    }
  }

  // ============================================================
  // CONFETTI on raffle success
  // ============================================================
  let confettiCanvas;
  function initConfettiCanvas(){
    if (confettiCanvas) return confettiCanvas;
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'fogo-confetti';
    document.body.appendChild(confettiCanvas);
    const resize = () => { confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    return confettiCanvas;
  }
  function fireConfetti(){
    const cv = initConfettiCanvas();
    const ctx = cv.getContext('2d');
    const colors = ['#FF3D00','#FF8C00','#C3FBA5','#FFFFFF','#9945FF'];
    const N = 140;
    const parts = [];
    for (let i=0;i<N;i++){
      parts.push({
        x: cv.width * 0.5 + (Math.random()-0.5)*180,
        y: cv.height * 0.55,
        vx: (Math.random()-0.5) * 14,
        vy: -Math.random()*16 - 6,
        g: 0.42 + Math.random()*0.12,
        size: 4 + Math.random()*5,
        rot: Math.random()*Math.PI*2,
        vr: (Math.random()-0.5)*0.4,
        color: colors[Math.floor(Math.random()*colors.length)],
        life: 0,
        max: 90 + Math.random()*40
      });
    }
    let frame = 0;
    function step(){
      ctx.clearRect(0,0,cv.width,cv.height);
      let alive = 0;
      parts.forEach(p => {
        if (p.life > p.max) return;
        alive++;
        p.life++;
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const a = Math.max(0, 1 - p.life/p.max);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*1.6);
        ctx.restore();
      });
      frame++;
      if (alive > 0 && frame < 240) requestAnimationFrame(step);
      else ctx.clearRect(0,0,cv.width,cv.height);
    }
    step();
  }
  // Hook enterRaffle — collapse entry section + show unified success state + confetti
  function patchEnterRaffle(){
    if (typeof window.enterRaffle !== 'function') return;
    if (window.enterRaffle.__fogoPatched) return;
    const orig = window.enterRaffle;
    window.enterRaffle = async function(){
      const before = !!(window.STATE && window.STATE.raffleEntered);
      let result;
      try {
        result = await orig.apply(this, arguments);
      } catch(e){
        // If the original throws, reset button so user isn't stuck on "Entering..."
        try { resetEnterRaffleButton(); } catch(_){}
        throw e;
      }
      // After original runs: if we're now entered, take over the UI
      try {
        if (window.STATE && window.STATE.raffleEntered && !before) {
          showFogoRaffleSuccess();
          fireConfetti();
        } else {
          // Entry didn't succeed (validation/network/etc) — make sure button isn't stuck
          resetEnterRaffleButton();
        }
      } catch(e){ console.warn('[FOGO] post-enterRaffle ui:', e); }
      return result;
    };
    window.enterRaffle.__fogoPatched = true;
  }

  function resetEnterRaffleButton(){
    const btn = document.getElementById('raffle-enter-btn');
    if (!btn) return;
    if (window.STATE && window.STATE.raffleEntered) return; // do not reset if entered
    btn.disabled = false;
    const lbl = btn.querySelector('#t-enter-raffle-btn');
    if (lbl) lbl.textContent = 'ENTER RAFFLE';
    else btn.textContent = 'ENTER RAFFLE';
  }

  // Calculate correct points from scratch — never relies on STATE timing
  function getActualPoints() {
    const S = window.STATE;
    // 1. currentPoints set by index.html after DB read
    if (S && S.currentPoints > 1) return S.currentPoints;
    // 2. raffleEntryCount set at entry time
    if (S && S.raffleEntryCount > 1) return S.raffleEntryCount;
    // 3. Recalculate from card data directly
    try {
      if (!S || !S.cardData) return 1;
      const vol    = S.cardData.vol || 0;
      const volPts = Math.floor(vol / 50) * 25;
      const proto  = S.cardData.data?.protocols || S.cardData.protocols || {};
      let total = 50 + volPts; // card_generated + volume
      if ((proto.valiant  || 0) > 0) total += 200;
      if ((proto.pyron    || 0) > 0) total += 200;
      if ((proto.brasa    || 0) > 0) total += 200;
      if ((proto.ignition || 0) > 0) total += 200;
      if (S._savedXLink) total += 50;
      total += (S.ugcPoints || 0);
      return total > 0 ? total : 1;
    } catch(e) { return 1; }
  }

  // Collapse the entry flow into a single unified success panel.
  function showFogoRaffleSuccess(){
    const wrap = document.getElementById('eligible-entry');
    if (!wrap) return;

    // Hide the three original sub-cards
    ['raffle-step-1','raffle-step-2','raffle-done'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Always recalculate — never trust stale STATE timing
    const pts = getActualPoints();
    // Expose updater for index.html to call if needed
    // Points display handled entirely in index.html via #raffle-success-pts
    window.fogoUpdateSuccessPts = function(n){ /* no-op — index.html owns this */ };

    // Build (or update) unified success card
    let card = document.getElementById('fogo-raffle-success');
    if (!card) {
      card = document.createElement('div');
      card.id = 'fogo-raffle-success';
      card.className = 'fogo-success-card';
      wrap.appendChild(card);
    }
    card.innerHTML = `
      <div class="fogo-success-glow"></div>
      <div class="fogo-success-icon">${ICONS.flame}</div>
      <div class="fogo-success-eyebrow">ENTRY CONFIRMED</div>
      <div class="fogo-success-title">You're in the Draw</div>
      <div id="fogo-pts-strip"></div>
      <div class="fogo-success-divider"></div>
      <div class="fogo-success-cta">
        <button class="fogo-cta primary" id="fogo-boost-btn">
          <span class="ficon" style="font-size:13px;margin-right:7px;">${ICONS.bolt}</span>Boost your entries
        </button>
        <button class="fogo-cta ghost" id="fogo-startover-btn">
          <span class="ficon" style="font-size:11px;margin-right:6px;">${ICONS.arrowL}</span>Start over
        </button>
      </div>
      <div class="fogo-success-foot">
        Results announced by your KOL. More tasks = more tickets.
      </div>
    `;
    card.style.display = 'block';

    // Wire CTAs
    const boost = document.getElementById('fogo-boost-btn');
    if (boost) boost.addEventListener('click', onBoostEntries);
    const startover = document.getElementById('fogo-startover-btn');
    if (startover) startover.addEventListener('click', () => {
      if (typeof window.resetAndGoHome === 'function') window.resetAndGoHome();
    });
  }

  // "Boost your entries" — scroll to the UGC task card in the tasks section
  // (the task card already has inline submission slots — no need to reopen step-2)
  function onBoostEntries(){
    // Scroll to UGC task card inside tasks-section
    const ugcCard = document.getElementById('ugc-task-card');
    const tasksSection = document.getElementById('tasks-section');
    const target = ugcCard || tasksSection;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Briefly highlight the UGC card so user knows where to look
      if (ugcCard) {
        ugcCard.style.transition = 'border-color 0.3s';
        ugcCard.style.borderColor = 'rgba(195,251,165,0.6)';
        setTimeout(() => { ugcCard.style.borderColor = ''; }, 2000);
      }
    }
    // Add a small "back to confirmation" hook above step-2 so user can return to success state
    if (step2 && !document.getElementById('fogo-back-to-success')) {
      const back = document.createElement('button');
      back.id = 'fogo-back-to-success';
      back.className = 'fogo-back-link';
      back.innerHTML = `<span class="ficon" style="font-size:11px;margin-right:6px;">${ICONS.arrowL}</span>Back to entry confirmation`;
      back.addEventListener('click', () => {
        step2.style.display = 'none';
        const c = document.getElementById('fogo-raffle-success');
        if (c) { c.style.display = 'block'; c.scrollIntoView({ behavior:'smooth', block:'center' }); }
        back.remove();
      });
      step2.parentNode.insertBefore(back, step2);
    }
  }

  // Also intercept showRaffleDone — if the original code reaches done state
  // (e.g. user submitted UGC bonus), show our unified card instead.
  function patchShowRaffleDone(){
    if (typeof window.showRaffleDone !== 'function') return;
    if (window.showRaffleDone.__fogoPatched) return;
    const orig = window.showRaffleDone;
    window.showRaffleDone = function(hasBonus){
      try { orig.apply(this, arguments); } catch(e){}
      try { showFogoRaffleSuccess(); } catch(e){ console.warn(e); }
    };
    window.showRaffleDone.__fogoPatched = true;
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  function bootstrap(){
    try { wireGateTiers(); } catch(e){ console.warn('[FOGO] wireGateTiers:', e); }
    try { wireInfoChips(); } catch(e){ console.warn('[FOGO] wireInfoChips:', e); }
    try { wireMaxiList(); } catch(e){ console.warn('[FOGO] wireMaxiList:', e); }
    try { restructureCardView(); } catch(e){ console.warn('[FOGO] restructureCardView:', e); }
    try { buildSignalStrip(); } catch(e){ console.warn('[FOGO] buildSignalStrip:', e); }
    try { wireButtonIcons(); } catch(e){ console.warn('[FOGO] wireButtonIcons:', e); }
    try { patchRoleIcon(); } catch(e){ console.warn('[FOGO] patchRoleIcon:', e); }
    try { patchEnterRaffle(); } catch(e){ console.warn('[FOGO] patchEnterRaffle:', e); }
    try { patchShowRaffleDone(); } catch(e){ console.warn('[FOGO] patchShowRaffleDone:', e); }

    // Watch eligible-entry becoming visible — that's the definitive trigger
    // Works whether coming from existing submission path or fresh 409
    try {
      const eligEl = document.getElementById('eligible-entry');
      if (eligEl) {
        const emo = new MutationObserver(() => {
          if (eligEl.style.display !== 'none' && window.STATE && window.STATE.raffleEntered) {
            setTimeout(() => { try { showFogoRaffleSuccess(); } catch(e){} }, 80);
          }
        });
        emo.observe(eligEl, { attributes: true, attributeFilter: ['style'] });
      }
    } catch(e){}

    // Wait a tick for anything async, then wire tilt
    setTimeout(() => {
      try { wireCardTilt(); } catch(e){}
      // Re-run icon swaps in case other init reset them (e.g. rescan)
      try { wireButtonIcons(); } catch(e){}
    }, 250);

    // Watch for view changes — re-wire tilt when view-card becomes active
    const viewCard = document.getElementById('view-card');
    if (viewCard && 'MutationObserver' in window) {
      const mo = new MutationObserver(() => {
        if (viewCard.classList.contains('active')) {
          setTimeout(() => { try{ wireCardTilt(); wireButtonIcons(); } catch(e){} }, 100);
        }
      });
      mo.observe(viewCard, { attributes:true, attributeFilter:['class'] });
    }

    // Re-run icon swaps after a long delay (handles late renders by other scripts)
    setTimeout(() => { try { wireButtonIcons(); } catch(e){} }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
