(function(){
  var track = document.getElementById('track');
  var slides = track.children;
  var total = slides.length;
  var counter = document.getElementById('slideCounter');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var dotsWrap = document.getElementById('dots');

  for (var i = 0; i < total; i++) {
    var dot = document.createElement('button');
    dot.className = 'slide-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    dot.dataset.index = i;
    dot.addEventListener('click', function() { goTo(parseInt(this.dataset.index, 10)); });
    dotsWrap.appendChild(dot);
  }
  var dots = dotsWrap.children;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function currentIndex() {
    var w = slides[0].getBoundingClientRect().width + 20;
    return Math.round(track.scrollLeft / w);
  }

  function update() {
    var idx = Math.min(total - 1, Math.max(0, currentIndex()));
    counter.textContent = '[ SLIDE ' + pad(idx + 1) + ' / ' + pad(total) + ' ]';
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === total - 1;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i === idx);
  }

  function goTo(idx) {
    idx = Math.min(total - 1, Math.max(0, idx));
    var w = slides[0].getBoundingClientRect().width + 20;
    track.scrollTo({ left: idx * w, behavior: 'smooth' });
  }

  prevBtn.addEventListener('click', function() { goTo(currentIndex() - 1); });
  nextBtn.addEventListener('click', function() { goTo(currentIndex() + 1); });
  track.addEventListener('scroll', function() {
    window.requestAnimationFrame(update);
  }, { passive: true });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight') goTo(currentIndex() + 1);
    if (e.key === 'ArrowLeft') goTo(currentIndex() - 1);
  });

  update();

  /* ── Demo toggle switches (slide 5) — were onclick= attributes ── */
  var toggleDemos = document.querySelectorAll('.toggle-demo');
  for (var ti = 0; ti < toggleDemos.length; ti++) {
    toggleDemos[ti].addEventListener('click', function() { this.classList.toggle('on'); });
  }

  /* ── Live color tokens — read from computed style ── */
  var TOKENS = [
    ['--bg-app', 'App canvas — the base layer behind everything.'],
    ['--bg-workspace', 'Shell chrome — sidebars, topbars, sticky headers.'],
    ['--bg-panel', 'Cards, modals, panels — one step up from the shell.'],
    ['--bg-elevated', 'Inputs and elevated tiles inside a panel.'],
    ['--border-color', 'All borders and dividers, site-wide.'],
    ['--precision-cyan', 'The single interactive accent — links, focus rings, primary actions.'],
    ['--status-safe', 'Success, safe values, online indicators.'],
    ['--status-warning', 'Caution — clamped values, degraded state.'],
    ['--status-danger', 'Errors, invalid input, destructive actions.']
  ];
  var cs = getComputedStyle(document.documentElement);
  var swatchGrid = document.getElementById('swatchGrid');
  TOKENS.forEach(function(t) {
    var val = cs.getPropertyValue(t[0]).trim();
    var card = document.createElement('div');
    card.className = 'swatch';
    card.innerHTML =
      '<div class="swatch-chip" style="background:var(' + t[0] + ')"></div>' +
      '<div class="swatch-body">' +
        '<span class="swatch-token">' + t[0] + '</span>' +
        '<span class="swatch-hex">' + (val || '—') + '</span>' +
        '<span class="swatch-usage">' + t[1] + '</span>' +
      '</div>';
    swatchGrid.appendChild(card);
  });

  /* ── Icon matrix — real markup pulled from the live pages ── */
  var ICONS = [
    { name: 'hamburger', src: 'dashboard.html sidebar toggle', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' },
    { name: 'search', src: 'dashboard.html topbar search', stroke: '2.5',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' },
    { name: 'back-to-top', src: 'global-features.js #back-to-top', stroke: '2.5',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' },
    { name: 'eye (show pw)', src: 'index.html password toggle', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
    { name: 'chevron (FAQ)', src: 'premium.css .faq-chevron', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' },
    { name: 'settings (gear)', src: 'dashboard.html nav item', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
    { name: 'sign-out', src: 'dashboard.html sidebar footer', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' },
    { name: 'contact / mail', src: 'footer Contact button (all pages)', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' },
    { name: 'flange tool', src: 'index.html launcher tile', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/></svg>' },
    { name: 'torque tool', src: 'index.html launcher tile', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' },
    { name: 'tubing tool', src: 'index.html launcher tile', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M12 7v10M7 7v10M17 7v10"/></svg>' },
    { name: 'reset / refresh', src: 'sw-update-banner "Refresh" action', stroke: '2',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' }
  ];
  var grid = document.getElementById('iconGrid');
  ICONS.forEach(function(ic) {
    var card = document.createElement('div');
    card.className = 'icon-card';
    card.innerHTML =
      ic.svg +
      '<span class="icon-name">' + ic.name + '</span>' +
      '<span class="icon-src">' + ic.src + ' · sw ' + ic.stroke + '</span>' +
      '<button class="copy-svg-btn">Copy SVG</button>';
    var btn = card.querySelector('.copy-svg-btn');
    btn.addEventListener('click', function() {
      var raw = ic.svg.replace('width="20" height="20"', 'width="24" height="24"');
      navigator.clipboard.writeText(raw).then(function() {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch(e){} }
        setTimeout(function() { btn.textContent = 'Copy SVG'; btn.classList.remove('copied'); }, 1600);
      });
    });
    grid.appendChild(card);
  });
})();
