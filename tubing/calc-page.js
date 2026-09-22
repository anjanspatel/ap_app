/* ── theme ──
   Icon (and now the text label) reflects the *current* theme — moon
   while dark, sun while light — matching login's toggle. This used to
   show a sun glyph while already in dark mode, which read backwards;
   fixed while adding the label, since a label needs the icon to agree
   with it. */
(function(){
  var root = document.documentElement;
  var btn  = document.getElementById('themeBtn');
  var icon = document.getElementById('themeIcon');
  var label = document.getElementById('themeLabel');
  function isDark(){
    var t = root.dataset.theme;
    return t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  }
  function syncIcon(){
    icon.textContent = isDark() ? '\u263e' : '\u2600';
    if(label) label.textContent = isDark() ? 'Dark' : 'Light';
  }
  function apply(t){
    if(t){ root.dataset.theme = t; } else { delete root.dataset.theme; }
    syncIcon();
  }
  function stored(){ try{return localStorage.getItem('ap-theme')||''}catch(e){return ''} }
  function store(t){ try{localStorage.setItem('ap-theme',t)}catch(e){} }
  apply(stored());
  btn.addEventListener('click',function(){
    var next = isDark()?'light':'dark';
    store(next); apply(next);
  });
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(){
    if(!stored()) apply('');
  });
  document.getElementById('yr').textContent = new Date().getFullYear();
})();

/* ── calculator ── */
var _u = 'imp';

function setUnits(u){
  _u = u;
  document.getElementById('btnImp').classList.toggle('active', u==='imp');
  document.getElementById('btnMet').classList.toggle('active', u==='met');
  document.getElementById('lblW').textContent = u==='met'?'mm':'in';
  document.getElementById('lblT').textContent = u==='met'?'mm':'in';
  document.getElementById('inW').placeholder  = u==='met'?'e.g. 100.0':'e.g. 4.000';
  document.getElementById('inT').placeholder  = u==='met'?'e.g. 60.0':'e.g. 2.500';
  calc();
  syncURL();
}

/* ── Shareable URL — silently synced, no reload ── */
function buildTubingParams(){
  var p=new URLSearchParams();
  var bhn=document.getElementById('inBHN').value;
  var w=document.getElementById('inW').value;
  var t=document.getElementById('inT').value;
  if(bhn)p.set('bhn',bhn);
  if(w)p.set('w',w);
  if(t)p.set('t',t);
  if(_u==='met')p.set('units','met');
  return p;
}
function syncURL(){
  try{ history.replaceState(null,'',location.pathname+'?'+buildTubingParams().toString()); }catch(e){}
}
(function(){
  try{
    var p=new URLSearchParams(location.search);
    var pu=p.get('units');
    if(pu==='met')setUnits('met');
    var pb=p.get('bhn'), pw=p.get('w'), pt=p.get('t');
    if(pb)document.getElementById('inBHN').value=pb;
    if(pw)document.getElementById('inW').value=pw;
    if(pt)document.getElementById('inT').value=pt;
    if(pb||pw||pt)calc();
  }catch(e){}
})();
(function(){
  var shareBtn=document.getElementById('shareBtn');
  if(!shareBtn)return;
  var toast=document.createElement('span');
  toast.className='share-toast';
  toast.textContent='Link copied!';
  shareBtn.appendChild(toast);
  shareBtn.addEventListener('click',function(){
    syncURL();
    var url=location.href;
    function showCopied(){
      shareBtn.classList.add('copied');
      setTimeout(function(){shareBtn.classList.remove('copied');},2000);
    }
    function fallback(){
      try{
        var ta=document.createElement('textarea');
        ta.value=url;ta.style.position='fixed';ta.style.opacity='0';
        document.body.appendChild(ta);ta.focus();ta.select();
        document.execCommand('copy');document.body.removeChild(ta);
        showCopied();
      }catch(e){}
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(showCopied).catch(fallback);
    }else{ fallback(); }
  });
})();

function n(x, dec){ return x.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }

function setStep(idx, eq, val){
  document.getElementById('eq'+idx).textContent = eq;
  var vEl = document.getElementById('v'+idx);
  vEl.textContent = val;
  vEl.className = 'step-val';
  document.getElementById('s'+idx).classList.remove('dimmed');
}

function clearAll(msg, isError){
  for(var i=1;i<=5;i++){
    var vEl = document.getElementById('v'+i);
    vEl.textContent = '—';
    vEl.className = 'step-val pending';
    document.getElementById('s'+i).classList.add('dimmed');
  }
  var cls = isError ? 'swl-empty-msg is-error' : 'swl-empty-msg';
  document.getElementById('swlNum').innerHTML = '<span class="' + cls + '">' + (msg || 'Enter values →') + '</span>';
  document.getElementById('swlAlt').textContent = '';
}

