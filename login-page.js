(function(){
  var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';
  document.getElementById('contact-btn').addEventListener('click',function(){window.location.href='mailto:'+e});
  var ra=document.getElementById('btn-request-access');
  if(ra)ra.addEventListener('click',function(){window.location.href='mailto:'+e});
  var fc=document.getElementById('frg-contact-btn');
  if(fc)fc.addEventListener('click',function(){window.location.href='mailto:'+e});
  document.getElementById('yr').textContent=new Date().getFullYear();
})();

(function(){
  var btn=document.getElementById('themeBtnLogin');
  if(!btn)return;
  btn.addEventListener('click',function(){
    var curr=document.documentElement.dataset.theme||'dark';
    var next=curr==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    try{localStorage.setItem('ap-theme',next)}catch(e){}
  });
})();

var busy=false;
var ERE=/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
// A login identifier is either a full email, or a plain username (e.g. the
// bootstrap admin account) — letters, numbers, dot, underscore, hyphen.
var IDRE=/^[A-Za-z0-9._\-]{2,64}$/;
/* Deep-link return path (e.g. /torque/ redirected here to sign in first).
   Only ever a same-site path — reject protocol-relative ("//evil.com")
   or absolute URLs so this can't be turned into an open redirect. */
function safeNextPath(){
  var next=new URLSearchParams(window.location.search).get('next');
  if(next&&next.charAt(0)==='/'&&next.charAt(1)!=='/')return next;
  return null;
}
var COPY={idle:'Sign in',work:'Signing in…',done:'Signed in'};
function q(id){return document.getElementById(id)}
function showView(n){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});q('view-'+n).classList.add('active')}
function setNote(id,msg,cls){var el=q(id);el.textContent=msg;el.className='note'+(msg?' on':'');if(cls)el.classList.add(cls)}
function setErr(inp,err,msg){
  var i=q(inp),e=q(err);
  if(msg){e.textContent=msg;e.classList.add('on');i.setAttribute('aria-invalid','true');i.classList.remove('shake');void i.offsetWidth;i.classList.add('shake')}
  else{e.textContent='';e.classList.remove('on');i.removeAttribute('aria-invalid')}
}
function swapLbl(id,txt){var el=q(id);el.classList.add('fade');setTimeout(function(){el.textContent=txt;el.classList.remove('fade')},140)}
q('inp-email').addEventListener('input',function(){setErr('inp-email','err-email','');setNote('auth-note','')});
q('inp-pw').addEventListener('input',function(){setErr('inp-pw','err-pw','');setNote('auth-note','')});
q('auth-form').addEventListener('submit',async function(e){
  e.preventDefault();if(busy)return;
  var em=q('inp-email').value.trim(),pw=q('inp-pw').value,ok=true;
  if(!em){setErr('inp-email','err-email','Email or username required');ok=false}
  else if(!ERE.test(em)&&!IDRE.test(em)){setErr('inp-email','err-email','Enter a valid email or username');ok=false}
  if(!pw){setErr('inp-pw','err-pw','Password required');ok=false}
  else if(pw.length<8){setErr('inp-pw','err-pw','Min 8 characters');ok=false}
  if(!ok)return;
  busy=true;q('auth-submit').disabled=true;setNote('auth-note','');
  swapLbl('auth-lbl',COPY.work);
  var signInResult;
  try{
    signInResult=await api.auth.signIn(em,pw);
  }catch(err){
    swapLbl('auth-lbl',COPY.idle);setNote('auth-note',err.message);q('auth-submit').disabled=false;busy=false;return;
  }
  swapLbl('auth-lbl',COPY.done);
  try{
    if(q('chk-remember').checked)localStorage.setItem(REMEMBER_KEY,em);
    else localStorage.removeItem(REMEMBER_KEY);
  }catch(err){}
  // A password an admin just set (bootstrap or reset) must be changed
  // before anything else — skip the normal deep-link destination entirely.
  if(signInResult&&signInResult.user&&signInResult.user.must_change_password){
    setTimeout(function(){window.location.href='/settings.html?forcePasswordChange=1';},700);
    return;
  }
  var dest=safeNextPath();
  setTimeout(function(){window.location.href=dest||window.location.pathname;},700);
});
q('btn-forgot').addEventListener('click',function(){showView('forgot')});
q('btn-back-forgot').addEventListener('click',function(){showView('auth')});

/* ── Remember me: persists only the identifier locally, not a session
   length — the Worker issues a fixed 24h session either way. ── */
var REMEMBER_KEY='ap-remember-id';
(function(){
  var saved;
  try{saved=localStorage.getItem(REMEMBER_KEY)}catch(e){}
  if(saved){q('inp-email').value=saved;q('chk-remember').checked=true}
})();

async function doSignOut(){try{await api.auth.signOut();}catch(e){}window.location.reload();}

(async function boot(){
  // If the API is unreachable for any reason, fail safe to the sign-in
  // form rather than leaving the page blank — getSession() already
  // treats "not signed in" (401) as a normal result, so anything that
  // reaches this catch is a real connectivity problem.
  var r;
  try{
    r=await api.auth.getSession();
  }catch(err){
    showView('auth');
    setNote('auth-note','Could not reach the server. Refresh and try again.');
    return;
  }
  var session=r.user?{user:r.user}:null;
  if(session){
    var dest=safeNextPath();
    if(dest){window.location.replace(dest);return;}
    var nameEl=document.getElementById('launcher-name');
    if(nameEl&&session.user&&session.user.email){
      nameEl.textContent=', '+session.user.email.split('@')[0];
    }
    document.title='AP Workspace — Workspace';
    document.querySelector('.hero').style.display='none';
    document.querySelector('.card').style.display='none';
    document.getElementById('view-launcher').style.display='block';
    return;
  }
  showView('auth');
})();

/* ── Caps Lock warning on password fields ── */
(function(){
  function wireCapsLock(inputId,warnId){
    var inp=q(inputId),warn=q(warnId);
    if(!inp||!warn)return;
    function check(e){
      var on=typeof e.getModifierState==='function'&&e.getModifierState('CapsLock');
      warn.style.display=on?'flex':'none';
    }
    inp.addEventListener('keydown',check);
    inp.addEventListener('keyup',check);
    inp.addEventListener('blur',function(){warn.style.display='none'});
  }
  wireCapsLock('inp-pw','caps-pw');
})();

/* ── PW visibility toggle ── */
(function(){
  var btn=document.getElementById('pw-eye');
  var inp=document.getElementById('inp-pw');
  var ico=document.getElementById('pw-eye-icon');
  if(!btn||!inp)return;
  btn.addEventListener('click',function(){
    var show=inp.type==='password';
    inp.type=show?'text':'password';
    btn.setAttribute('aria-pressed',show?'true':'false');
    btn.setAttribute('aria-label',show?'Hide password':'Show password');
    ico.innerHTML=show
      ?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      :'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });
})();

/* Wiring for the launcher sign-out button that was an onclick= attribute */
var signOutBtn=document.getElementById('launcher-signout');
if(signOutBtn)signOutBtn.addEventListener('click',doSignOut);
