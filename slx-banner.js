/* ================================================================
   SUPERLUMINAL × FOGO — Co-branded announcement banner
   Embeddable: drop one <script src="slx-banner.js"> anywhere.

   CONFIG (set before loading this script):
   window.SLXBannerConfig = {
     lang:         'en',          // 'en' | 'ko'
     showBar:      true,          // show slim top bar on load
     showPopup:    false,         // show popup on load
     popupDelay:   0,             // ms delay before popup appears
     waitlistUrl:  'https://slx.fi',
     dismissBar:   true,          // show X on bar
     dismissPopup: true,          // show X on popup
   }

   API (after load):
   SLXBanner.showBar(lang?)
   SLXBanner.hideBar()
   SLXBanner.showPopup(lang?)
   SLXBanner.hidePopup()
   SLXBanner.setLang('en' | 'ko')
================================================================ */

(function () {
  'use strict';

  /* ── defaults ── */
  const cfg = Object.assign({
    lang: 'en',
    showBar: true,
    showPopup: false,
    popupDelay: 0,
    waitlistUrl: 'https://slx.fi',
    dismissBar: true,
    dismissPopup: true,
  }, window.SLXBannerConfig || {});

  /* ── copy ── */
  const COPY = {
    en: {
      badge:    'WAITLIST OPEN',
      bar:      'Superluminal is coming to FOGO. Fair perps, 40ms execution.',
      barCta:   'Join Waitlist →',
      popupTag:     'Superluminal × FOGO',
      popupHead:    'Fair perps execution is coming.',
      popupSub:     'Dual Flow Batch Auctions match orders every 40ms. No FIFO. No speed advantage. Everyone gets the same execution quality, regardless of who came first.',
      popupCta:     'Join the Waitlist →',
      popupFooter:  'slx.fi · launching on FOGO',
      lbHeadL1: 'TRADE PERPS AT',
      lbHeadL2: 'THE SPEED OF FOGO.',
      lbTopRight: '·SUPERLUMINAL',
      lbBotRight: 'JOIN WAITLIST →',
      lbSub:    '40ms · 100k TPS · Fair execution',
      close:    '✕',
    },
    ko: {
      badge:    '대기자 모집 중',
      bar:      '슈퍼루미널, FOGO에 출시 예정. 공정한 퍼프 거래, 40ms 실행.',
      barCta:   '대기자 등록 →',
      popupTag:     '슈퍼루미널 × FOGO',
      popupHead:    '공정한 퍼프 실행이 다가오고 있습니다.',
      popupSub:     '이중 흐름 일괄 경매가 40ms마다 주문을 매칭합니다. FIFO 없음. 속도 우위 없음. 누가 먼저 왔든 관계없이 모두가 동일한 실행 품질을 받습니다.',
      popupCta:     '대기자 명단 참가하기 →',
      popupFooter:  'slx.fi · FOGO에서 출시 예정',
      lbHeadL1: 'FOGO의 속도로',
      lbHeadL2: '퍼프를 거래하세요.',
      lbTopRight: '·슈퍼루미널',
      lbBotRight: '대기자 등록 →',
      lbSub:    '40ms · 100k TPS · 공정한 실행',
      close:    '✕',
    }
  };

  /* ── SVG assets ── */
  const FOGO_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path fill="#FF3D00" d="M512 0A512 512 0 0 0 0 512a512 512 0 0 0 512 512 512 512 0 0 0 512-512A512 512 0 0 0 512 0Z"/>
    <path fill="#fff" d="M692.844 236.366H469.997l-31.935 128.058h-96.23l-40.464 162.444a34.12 34.12 0 0 0 33 42.41h81.463L339.407 876.12l259.74-274.8c20.552-21.752 5.198-57.632-24.657-57.632H450.27l38.253-153.674h209.6l27.669-111.21a34.12 34.12 0 0 0-32.974-42.438z"/>
  </svg>`;

  // Superluminal sunburst — radial marks arranged around a center circle
  function buildSLXSvg(color) {
    color = color || '#D5F455';
    const cx = 24, cy = 24, rays = 22;
    let marks = '';
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // inner & outer radius of ray
      const r1 = 8.5, r2 = 17.5;
      const x1 = cx + cos * r1, y1 = cy + sin * r1;
      const x2 = cx + cos * r2, y2 = cy + sin * r2;
      // perpendicular tick at outer end (clockwise)
      const tx = -sin * 2.8, ty = cos * 2.8;
      // inner tick (shorter, opposite side)
      const itx = sin * 1.8, ity = -cos * 1.8;
      marks += `
        <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="2.4" stroke-linecap="square"/>
        <line x1="${x2.toFixed(2)}" y1="${y2.toFixed(2)}" x2="${(x2+tx).toFixed(2)}" y2="${(y2+ty).toFixed(2)}" stroke="${color}" stroke-width="2.4" stroke-linecap="square"/>
        <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${(x1+itx).toFixed(2)}" y2="${(y1+ity).toFixed(2)}" stroke="${color}" stroke-width="1.6" stroke-linecap="square"/>`;
    }
    return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="24" cy="24" r="4.5" fill="${color}"/>
      ${marks}
    </svg>`;
  }

  /* ── inject styles ── */
  function injectStyles() {
    if (document.getElementById('slx-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'slx-banner-styles';
    style.textContent = `
      /* SLX Banner — shared */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      #slx-bar, #slx-popup * { box-sizing: border-box; font-family: 'Inter', sans-serif; }

      /* ── Top Bar ── */
      #slx-bar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        height: 46px;
        background: linear-gradient(90deg, #081C26 0%, #0C2535 40%, #0F2230 70%, #0A1A25 100%);
        border-bottom: 1px solid rgba(213, 244, 85, 0.18);
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 18px; gap: 14px;
        box-shadow: 0 2px 20px rgba(0,0,0,0.45);
        animation: slxBarIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        overflow: hidden;
      }
      #slx-bar::before {
        content: '';
        position: absolute; inset: 0;
        background: radial-gradient(ellipse 60% 200% at 80% 50%, rgba(255,61,0,0.07), transparent 60%);
        pointer-events: none;
      }
      @keyframes slxBarIn {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      #slx-bar.slx-hide {
        animation: slxBarOut 0.3s cubic-bezier(0.4, 0, 1, 1) both;
      }
      @keyframes slxBarOut {
        from { transform: translateY(0); opacity: 1; }
        to   { transform: translateY(-100%); opacity: 0; }
      }

      .slx-bar-left {
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .slx-cobrands {
        display: flex; align-items: center; gap: 6px;
      }
      .slx-logo-wrap {
        width: 22px; height: 22px; flex-shrink: 0;
      }
      .slx-fogo-wrap {
        width: 20px; height: 20px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      }
      .slx-x-sep {
        font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.30);
        letter-spacing: -0.02em; line-height: 1;
      }

      .slx-bar-badge {
        font-size: 8px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
        color: #D5F455;
        background: rgba(213, 244, 85, 0.10);
        border: 1px solid rgba(213, 244, 85, 0.28);
        border-radius: 3px; padding: 3px 7px; flex-shrink: 0;
      }
      .slx-bar-pipe {
        width: 1px; height: 16px; background: rgba(255,255,255,0.10); flex-shrink: 0;
      }

      .slx-bar-center {
        flex: 1; min-width: 0;
        display: flex; align-items: center; gap: 0;
        overflow: hidden;
      }
      .slx-bar-text {
        font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,0.82);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        letter-spacing: -0.005em;
      }
      .slx-bar-text .slx-name {
        font-weight: 700; color: #fff;
        font-style: italic;
        letter-spacing: -0.01em;
      }
      .slx-bar-text .slx-fogo-accent {
        font-weight: 700; color: #FF3D00;
      }

      .slx-bar-right {
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .slx-bar-cta {
        display: inline-flex; align-items: center;
        background: #D5F455; color: #0A1A22;
        font-family: 'Inter', sans-serif;
        font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
        padding: 7px 13px; border-radius: 4px; border: none;
        cursor: pointer; text-decoration: none; white-space: nowrap;
        transition: background 0.15s, transform 0.1s;
        box-shadow: 0 2px 10px rgba(213, 244, 85, 0.30);
      }
      .slx-bar-cta:hover { background: #e4ff6a; transform: translateY(-1px); }
      .slx-bar-cta:active { transform: translateY(0); }

      .slx-bar-close {
        width: 26px; height: 26px; border-radius: 50%;
        background: transparent; border: 1px solid rgba(255,255,255,0.14);
        color: rgba(255,255,255,0.45); font-size: 11px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.15s; flex-shrink: 0;
      }
      .slx-bar-close:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.28); }

      /* ── Popup ── */
      #slx-popup-overlay {
        position: fixed; inset: 0; z-index: 99998;
        background: rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: slxOverlayIn 0.3s ease both;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      @keyframes slxOverlayIn { from { opacity: 0; } to { opacity: 1; } }
      #slx-popup-overlay.slx-hide { animation: slxOverlayOut 0.25s ease both; }
      @keyframes slxOverlayOut { from { opacity: 1; } to { opacity: 0; } }

      #slx-popup {
        position: relative;
        width: 100%; max-width: 480px;
        background: linear-gradient(160deg, #0C2030 0%, #081620 50%, #0F1E28 100%);
        border: 1px solid rgba(213, 244, 85, 0.20);
        border-radius: 16px; overflow: hidden;
        box-shadow:
          0 30px 70px rgba(0,0,0,0.70),
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 0 60px rgba(213,244,85,0.06);
        animation: slxPopupIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes slxPopupIn {
        from { opacity: 0; transform: scale(0.92) translateY(16px); }
        to   { opacity: 1; transform: scale(1)    translateY(0); }
      }

      /* wavy texture overlay */
      #slx-popup::before {
        content: '';
        position: absolute; inset: 0; pointer-events: none; z-index: 0;
        background:
          radial-gradient(ellipse 80% 60% at 20% 80%, rgba(255,61,0,0.08), transparent 55%),
          radial-gradient(ellipse 70% 50% at 80% 10%, rgba(213,244,85,0.06), transparent 55%),
          radial-gradient(ellipse 100% 80% at 50% 120%, rgba(213,244,85,0.05), transparent 55%);
      }
      /* top accent bar */
      #slx-popup::after {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, transparent 0%, #FF3D00 25%, #D5F455 60%, transparent 100%);
        z-index: 1;
      }

      .slx-popup-inner {
        position: relative; z-index: 2;
        padding: 28px 28px 24px;
      }

      .slx-popup-close {
        position: absolute; top: 14px; right: 14px; z-index: 3;
        width: 30px; height: 30px; border-radius: 50%;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.45); font-size: 12px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
      }
      .slx-popup-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

      .slx-popup-brands {
        display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
      }
      .slx-popup-logo { width: 36px; height: 36px; flex-shrink: 0; }
      .slx-popup-fogo { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
      .slx-popup-x { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.25); letter-spacing: -0.03em; }

      .slx-popup-tag {
        font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
        color: #D5F455; margin-left: auto;
      }

      .slx-popup-badge {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 9px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
        color: #D5F455;
        background: rgba(213, 244, 85, 0.10);
        border: 1px solid rgba(213, 244, 85, 0.28);
        border-radius: 4px; padding: 4px 10px;
        margin-bottom: 12px;
      }
      .slx-popup-badge::before {
        content: ''; width: 6px; height: 6px; border-radius: 50%;
        background: #D5F455; box-shadow: 0 0 6px #D5F455;
        flex-shrink: 0;
      }

      .slx-popup-head {
        font-size: 22px; font-weight: 700; color: #fff; line-height: 1.15;
        letter-spacing: -0.02em; margin-bottom: 12px;
        font-style: italic;
      }
      .slx-popup-head .slx-fire { color: #FF3D00; font-style: normal; }

      .slx-popup-sub {
        font-size: 13px; color: rgba(255,255,255,0.62); line-height: 1.65;
        margin-bottom: 22px; font-weight: 400;
        text-wrap: pretty;
      }
      .slx-popup-sub strong { color: rgba(255,255,255,0.85); font-weight: 600; }

      .slx-popup-cta {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        width: 100%;
        background: #D5F455; color: #0A1A22;
        font-family: 'Inter', sans-serif;
        font-size: 14px; font-weight: 800; letter-spacing: 0.06em;
        padding: 15px 20px; border-radius: 10px; border: none;
        cursor: pointer; text-decoration: none;
        transition: all 0.15s;
        box-shadow: 0 6px 24px rgba(213, 244, 85, 0.28), inset 0 1px 0 rgba(255,255,255,0.20);
        margin-bottom: 12px;
      }
      .slx-popup-cta:hover { background: #e4ff6a; transform: translateY(-1px); box-shadow: 0 10px 30px rgba(213, 244, 85, 0.38); }
      .slx-popup-cta:active { transform: translateY(0); }

      .slx-popup-footer {
        text-align: center;
        font-size: 10px; color: rgba(255,255,255,0.28);
        letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace;
      }
      .slx-popup-footer .slx-fi-link { color: rgba(213,244,85,0.55); text-decoration: none; }

      /* divider */
      .slx-popup-divider {
        height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        margin: 16px 0;
      }

      /* ── Shared label (blocks strip inside popup) ── */
      .slx-stat-strip {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
        background: rgba(255,255,255,0.06);
        border-radius: 8px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 18px;
      }
      .slx-stat {
        padding: 10px 8px; background: rgba(8,20,30,0.70);
        display: flex; flex-direction: column; gap: 2px; text-align: center;
      }
      .slx-stat-v {
        font-size: 15px; font-weight: 700; color: #D5F455;
        font-family: 'JetBrains Mono', monospace; letter-spacing: -0.01em;
      }
      .slx-stat-v.fire { color: #FF3D00; }
      .slx-stat-l {
        font-size: 7px; letter-spacing: 0.18em; text-transform: uppercase;
        color: rgba(255,255,255,0.35); font-family: 'JetBrains Mono', monospace;
      }

      /* ── Leaderboard banner ── */
      #slx-lb {
        display: block; width: 100%; max-width: 728px;
        height: 110px; position: relative; overflow: hidden;
        border-radius: 10px; cursor: pointer;
        text-decoration: none;
        border: 1px solid rgba(213, 244, 85, 0.18);
        box-shadow: 0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03) inset;
        animation: slxLbIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
      }
      @keyframes slxLbIn {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      #slx-lb .slx-lb-inner {
        display: grid; grid-template-columns: 1fr 220px;
        height: 100%; position: relative; z-index: 2;
      }
      /* left col */
      #slx-lb .slx-lb-left {
        background: linear-gradient(120deg, #060E14 0%, #0A1C28 60%, #0C2030 100%);
        padding: 18px 22px;
        display: flex; flex-direction: column; justify-content: space-between;
        position: relative; overflow: hidden;
      }
      #slx-lb .slx-lb-left::before {
        content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
        background: linear-gradient(180deg, #FF3D00 0%, #D5F455 100%);
      }
      #slx-lb .slx-lb-left::after {
        content: ''; position: absolute; inset: 0;
        background: radial-gradient(ellipse 80% 120% at 0% 50%, rgba(255,61,0,0.10), transparent 55%);
        pointer-events: none;
      }
      #slx-lb .slx-lb-head {
        font-family: 'Clash Display', 'Inter', sans-serif;
        font-size: 26px; font-weight: 700; color: #fff;
        line-height: 1.05; letter-spacing: -0.02em;
        text-transform: uppercase; position: relative; z-index: 1;
      }
      #slx-lb .slx-lb-head .fire { color: #FF3D00; }
      #slx-lb .slx-lb-brands-row {
        display: flex; align-items: center; gap: 7px;
        position: relative; z-index: 1;
      }
      #slx-lb .slx-lb-mini-logo { width: 16px; height: 16px; flex-shrink: 0; }
      #slx-lb .slx-lb-mini-fogo { width: 14px; height: 14px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
      #slx-lb .slx-lb-mini-x { font-size: 9px; color: rgba(255,255,255,0.25); font-weight: 700; }
      #slx-lb .slx-lb-sub {
        font-family: 'JetBrains Mono', monospace;
        font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase;
        color: rgba(255,255,255,0.35); position: relative; z-index: 1;
      }
      /* right col — split top/bottom */
      #slx-lb .slx-lb-right {
        display: grid; grid-template-rows: 1fr 1px 1fr;
        border-left: 1px solid rgba(213, 244, 85, 0.14);
        background: linear-gradient(160deg, #0C2535 0%, #0A1E2C 50%, #081828 100%);
        position: relative; overflow: hidden;
      }
      #slx-lb .slx-lb-right::before {
        content: ''; position: absolute; inset: 0;
        background: radial-gradient(ellipse 120% 80% at 50% 0%, rgba(213,244,85,0.06), transparent 60%);
        pointer-events: none;
      }
      #slx-lb .slx-lb-cell {
        display: flex; align-items: center; justify-content: center;
        padding: 0 18px; position: relative; z-index: 1;
        transition: background 0.15s;
      }
      #slx-lb .slx-lb-cell:hover { background: rgba(213,244,85,0.05); }
      #slx-lb .slx-lb-divline {
        height: 1px; background: rgba(213,244,85,0.14); margin: 0;
      }
      #slx-lb .slx-lb-top-txt {
        font-style: italic; font-size: 20px; font-weight: 700;
        color: #fff; letter-spacing: -0.02em;
        font-family: Georgia, 'Times New Roman', serif;
      }
      #slx-lb .slx-lb-top-txt .dot { color: #D5F455; font-style: normal; }
      #slx-lb .slx-lb-bot-txt {
        font-family: 'Inter', sans-serif;
        font-size: 13px; font-weight: 800; letter-spacing: 0.10em;
        text-transform: uppercase; color: #D5F455;
        background: rgba(213,244,85,0.08);
        border: 1px solid rgba(213,244,85,0.25);
        padding: 9px 16px; border-radius: 6px;
        box-shadow: 0 0 16px rgba(213,244,85,0.14);
        white-space: nowrap;
      }
      /* responsive */
      @media (max-width: 600px) {
        #slx-lb { height: auto; }
        #slx-lb .slx-lb-inner { grid-template-columns: 1fr; }
        #slx-lb .slx-lb-right { grid-template-rows: auto; grid-template-columns: 1fr 1px 1fr; height: 56px; border-left: none; border-top: 1px solid rgba(213,244,85,0.14); }
        #slx-lb .slx-lb-divline { width: 1px; height: 100%; margin: 0; }
        #slx-lb .slx-lb-head { font-size: 20px; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── build bar HTML ── */
  function buildBar(lang) {
    const c = COPY[lang] || COPY.en;
    const el = document.createElement('div');
    el.id = 'slx-bar';
    el.setAttribute('data-lang', lang);
    el.innerHTML = `
      <div class="slx-bar-left">
        <div class="slx-cobrands">
          <div class="slx-logo-wrap">${buildSLXSvg('#D5F455')}</div>
          <span class="slx-x-sep">×</span>
          <div class="slx-fogo-wrap">${FOGO_SVG}</div>
        </div>
        <div class="slx-bar-badge">${c.badge}</div>
        <div class="slx-bar-pipe"></div>
      </div>
      <div class="slx-bar-center">
        <div class="slx-bar-text">
          <span class="slx-name">Superluminal</span>
          ${c.bar.replace('Superluminal', '').replace('FOGO', '<span class="slx-fogo-accent">FOGO</span>')}
        </div>
      </div>
      <div class="slx-bar-right">
        <a class="slx-bar-cta" href="${cfg.waitlistUrl}" target="_blank" rel="noopener noreferrer">${c.barCta}</a>
        ${cfg.dismissBar ? `<button class="slx-bar-close" id="slx-bar-close-btn" aria-label="Close">${c.close}</button>` : ''}
      </div>
    `;
    return el;
  }

  /* ── build leaderboard HTML ── */
  function buildLeaderboard(lang) {
    const c = COPY[lang] || COPY.en;
    const el = document.createElement('a');
    el.id = 'slx-lb';
    el.href = cfg.waitlistUrl;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    el.setAttribute('data-lang', lang);

    el.innerHTML = `
      <div class="slx-lb-inner">
        <div class="slx-lb-left">
          <div class="slx-lb-head">${c.lbHeadL1}<br>${c.lbHeadL2}</div>
          <div class="slx-lb-brands-row">
            <div class="slx-lb-mini-logo">${buildSLXSvg('#D5F455')}</div>
            <span class="slx-lb-mini-x">×</span>
            <div class="slx-lb-mini-fogo">${FOGO_SVG}</div>
            <span class="slx-lb-sub">${c.lbSub}</span>
          </div>
        </div>
        <div class="slx-lb-right">
          <div class="slx-lb-cell">
            <span class="slx-lb-top-txt"><span class="dot">·</span>${c.lbTopRight.replace('·','')}</span>
          </div>
          <div class="slx-lb-divline"></div>
          <div class="slx-lb-cell">
            <span class="slx-lb-bot-txt">${c.lbBotRight}</span>
          </div>
        </div>
      </div>
    `;
    return el;
  }

  /* ── build popup HTML ── */
  function buildPopup(lang) {
    const c = COPY[lang] || COPY.en;
    const overlay = document.createElement('div');
    overlay.id = 'slx-popup-overlay';

    const popup = document.createElement('div');
    popup.id = 'slx-popup';

    // format sub-copy with bold highlights
    const subFormatted = c.popupSub
      .replace('40ms', '<strong>40ms</strong>')
      .replace('No FIFO', '<strong>No FIFO</strong>')
      .replace('FIFO 없음', '<strong>FIFO 없음</strong>')
      .replace('40ms마다', '<strong>40ms</strong>마다');

    popup.innerHTML = `
      ${cfg.dismissPopup ? `<button class="slx-popup-close" id="slx-popup-close-btn" aria-label="Close">${c.close}</button>` : ''}
      <div class="slx-popup-inner">
        <div class="slx-popup-brands">
          <div class="slx-popup-logo">${buildSLXSvg('#D5F455')}</div>
          <span class="slx-popup-x">×</span>
          <div class="slx-popup-fogo">${FOGO_SVG}</div>
          <span class="slx-popup-tag">${c.popupTag}</span>
        </div>

        <div class="slx-popup-badge">${c.badge}</div>

        <div class="slx-popup-head">${c.popupHead}</div>

        <div class="slx-stat-strip">
          <div class="slx-stat"><span class="slx-stat-v">100k</span><span class="slx-stat-l">TPS</span></div>
          <div class="slx-stat"><span class="slx-stat-v">40ms</span><span class="slx-stat-l">Blocks</span></div>
          <div class="slx-stat"><span class="slx-stat-v fire">DFBA</span><span class="slx-stat-l">Execution</span></div>
        </div>

        <div class="slx-popup-sub">${subFormatted}</div>

        <a class="slx-popup-cta" href="${cfg.waitlistUrl}" target="_blank" rel="noopener noreferrer">${c.popupCta}</a>

        <div class="slx-popup-divider"></div>
        <div class="slx-popup-footer">
          <a class="slx-fi-link" href="${cfg.waitlistUrl}" target="_blank">${c.popupFooter}</a>
        </div>
      </div>
    `;

    overlay.appendChild(popup);

    // close on overlay click (outside popup)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) SLXBanner.hidePopup();
    });

    return overlay;
  }

  /* ── public API ── */
  const SLXBanner = {
    _lang: cfg.lang,
    _barEl: null,
    _popupEl: null,

    showLeaderboard: function (lang, container) {
      lang = lang || this._lang;
      // remove existing
      const old = document.getElementById('slx-lb');
      if (old) old.remove();
      const el = buildLeaderboard(lang);
      if (container) {
        container.appendChild(el);
      } else {
        // default: insert after nav or at top of body
        const nav = document.querySelector('nav') || document.querySelector('header');
        if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling);
        else document.body.insertBefore(el, document.body.firstChild);
      }
      return el;
    },

    hideLeaderboard: function () {
      const el = document.getElementById('slx-lb');
      if (el) el.remove();
    },

    setLang: function (lang) {
      this._lang = lang;
    },

    showBar: function (lang) {
      lang = lang || this._lang;
      this.hideBar(true); // instant remove old
      const el = buildBar(lang);
      this._barEl = el;
      document.body.insertBefore(el, document.body.firstChild);
      // wire close
      const closeBtn = document.getElementById('slx-bar-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { SLXBanner.hideBar(); });
      // push body down
      document.body.style.paddingTop = '46px';
    },

    hideBar: function (instant) {
      const el = this._barEl || document.getElementById('slx-bar');
      if (!el) return;
      if (instant) {
        el.remove();
        document.body.style.paddingTop = '';
      } else {
        el.classList.add('slx-hide');
        setTimeout(function () {
          el.remove();
          document.body.style.paddingTop = '';
        }, 350);
      }
      this._barEl = null;
    },

    showPopup: function (lang) {
      lang = lang || this._lang;
      this.hidePopup(true);
      const el = buildPopup(lang);
      this._popupEl = el;
      document.body.appendChild(el);
      // wire close
      const closeBtn = document.getElementById('slx-popup-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { SLXBanner.hidePopup(); });
    },

    hidePopup: function (instant) {
      const el = this._popupEl || document.getElementById('slx-popup-overlay');
      if (!el) return;
      if (instant) {
        el.remove();
      } else {
        el.classList.add('slx-hide');
        setTimeout(function () { el.remove(); }, 300);
      }
      this._popupEl = null;
    },
  };

  window.SLXBanner = SLXBanner;

  /* ── auto-init ── */
  function init() {
    injectStyles();
    if (cfg.showBar) SLXBanner.showBar(cfg.lang);
    if (cfg.showPopup) {
      if (cfg.popupDelay > 0) {
        setTimeout(function () { SLXBanner.showPopup(cfg.lang); }, cfg.popupDelay);
      } else {
        SLXBanner.showPopup(cfg.lang);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
