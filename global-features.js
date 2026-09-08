/* ════════════════════════════════════════════════
   AP WORKSPACE — global-features.js
   Shared features: cookie banner, back-to-top,
   scroll progress, floating contact, UTM tracking,
   skip-to-content, loading transitions.
   Include before </body> on every page.
════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 1. UTM Tracking ─────────────────────────
     Capture UTM params on first landing.
  ──────────────────────────────────────────────── */
  (function captureUTM() {
    var p = new URLSearchParams(window.location.search);
    var keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
    keys.forEach(function(k) {
      var v = p.get(k);
      if (v) { try { sessionStorage.setItem(k, v); } catch(e){} }
    });
  })();

  /* ── 2. Scroll Progress Bar ──────────────────
     Thin precision-cyan bar at top of viewport.
  ──────────────────────────────────────────────── */
  var prog = document.createElement('div');
  prog.id = 'scroll-progress';
  prog.setAttribute('role', 'progressbar');
  prog.setAttribute('aria-label', 'Page scroll progress');
  prog.style.cssText = [
    'position:fixed','top:0','left:0','height:2px','width:0%',
    'background:var(--precision-cyan,#19D3E6)',
    'z-index:9999','transition:width 100ms linear','pointer-events:none',
    'border-radius:0 1px 1px 0'
  ].join(';');
  document.body.insertBefore(prog, document.body.firstChild);

  function updateProgress() {
    var el = document.documentElement;
    var scrolled = el.scrollTop || document.body.scrollTop;
    var total = el.scrollHeight - el.clientHeight;
    if (total < 50) { prog.style.display = 'none'; return; }
    prog.style.display = '';
    prog.style.width = (scrolled / total * 100) + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  /* ── 3. Back-to-Top Button ───────────────────
     Appears after scrolling 400px.
  ──────────────────────────────────────────────── */
  var btt = document.createElement('button');
  btt.id = 'back-to-top';
  btt.setAttribute('aria-label', 'Back to top');
  btt.setAttribute('title', 'Back to top');
  btt.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
  btt.style.cssText = [
    'position:fixed','bottom:72px','right:20px','z-index:800',
    'width:36px','height:36px','border-radius:50%',
    'background:var(--bg-elevated,#1C2938)',
    'border:1px solid var(--border-color,#2B3A4C)',
    'color:var(--text-secondary,#94A3B8)',
    'cursor:pointer','display:flex','align-items:center','justify-content:center',
    'opacity:0','transform:translateY(8px)','pointer-events:none','will-change:transform,opacity',
    'transition:opacity 200ms,transform 200ms,color 150ms,border-color 150ms',
    'box-shadow:0 2px 8px rgba(0,0,0,0.25)'
  ].join(';');
  document.body.appendChild(btt);

  btt.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  btt.addEventListener('mouseenter', function() {
    btt.style.color = 'var(--precision-cyan,#19D3E6)';
    btt.style.borderColor = 'var(--precision-cyan,#19D3E6)';
  });
  btt.addEventListener('mouseleave', function() {
    btt.style.color = 'var(--text-secondary,#94A3B8)';
    btt.style.borderColor = 'var(--border-color,#2B3A4C)';
  });

  var bttVisible = false;
  window.addEventListener('scroll', function() {
    var show = (window.scrollY || document.documentElement.scrollTop) > 400;
    if (show === bttVisible) return;
    bttVisible = show;
    btt.style.opacity = show ? '1' : '0';
    btt.style.transform = show ? 'translateY(0)' : 'translateY(8px)';
    btt.style.pointerEvents = show ? 'auto' : 'none';
  }, { passive: true });

  /* ── 4. Cookie / Notice Banner ───────────────
     Minimal functional notice. Dismissed once.
  ──────────────────────────────────────────────── */
  (function initCookieBanner() {
    try { if (localStorage.getItem('ap-cookies-ok')) return; } catch(e){}

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Site notice');
    banner.style.cssText = [
      'position:fixed','bottom:0','left:0','right:0',
      'background:var(--bg-panel,#151F2C)',
      'border-top:1px solid var(--border-color,#2B3A4C)',
      'padding:12px 20px',
      'display:flex','align-items:center','flex-wrap:wrap','gap:10px 16px',
      'z-index:700','font-family:var(--font-ui,Inter,sans-serif)',
      'font-size:11px','color:var(--text-secondary,#94A3B8)',
      'transition:transform 300ms ease'
    ].join(';');

    banner.innerHTML = [
      '<span style="flex:1;min-width:200px">',
        'AP WORKSPACE uses essential session cookies for authentication. No tracking or advertising.',
      '</span>',
      '<button id="cookie-ok" style="',
        'background:var(--precision-cyan,#19D3E6);color:#0B111A;',
        'border:none;border-radius:4px;padding:6px 14px;',
        'font:600 11px var(--font-ui,Inter,sans-serif);',
        'cursor:pointer;white-space:nowrap;min-height:32px',
      '">Got it</button>'
    ].join('');

    document.body.appendChild(banner);

    document.getElementById('cookie-ok').addEventListener('click', function() {
      banner.style.transform = 'translateY(100%)';
      setTimeout(function() { banner.remove(); }, 310);
      try { localStorage.setItem('ap-cookies-ok','1'); } catch(e){}
    });
  })();

  /* ── 4b. Engineering Disclaimer Notice ───────
     Persistent, once-per-session notice on the calculator
     tool pages only. Dismissing sets sessionStorage so it
     doesn't reappear on the same visit; a fresh tab/session
     shows it again. Stacks above the cookie banner if both
     are present rather than overlapping it.
  ──────────────────────────────────────────────── */
  (function initEngineeringDisclaimer() {
    var isToolPage = /^\/(flange|torque|tubing)\/?/.test(location.pathname);
    if (!isToolPage) return;
    try { if (sessionStorage.getItem('ap-eng-ack')) return; } catch(e){}

    var cookieBanner = document.getElementById('cookie-banner');
    var offset = cookieBanner ? cookieBanner.offsetHeight : 0;

    var notice = document.createElement('div');
    notice.id = 'eng-disclaimer';
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-label', 'Engineering disclaimer');
    notice.style.cssText = [
      'position:fixed','left:0','right:0','bottom:' + offset + 'px',
      'background:var(--bg-elevated,#1C2938)',
      'border-top:1px solid rgba(245,158,11,.35)',
      'padding:12px 20px',
      'display:flex','align-items:center','flex-wrap:wrap','gap:8px 16px',
      'z-index:750','font-family:var(--font-ui,Inter,sans-serif)',
      'font-size:11px','line-height:1.5','color:var(--text-secondary,#94A3B8)',
      'transition:transform 300ms ease'
    ].join(';');

    notice.innerHTML = [
      '<span style="flex:1;min-width:240px">',
        '<strong style="color:var(--status-warning,#F59E0B)">Reference only.</strong> ',
        'Outputs are preliminary and must be independently verified by a licensed P.E. / P.Eng. before field execution. ',
        '<a href="/disclaimer/" style="color:var(--precision-cyan,#19D3E6);text-decoration:underline">Full disclaimer</a>',
      '</span>',
      '<button id="eng-ack" style="',
        'background:var(--precision-cyan,#19D3E6);color:#0B111A;',
        'border:none;border-radius:4px;padding:6px 14px;',
        'font:600 11px var(--font-ui,Inter,sans-serif);',
        'cursor:pointer;white-space:nowrap;min-height:36px',
      '">Acknowledge &amp; Proceed</button>'
    ].join('');

    document.body.appendChild(notice);

    document.getElementById('eng-ack').addEventListener('click', function() {
      notice.style.transform = 'translateY(100%)';
      setTimeout(function() { notice.remove(); }, 310);
      try { sessionStorage.setItem('ap-eng-ack', '1'); } catch(e){}
    });
  })();

  /* ── 5. Floating Contact Button ──────────────
     FAB bottom-right. Email assembled at runtime.
  ──────────────────────────────────────────────── */
  var fab = document.createElement('button');
  fab.id = 'float-contact';
  fab.setAttribute('aria-label', 'Contact support');
  fab.setAttribute('title', 'Contact support');
  fab.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var engNotice = document.getElementById('eng-disclaimer');
  var fabBottom = 20 + (engNotice ? engNotice.offsetHeight + 12 : 0);
  fab.style.cssText = [
    'position:fixed','bottom:' + fabBottom + 'px','right:20px','z-index:800',
    'width:40px','height:40px','border-radius:50%',
    'background:var(--precision-cyan,#19D3E6)',
    'border:none','color:#0B111A',
    'cursor:pointer','display:flex','align-items:center','justify-content:center',
    'box-shadow:0 2px 12px rgba(25,211,230,0.3)',
    'transition:transform 200ms,box-shadow 200ms'
  ].join(';');

  fab.addEventListener('mouseenter', function() {
    fab.style.transform = 'scale(1.08)';
    fab.style.boxShadow = '0 4px 20px rgba(25,211,230,0.45)';
  });
  fab.addEventListener('mouseleave', function() {
    fab.style.transform = '';
    fab.style.boxShadow = '0 2px 12px rgba(25,211,230,0.3)';
  });
  fab.addEventListener('click', function() {
    var e = 'support' + '@' + 'app' + '.' + 'anjanpatel' + '.' + 'ca';
    window.location.href = 'mailto:' + e;
  });

  document.body.appendChild(fab);

  /* ── 6. Skip to Content ──────────────────────
     Accessibility: visible on keyboard focus.
  ──────────────────────────────────────────────── */
  var skip = document.createElement('a');
  skip.href = '#main-content';
  skip.textContent = 'Skip to main content';
  skip.style.cssText = [
    'position:absolute','top:-60px','left:0',
    'background:var(--precision-cyan,#19D3E6)','color:#0B111A',
    'padding:8px 16px','font:600 12px var(--font-ui,Inter,sans-serif)',
    'border-radius:0 0 4px 0','z-index:9999','text-decoration:none',
    'transition:top 150ms ease'
  ].join(';');
  skip.addEventListener('focus', function() { skip.style.top = '0'; });
  skip.addEventListener('blur',  function() { skip.style.top = '-60px'; });
  document.body.insertBefore(skip, document.body.firstChild);

  /* ── 7. Last Updated Date ────────────────────
     Populates any .ap-last-updated span.
  ──────────────────────────────────────────────── */
  document.querySelectorAll('.ap-last-updated').forEach(function(el) {
    var d = el.dataset.date;
    if (d) {
      try {
        var dt = new Date(d);
        el.textContent = 'Updated ' + dt.toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' });
      } catch(e) {}
    }
  });

  /* ── 8. Expandable FAQ ───────────────────────
     Initialises .faq-q buttons with aria toggles.
  ──────────────────────────────────────────────── */
  document.querySelectorAll('.faq-q').forEach(function(btn) {
    btn.setAttribute('aria-expanded', 'false');
    var answer = btn.nextElementSibling;
    if (!answer) return;
    btn.addEventListener('click', function() {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      answer.classList.toggle('open', !open);
    });
  });

  /* ── 9. Copy Buttons ─────────────────────────
     Activates .copy-btn elements — copies sibling
     output or data-copy-target selector content.
  ──────────────────────────────────────────────── */
  document.querySelectorAll('.copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.dataset.copyTarget
        ? document.querySelector(btn.dataset.copyTarget)
        : btn.previousElementSibling;
      if (!target) return;
      var text = target.value !== undefined ? target.value : target.textContent;
      text = (text || '').trim();
      if (!text || text === '—' || target.querySelector('.swl-empty-msg')) {
        var origEmpty = btn.textContent;
        btn.textContent = 'Nothing yet';
        setTimeout(function() { btn.textContent = origEmpty; }, 1400);
        return;
      }
      try {
        navigator.clipboard.writeText(text).then(function() {
          var orig = btn.textContent;
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch(e){} }
          setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
        });
      } catch(e) {}
    });
  });

  /* ── 9b. "/" focuses the primary field ───────
     Skipped while typing in a field already. Ctrl/Cmd+C is left
     alone deliberately — hijacking it would break normal text
     selection/copy anywhere else on the page.
  ──────────────────────────────────────────────── */
  document.addEventListener('keydown', function(e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var target = document.querySelector('#tbSearch, input[type="search"], input[type="number"]:not([disabled]), input[type="text"]:not([disabled])');
    if (target) { e.preventDefault(); target.focus(); if (target.select) target.select(); }
  });

  /* ── 10. Footer copyright year ───────────────
     Fills any .ap-year span with current year.
  ──────────────────────────────────────────────── */
  document.querySelectorAll('.ap-year').forEach(function(el) {
    el.textContent = new Date().getFullYear();
  });

})();