function setFieldError(el){
  var grp = el.closest('.input-group');
  if(grp) grp.classList.add('has-error');
}
function clearFieldError(el){
  var grp = el.closest('.input-group');
  if(grp) grp.classList.remove('has-error');
}

function calc(){
  var bhnEl = document.getElementById('inBHN');
  var wEl   = document.getElementById('inW');
  var tEl   = document.getElementById('inT');
  var bhn  = parseFloat(bhnEl.value);
  var wRaw = parseFloat(wEl.value);
  var tRaw = parseFloat(tEl.value);

  clearFieldError(bhnEl); clearFieldError(wEl); clearFieldError(tEl);

  var allEmpty = !bhnEl.value.trim() && !wEl.value.trim() && !tEl.value.trim();
  if(allEmpty){ clearAll(); return; }

  var hasError = false;
  if(bhnEl.value.trim() && (!isFinite(bhn)||bhn<=0)){ setFieldError(bhnEl); hasError = true; }
  if(wEl.value.trim()   && (!isFinite(wRaw)||wRaw<=0)){ setFieldError(wEl);  hasError = true; }
  if(tEl.value.trim()   && (!isFinite(tRaw)||tRaw<=0)){ setFieldError(tEl);  hasError = true; }

  if(hasError || !isFinite(bhn)||bhn<=0 || !isFinite(wRaw)||wRaw<=0 || !isFinite(tRaw)||tRaw<=0){
    clearAll(hasError ? 'Check inputs above →' : 'Enter values →', hasError);
    return;
  }

  /* convert to inches for calculation */
  var w_in = _u==='met' ? wRaw/25.4 : wRaw;
  var t_in = _u==='met' ? tRaw/25.4 : tRaw;

  /* pure formula lives in calc.js — shared with the test suite */
  var result = computeSWL(bhn, w_in, t_in);
  var uts = result.uts, tau = result.tau, area = result.area, swl_lbs = result.swl_lbs;

  /* step 1: UTS */
  setStep(1,
    'UTS = 500 × ' + n(bhn,0) + ' HB',
    n(uts,0) + ' psi'
  );

  /* step 2: shear strength */
  setStep(2,
    'τ = ' + n(uts,0) + ' × 0.577',
    n(tau,0) + ' psi'
  );

  /* step 3: area */
  var areaEq;
  if(_u==='met'){
    var area_mm2 = wRaw * tRaw;
    areaEq = 'A = ' + n(wRaw,2) + ' mm × ' + n(tRaw,2) + ' mm';
    setStep(3, areaEq, n(area_mm2,2) + ' mm²  =  ' + n(area,4) + ' in²');
  } else {
    areaEq = 'A = ' + n(w_in,3) + ' in × ' + n(t_in,3) + ' in';
    setStep(3, areaEq, n(area,4) + ' in²');
  }

  /* step 4: SWL in lbs */
  setStep(4,
    'SWL = (' + n(tau,0) + ' ÷ 3) × ' + n(area,4),
    n(swl_lbs,0) + ' lbs'
  );

  /* step 5: convert */
  var swl_tons = swl_lbs / 2000;
  var swl_mt   = swl_lbs / 2204.622;
  var swl_kn   = swl_lbs * 0.004448222;
  setStep(5,
    'SWL = ' + n(swl_lbs,0) + ' lbs ÷ 2,000',
    n(swl_tons,2) + ' US tons  ·  ' + n(swl_mt,2) + ' t  ·  ' + n(swl_kn,1) + ' kN'
  );

  /* hero */
  var swlNumEl = document.getElementById('swlNum');
  var newSwlHtml = n(swl_tons,1) + '<span class="swl-u">&nbsp;US tons</span>';
  if(swlNumEl.innerHTML !== newSwlHtml){
    swlNumEl.innerHTML = newSwlHtml;
    swlNumEl.classList.remove('ap-value-pulse');
    void swlNumEl.offsetWidth;
    swlNumEl.classList.add('ap-value-pulse');
  }
  document.getElementById('swlAlt').textContent =
    n(swl_mt,2) + ' t  ·  ' + n(swl_kn,1) + ' kN';
}

document.getElementById('printBtn').addEventListener('click',function(){window.print()});
window.addEventListener('beforeprint',function(){
  var f=document.getElementById('printFooter');
  if(f)f.textContent='Generated '+new Date().toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'2-digit'});
});

/* Wiring for the unit-toggle buttons that were onclick= attributes */
document.getElementById('btnImp').addEventListener('click',function(){setUnits('imp')});
document.getElementById('btnMet').addEventListener('click',function(){setUnits('met')});

/* Wiring for inputs that were oninput= attributes */
['inBHN','inW','inT'].forEach(function(id){
  document.getElementById(id).addEventListener('input',function(){calc();syncURL();});
});
