/* AP COPILOT v1.0 — auxiliary help assistant.
   Static, on-device knowledge base. This site has no backend and holds
   no server-side secrets (GitHub Pages, static only) — there is nowhere
   safe to keep a live-LLM API key client-side, so answers here are
   curated reference text, not generated. See settings.html's Passkeys
   section for the same "no backend" constraint applied elsewhere.
──────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  var SB_URL = 'https://uejlrooupfcrqimffgsn.supabase.co';
  var SB_KEY = 'sb_publishable_lNVg4KjZcmMqPgbOBJhTgA_dQM_yuO6';
  var FUNCTION_URL = SB_URL + '/functions/v1/copilot-chat';
  var sb = null;
  try { sb = supabase.createClient(SB_URL, SB_KEY); } catch (e) {}

  var NOTICE = 'NOTICE: AP CoPilot outputs are for auxiliary informational reference only. All field parameters and calculations must be independently validated by a licensed Professional Engineer (P.E. / P.Eng.).';
  var OUTPUT_TAG = '[ Auxiliary Output — Verify with P.E. prior to field execution ]';
  var GREETING = 'AP CoPilot online — I\'m an automated AI assistant, not a live person. I can help you navigate AP Workspace, explain standard formulas (ASME PCC-1 target torque, ASME B16.5 flange ratings, tubing pressure derating), and point you to the right calculator. I am not a P.E. — verify all outputs independently before field use. Ask me something, or use the Contact link in the footer for a real person.';
  var FALLBACK = 'I don’t have a reference answer for that yet. Try asking about flange ratings, bolt torque, tubing SWL, saved lookups, offline use, or passkeys — or use the Contact link in the footer for a direct question.';

  /* Distinct sparkle glyph — deliberately not another chat-bubble shape,
     so this reads as a separate control from the contact FAB rather
     than a duplicate of it. */
  var COPILOT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.8 5.7 5.7 1.8-5.7 1.8L12 17.5l-1.8-5.7L4.5 10l5.7-1.8L12 2.5z"/><path d="M19 15.5l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8.8-2.4z"/></svg>';

  var KB = [
    { kw:['torque','pcc-1','pcc1','bolt','tighten','sequence','preload','lube','k-factor','k factor'],
      a:'Bolt torque follows ASME PCC-1: target torque is derived from bolt size, material grade (e.g. ASTM A193 B7/L7), thread-lubricant K-factor, and target preload — then applied in a star-pattern, multi-pass sequence (commonly 30% → 60% → 100%) to seat the gasket evenly. Use the Bolt Torque Calculator (/torque/) for the numbers on your specific joint.' },
    { kw:['flange','rating','class','b16.5','b16 5','pressure class','ansi','api 6a','6a'],
      a:'Flange pressure-temperature ratings (ASME B16.5 / API 6A) set the maximum allowable working pressure for a given class (150#–2500#, or API 6A 2K/3K/5K/10K/15K) at a given temperature — rating drops as temperature rises. Use the Flange Slide Rule (/flange/) to look up dimensions and ratings by size and class.' },
    { kw:['tubing','swl','derat','safety block','bhn','hardness'],
      a:'Tubing/safety-block SWL (safe working load) is derived from material hardness (BHN) converted to estimated tensile strength, then reduced by a safety factor across the cross-sectional area — higher hardness and larger cross-section raise SWL, but heat, wear, and repeated loading derate it. Use the Safety Block Calculator (/tubing/) for a specific size and hardness.' },
    { kw:['save','saved','dashboard','lookup','history','log','export','csv'],
      a:'Any calculator result can be saved — look for "Save" near the result. Saved lookups appear on your Dashboard with the parameters, a summary, and the date. You can search, export to CSV, or delete entries from there.' },
    { kw:['offline','no signal','no internet','field use','pwa','install','home screen'],
      a:'AP Workspace works offline once you’ve visited a page while online — it’s installable as an app ("Add to Home Screen") and caches the calculators for field use with poor or no signal. Saving a lookup still needs a connection to sync.' },
    { kw:['passkey','face id','touch id','fingerprint','biometric'],
      a:'Passkeys let you sign in with Face ID / Touch ID / a device PIN instead of typing your password. Register one in Settings → Security → Passkeys, then use "Sign in with a passkey" on the login screen.' },
    { kw:['password','forgot','reset login','locked out','sign in','login','can\'t log in','cant log in'],
      a:'Use "Forgot?" on the sign-in screen for a password reset link by email. If you have a passkey registered on this device, "Sign in with a passkey" also works.' },
    { kw:['admin','role','permission','access level'],
      a:'Admin access is granted at the account level, not from inside the app — contact support if your account should have admin visibility.' },
    { kw:['who are you','what are you','what is this','copilot','help'],
      a:GREETING }
  ];

  function escHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function answer(query){
    var q=query.toLowerCase();
    var best=null,bestScore=0;
    KB.forEach(function(entry){
      var score=0;
      entry.kw.forEach(function(k){ if(q.indexOf(k)!==-1) score++; });
      if(score>bestScore){ bestScore=score; best=entry; }
    });
    return best ? best.a : FALLBACK;
  }

  function init(){
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Styles ── */
    var style = document.createElement('style');
    style.id = 'ap-copilot-style';
    style.textContent = [
      '#ap-copilot-fab{position:fixed;bottom:calc(76px + env(safe-area-inset-bottom,0px));left:20px;z-index:1000;',
        'width:48px;height:48px;border-radius:50%;background:var(--bg-panel,#151F2C);',
        'border:1px solid var(--precision-cyan,#19D3E6);color:var(--precision-cyan,#19D3E6);',
        'cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;',
        'box-shadow:0 2px 14px rgba(25,211,230,0.22);transition:transform 150ms,box-shadow 150ms}',
      '#ap-copilot-fab:hover{transform:scale(1.06);box-shadow:0 4px 20px rgba(25,211,230,0.35)}',
      '#ap-copilot-fab:focus-visible{outline:2px solid var(--precision-cyan,#19D3E6);outline-offset:3px}',
      '#ap-copilot-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;opacity:0;pointer-events:none;transition:opacity 220ms}',
      '#ap-copilot-overlay.open{opacity:1;pointer-events:auto}',
      '#ap-copilot-drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:100vw;z-index:1001;',
        'background:var(--bg-workspace,#0F1722);border-left:1px solid var(--border-color,#2B3A4C);',
        'display:flex;flex-direction:column;transform:translateX(100%);',
        'transition:'+(reduceMotion?'none':'transform 260ms cubic-bezier(0.4,0,0.2,1)')+';',
        'padding-bottom:env(safe-area-inset-bottom,0px)}',
      '#ap-copilot-drawer.open{transform:translateX(0)}',
      '@media (max-width:480px){#ap-copilot-drawer{width:100%}}',
      '.apc-header{display:flex;align-items:center;justify-content:space-between;gap:10px;',
        'padding:14px 16px;background:var(--bg-panel,#151F2C);border-bottom:1px solid var(--border-color,#2B3A4C);',
        'padding-top:calc(14px + env(safe-area-inset-top,0px))}',
      '.apc-title-row{display:flex;align-items:center;gap:8px;min-width:0}',
      '.apc-icon{color:var(--precision-cyan,#19D3E6);flex-shrink:0;display:flex}',
      '.apc-icon svg{width:15px;height:15px}',
      '.apc-title{font:600 11px var(--font-mono,monospace);letter-spacing:.04em;color:var(--precision-cyan,#19D3E6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.apc-badge{font:600 9.5px var(--font-ui,sans-serif);letter-spacing:.03em;color:var(--text-muted,#6C7D95);',
        'background:var(--bg-panel,#151F2C);border-bottom:1px solid var(--border-color,#2B3A4C);padding:6px 16px}',
      '.apc-close{background:none;border:none;color:var(--text-muted,#6C7D95);font-size:22px;line-height:1;',
        'cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;flex-shrink:0}',
      '.apc-close:hover{color:var(--text-primary,#F1F5F9);background:var(--bg-elevated,#1C2938)}',
      '.apc-notice{font:500 10.5px var(--font-ui,sans-serif);line-height:1.5;color:var(--status-warning,#F59E0B);',
        'background:rgba(245,158,11,.08);border-bottom:1px solid rgba(245,158,11,.25);padding:10px 16px}',
      '.apc-offline{font:600 11px var(--font-mono,monospace);letter-spacing:.03em;color:var(--status-warning,#F59E0B);',
        'background:rgba(245,158,11,.1);border-bottom:1px solid rgba(245,158,11,.25);padding:8px 16px}',
      '.apc-messages{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}',
      '.apc-msg{max-width:88%;font:400 12.5px var(--font-ui,sans-serif);line-height:1.5;padding:10px 12px;border-radius:8px;word-wrap:break-word}',
      '.apc-msg.user{align-self:flex-end;background:var(--precision-cyan,#19D3E6);color:#0B111A}',
      '.apc-msg.bot{align-self:flex-start;background:var(--bg-elevated,#1C2938);color:var(--text-primary,#F1F5F9);border:1px solid var(--border-color,#2B3A4C)}',
      '.apc-tag{align-self:flex-start;font:500 9.5px var(--font-mono,monospace);color:var(--text-muted,#6C7D95);',
        'letter-spacing:.02em;margin-top:-6px;max-width:88%}',
      '.apc-inputrow{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border-color,#2B3A4C);background:var(--bg-panel,#151F2C)}',
      '.apc-inputrow input{flex:1;height:44px;min-height:44px;font-size:16px;font-family:var(--font-ui,sans-serif);',
        'background:var(--bg-elevated,#1C2938);border:1px solid var(--border-color,#2B3A4C);border-radius:6px;',
        'color:var(--text-primary,#F1F5F9);padding:0 12px;transition:border-color 150ms,box-shadow 150ms}',
      '.apc-inputrow input:focus{outline:none;border-color:var(--precision-cyan,#19D3E6);box-shadow:0 0 0 3px rgba(25,211,230,.18)}',
      '.apc-inputrow input:disabled{opacity:.5;cursor:not-allowed}',
      '.apc-inputrow button{width:44px;height:44px;min-height:44px;flex-shrink:0;border-radius:6px;border:none;',
        'background:var(--precision-cyan,#19D3E6);color:#0B111A;font-size:16px;cursor:pointer;',
        'display:flex;align-items:center;justify-content:center;transition:filter 150ms}',
      '.apc-inputrow button:hover:not(:disabled){filter:brightness(1.1)}',
      '.apc-inputrow button:disabled{opacity:.5;cursor:not-allowed}'
    ].join('\n');
    document.head.appendChild(style);

    /* ── Markup ── */
    var fab = document.createElement('button');
    fab.id = 'ap-copilot-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label','Open AP CoPilot — automated AI assistant');
    fab.title = 'AP CoPilot (AI assistant)';
    fab.setAttribute('aria-haspopup','dialog');
    fab.setAttribute('aria-expanded','false');
    fab.innerHTML = COPILOT_ICON;

    var overlay = document.createElement('div');
    overlay.id = 'ap-copilot-overlay';

    var drawer = document.createElement('aside');
    drawer.id = 'ap-copilot-drawer';
    drawer.setAttribute('role','dialog');
    drawer.setAttribute('aria-modal','true');
    drawer.setAttribute('aria-labelledby','ap-copilot-title');
    drawer.setAttribute('aria-hidden','true');
    drawer.innerHTML = [
      '<div class="apc-header">',
        '<span class="apc-title-row">',
          '<span class="apc-icon">'+COPILOT_ICON+'</span>',
          '<span class="apc-title" id="ap-copilot-title">[ AP COPILOT v1.0 | AUXILIARY ASSISTANT ]</span>',
        '</span>',
        '<button type="button" class="apc-close" aria-label="Close AP CoPilot">×</button>',
      '</div>',
      '<div class="apc-badge">Automated AI assistant — not a live person</div>',
      '<div class="apc-notice">'+escHtml(NOTICE)+'</div>',
      '<div class="apc-offline" id="apc-offline-badge" hidden>[ ● OFFLINE MODE: AP COPILOT UNAVAILABLE ]</div>',
      '<div class="apc-messages" id="apc-messages" aria-live="polite"></div>',
      '<form class="apc-inputrow" id="apc-form">',
        '<input type="text" id="apc-input" placeholder="Ask about a calculator or formula…" autocomplete="off" maxlength="300" aria-label="Ask AP CoPilot">',
        '<button type="submit" id="apc-send" aria-label="Send">→</button>',
      '</form>'
    ].join('');

    document.body.appendChild(fab);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    /* ── Drag-to-reposition — lets the launcher be moved off whatever
       page content it happens to sit on top of. Position is per-device
       (localStorage), clamped to the viewport, and restored on load. ── */
    var FAB_POS_KEY = 'ap-copilot-fab-pos';
    function clampPos(x, y){
      var w = fab.offsetWidth || 48, h = fab.offsetHeight || 48;
      var maxX = window.innerWidth - w - 8;
      var maxY = window.innerHeight - h - 8;
      return { x: Math.min(Math.max(8, x), Math.max(8, maxX)), y: Math.min(Math.max(8, y), Math.max(8, maxY)) };
    }
    function applyPos(x, y){
      fab.style.left = x + 'px';
      fab.style.top = y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    }
    try {
      var savedPos = JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null');
      if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
        var c0 = clampPos(savedPos.x, savedPos.y);
        applyPos(c0.x, c0.y);
      }
    } catch(e){}
    window.addEventListener('resize', function(){
      if (fab.style.left) {
        var c = clampPos(parseFloat(fab.style.left), parseFloat(fab.style.top));
        applyPos(c.x, c.y);
      }
    });

    var messagesEl = drawer.querySelector('#apc-messages');
    var formEl = drawer.querySelector('#apc-form');
    var inputEl = drawer.querySelector('#apc-input');
    var sendBtn = drawer.querySelector('#apc-send');
    var offlineBadge = drawer.querySelector('#apc-offline-badge');
    var closeBtn = drawer.querySelector('.apc-close');
    var greeted = false;
    var isOpen = false;

    function addMessage(role, text){
      var msg = document.createElement('div');
      msg.className = 'apc-msg ' + (role === 'user' ? 'user' : 'bot');
      msg.textContent = text;
      messagesEl.appendChild(msg);
      if (role === 'bot') {
        var tag = document.createElement('div');
        tag.className = 'apc-tag';
        tag.textContent = OUTPUT_TAG;
        messagesEl.appendChild(tag);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setOffline(offline){
      offlineBadge.hidden = !offline;
      inputEl.disabled = offline;
      sendBtn.disabled = offline;
    }
    setOffline(!navigator.onLine);
    window.addEventListener('online', function(){ setOffline(false); });
    window.addEventListener('offline', function(){ setOffline(true); });

    function openDrawer(){
      isOpen = true;
      overlay.classList.add('open');
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
      fab.setAttribute('aria-expanded','true');
      if (!greeted) { greeted = true; addMessage('bot', GREETING); }
      if (!inputEl.disabled) setTimeout(function(){ inputEl.focus(); }, reduceMotion ? 0 : 270);
    }
    function closeDrawer(){
      isOpen = false;
      overlay.classList.remove('open');
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden','true');
      fab.setAttribute('aria-expanded','false');
      fab.focus();
    }

    var dragging = false, moved = false, suppressClick = false, startX = 0, startY = 0, origX = 0, origY = 0;
    fab.addEventListener('pointerdown', function(e){
      dragging = true; moved = false;
      var r = fab.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      origX = r.left; origY = r.top;
      fab.style.cursor = 'grabbing';
      try { fab.setPointerCapture(e.pointerId); } catch(e2){}
    });
    fab.addEventListener('pointermove', function(e){
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) moved = true;
      if (!moved) return;
      var c = clampPos(origX + dx, origY + dy);
      applyPos(c.x, c.y);
    });
    fab.addEventListener('pointerup', function(){
      if (!dragging) return;
      dragging = false;
      fab.style.cursor = 'grab';
      if (moved) {
        suppressClick = true;
        var r = fab.getBoundingClientRect();
        try { localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x: r.left, y: r.top })); } catch(e2){}
      }
    });
    fab.addEventListener('click', function(){
      if (suppressClick) { suppressClick = false; return; }
      isOpen ? closeDrawer() : openDrawer();
    });
    closeBtn.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && isOpen) closeDrawer();
    });

    /* ── Live AI (optional) ──────────────────────
       Requires a signed-in session and the copilot-chat Edge Function
       to be deployed (see supabase/functions/copilot-chat/README.md).
       Falls back to the static knowledge base on any failure — no
       session (public login page), offline, function not deployed
       yet, or a request error — so the widget never looks broken.
    ──────────────────────────────────────────────── */
    var chatHistory = [];
    function getLiveReply(text){
      if (!navigator.onLine || !sb) return Promise.reject(new Error('unavailable'));
      return sb.auth.getSession().then(function(r){
        var session = r && r.data && r.data.session;
        if (!session) return Promise.reject(new Error('signed out'));
        return fetch(FUNCTION_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer ' + session.access_token,
            'apikey': SB_KEY
          },
          body: JSON.stringify({ message: text, history: chatHistory })
        });
      }).then(function(res){
        if (!res.ok) return Promise.reject(new Error('bad status'));
        return res.json();
      }).then(function(data){
        if (!data || !data.reply) return Promise.reject(new Error('no reply'));
        return data.reply;
      });
    }

    formEl.addEventListener('submit', function(e){
      e.preventDefault();
      var text = inputEl.value.trim();
      if (!text || inputEl.disabled) return;
      addMessage('user', text);
      inputEl.value = '';
      chatHistory.push({ role: 'user', content: text });
      getLiveReply(text).then(function(reply){
        chatHistory.push({ role: 'assistant', content: reply });
        if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
        addMessage('bot', reply);
      }).catch(function(){
        addMessage('bot', answer(text));
      });
    });
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
