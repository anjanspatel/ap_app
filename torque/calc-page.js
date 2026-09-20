/* BOLTS, GRADES, LUBES, computeTorque() now come from calc.js —
   the same file the test suite imports, so the page and the tests
   can never quietly drift apart. */

/* ── helpers ── */
function $(id){return document.getElementById(id);}
function setResultText(el,text){
  if(el.textContent===text)return;
  el.textContent=text;
  el.classList.remove('ap-value-pulse');
  void el.offsetWidth;
  el.classList.add('ap-value-pulse');
}
function fmt(n,dec){return n.toLocaleString('en-CA',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function round(n,d){var f=Math.pow(10,d);return Math.round(n*f)/f;}

/* ── state ── */
var state = {
  size:'1.0', grade:'B7', bolts:8, lube:'moly', preload:60, metric:false
};
var calc = {};

/* ── URL params (re-open from dashboard) ── */
(function(){
  var sp=new URLSearchParams(window.location.search);
  if(sp.get('size')&&BOLTS[sp.get('size')]){state.size=sp.get('size');$('boltSize').value=state.size;}
  if(sp.get('grade')&&GRADES[sp.get('grade')]){state.grade=sp.get('grade');$('boltGrade').value=state.grade;}
  if(sp.get('bolts')&&parseInt(sp.get('bolts'))>0){state.bolts=parseInt(sp.get('bolts'));$('numBolts').value=state.bolts;}
  if(sp.get('lube')&&LUBES[sp.get('lube')]){state.lube=sp.get('lube');$('lubeCond').value=state.lube;}
  if(sp.get('preload')){var p=parseInt(sp.get('preload'));if(p>=30&&p<=90){state.preload=p;$('preloadSlider').value=p;$('preloadNum').value=p;}}
  if(sp.get('units')==='metric'){state.metric=true;$('unitMetric').classList.add('active');$('unitImperial').classList.remove('active');}
  if(sp.get('job'))$('jobNum').value=sp.get('job');
})();
$('jobNum').addEventListener('input',syncURL);

/* ── Shareable URL — silently synced, no reload ── */
function buildTorqueParams(){
  var p=new URLSearchParams();
  p.set('size',state.size);
  p.set('grade',state.grade);
  p.set('bolts',state.bolts);
  p.set('lube',state.lube);
  p.set('preload',state.preload);
  if(state.metric)p.set('units','metric');
  var job=($('jobNum').value||'').trim();
  if(job)p.set('job',job);
  return p;
}
function syncURL(){
  try{ history.replaceState(null,'',location.pathname+'?'+buildTorqueParams().toString()); }catch(e){}
}
(function(){
  var shareBtn=$('shareBtn');
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

/* ── compute ── */
function compute(){
  var b=BOLTS[state.size];
  var g=GRADES[state.grade];
  var lube=LUBES[state.lube];
  var d=parseFloat(state.size);
  var K=lube.k;
  var proofStr=g.proofFn(d);
  var area=b.area;

  /* pure formula lives in calc.js — shared with the test suite */
  var r=computeTorque({area:area,proofStr:proofStr,preloadPct:state.preload,K:K,d:d,numBolts:state.bolts});
  var proofLoad=r.proofLoad, clamp=r.clamp, torqueFtLb=r.torqueFtLb, torqueNm=r.torqueNm,
      totalFtLb=r.totalFtLb, totalNm=r.totalNm, clampKn=r.clampKn;

  calc={K:K,proofStr:proofStr,area:area,proofLoad:proofLoad,clamp:clamp,
    torqueFtLb:torqueFtLb,torqueNm:torqueNm,totalFtLb:totalFtLb,totalNm:totalNm,
    clampKn:clampKn,pct:state.preload};

  var metric=state.metric;
  var tVal=metric?torqueNm:torqueFtLb;
  var tUnit=metric?'N·m':'ft-lb';
  var totVal=metric?totalNm:totalFtLb;
  var clampDisp=metric?(clamp/1000*4.44822).toFixed(1)+' kN':fmt(Math.round(clamp),0)+' lb';

  setResultText($('torquePerBolt'),fmt(round(tVal,0),0));
  $('torqueUnit').textContent=tVal>=1000?tUnit+' ← verify wrench capacity':tUnit;
  $('torqueSubNote').textContent='('+fmt(round(metric?torqueFtLb:torqueNm,0),0)+' '+(metric?'ft-lb':'N·m')+')';
  $('torqueTotal').textContent=fmt(round(totVal,0),0);
  $('totalUnit').textContent=tUnit+' total';
  $('clampLoad').textContent=clampDisp;
  $('clampUnit').textContent='';
  $('proofNote').textContent='Proof: '+(metric?(proofLoad/1000*4.44822).toFixed(1)+' kN':fmt(Math.round(proofLoad),0)+' lb');
  $('stressDisp').textContent=state.preload+'%';
  $('stressBarFill').style.width=Math.min(state.preload,100)+'%';
  $('stressBarFill').style.background=state.preload>=80?'#f59e0b':state.preload>=65?'var(--accent)':'var(--emerald)';
  $('kDisplay').textContent=K.toFixed(2);
  $('stressAreaVal').textContent=metric?(area*645.16).toFixed(0):area.toFixed(4);
  $('stressAreaUnit').textContent=metric?'mm²':'in²';
  $('proofStrengthNote').textContent='Proof strength: '+(metric?Math.round(proofStr*6.89476)+' MPa':fmt(proofStr,0)+' psi');

  /* sequence table */
  var passes=[0.30,0.70,1.00];
  var seqIds=['seq1','seq2','seq3'];
  passes.forEach(function(p,i){
    var v=tVal*p;
    $(seqIds[i]).textContent=fmt(round(v,0),0)+' '+tUnit;
  });
}

/* ── event wiring ── */
$('boltSize').addEventListener('change',function(){state.size=this.value;compute();syncURL();});
$('boltGrade').addEventListener('change',function(){state.grade=this.value;compute();syncURL();});
$('numBolts').addEventListener('input',function(){
  var raw=parseInt(this.value);
  var clamped=Math.max(1,Math.min(200,isFinite(raw)?raw:1));
  var warnEl=$('numBoltsWarn');
  if(!isFinite(raw)||clamped!==raw){
    warnEl.textContent='Clamped to '+clamped+' (valid range 1–200)';
    warnEl.classList.add('show');
  }else{
    warnEl.classList.remove('show');
  }
  state.bolts=clamped;compute();syncURL();
});
$('lubeCond').addEventListener('change',function(){state.lube=this.value;compute();syncURL();});

$('preloadSlider').addEventListener('input',function(){
  state.preload=parseInt(this.value);$('preloadNum').value=state.preload;compute();syncURL();
});
$('preloadNum').addEventListener('input',function(){
  var v=parseInt(this.value)||60;v=Math.max(30,Math.min(90,v));
  state.preload=v;$('preloadSlider').value=v;$('preloadNum').value=v;compute();syncURL();
});

$('unitImperial').addEventListener('click',function(){
  state.metric=false;
  $('unitImperial').classList.add('active');$('unitMetric').classList.remove('active');
  compute();syncURL();
});
$('unitMetric').addEventListener('click',function(){
  state.metric=true;
  $('unitMetric').classList.add('active');$('unitImperial').classList.remove('active');
  compute();syncURL();
});

/* ── theme ──
   themeIcon must reflect the *current* theme, not just exist — it was
   a static sun glyph that never updated after a click or on load,
   unlike flange's and tubing's toggles (both correctly swap sun/moon).
   Reuses the exact moon path from index.html's icon-moon for the same
   glyph shape across the site. */
var SUN_PATHS='<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
var MOON_PATH='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
function syncThemeIcon(){
  var dark=(document.documentElement.dataset.theme||'dark')==='dark';
  $('themeIcon').innerHTML=dark?SUN_PATHS:MOON_PATH;
}
syncThemeIcon();
$('themeBtn').addEventListener('click',function(){
  var curr=document.documentElement.dataset.theme||'dark';
  var next=curr==='dark'?'light':'dark';
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem('ap-theme',next);}catch(e){}
  syncThemeIcon();
});

/* ── footer year + email ── */
$('legalYr').textContent=new Date().getFullYear();
$('footerMail').addEventListener('click',function(){
  var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';
  window.location.href='mailto:'+e;
});

/* ── connection status ── */
window.__sbReady.then(function(sess){
  if(!sess)return;
  $('connDot').style.background='#00d27a';
  $('connLabel').textContent='Connected';
}).catch(function(){
  $('connDot').style.background='#f59e0b';
  $('connLabel').textContent='Offline';
});

/* ── save lookup ── */
$('saveLookupBtn').addEventListener('click',function(){
  var b=BOLTS[state.size];
  var g=GRADES[state.grade];
  var lube=LUBES[state.lube];
  var metric=state.metric;
  var tVal=metric?calc.torqueNm:calc.torqueFtLb;
  var tUnit=metric?'N·m':'ft-lb';
  var summary=b.label+' '+g.label+' · '+state.bolts+' bolts · '+
    Math.round(tVal)+' '+tUnit+'/bolt · '+lube.label;
  $('saveSummaryLine').textContent=summary;
  $('saveLabel').value='';
  $('saveMsg').textContent='';
  $('saveMsg').className='modal-msg';
  $('saveModal').classList.add('open');
  setTimeout(function(){$('saveLabel').focus();},80);
});
function closeModal(){$('saveModal').classList.remove('open');}
$('saveModalClose').addEventListener('click',closeModal);
$('saveCancelBtn').addEventListener('click',closeModal);
$('saveModal').addEventListener('click',function(e){if(e.target===$('saveModal'))closeModal();});

$('saveConfirmBtn').addEventListener('click',function(){
  var jobNum=($('jobNum').value||'').trim();
  if(!jobNum){$('saveMsg').textContent='Enter a job number first.';$('saveMsg').className='modal-msg err';return;}
  $('saveConfirmBtn').disabled=true;
  $('saveMsg').textContent='Saving…';$('saveMsg').className='modal-msg';

  var b=BOLTS[state.size];
  var g=GRADES[state.grade];
  var lube=LUBES[state.lube];
  var metric=state.metric;
  var tVal=metric?calc.torqueNm:calc.torqueFtLb;
  var tUnit=metric?'N·m':'ft-lb';
  var summary=b.label+' '+g.label+' · '+state.bolts+' bolts · '+
    Math.round(tVal)+' '+tUnit+'/bolt · '+lube.label;

  window.__sbReady.then(function(sess){
    if(!sess){$('saveMsg').textContent='Not signed in.';$('saveMsg').className='modal-msg err';$('saveConfirmBtn').disabled=false;return;}
    return api.lookups.add({
      tool:'torque',
      label:($('saveLabel').value||'').trim()||null,
      params:{
        job:jobNum, size:state.size, grade:state.grade,
        bolts:String(state.bolts), lube:state.lube,
        preload:String(state.preload),
        units:state.metric?'metric':'imperial'
      },
      result_summary:summary
    });
  }).then(function(res){
    $('saveMsg').textContent='Saved!';$('saveMsg').className='modal-msg ok';
    $('saveConfirmBtn').disabled=false;
    setTimeout(closeModal,1200);
  }).catch(function(err){
    $('saveMsg').textContent='Error: '+(err&&err.message?err.message:'save failed');
    $('saveMsg').className='modal-msg err';
    $('saveConfirmBtn').disabled=false;
  });
});

/* ── Print ── */
$('savePdfBtn').addEventListener('click',function(){
  window.print();
});
window.addEventListener('beforeprint',function(){
  var job=($('jobNum').value||'').trim();
  var dateStamp=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'2-digit'});
  $('printFooter').textContent='Generated '+dateStamp+(job?' · Job '+job:'');
});

/* ── initial compute ── */
compute();
