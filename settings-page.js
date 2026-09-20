var session=null;
function $(id){return document.getElementById(id)}

/* ── Footer (runs after DOM is ready) ── */
(function(){
  $('settYr').textContent=new Date().getFullYear();
  var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';
  $('sett-mail').addEventListener('click',function(){window.location.href='mailto:'+e});
})();

function openSidebar(){
  $('sidebar').classList.add('open');
  var o=$('sbOverlay');
  o.classList.add('visible');
  requestAnimationFrame(function(){o.classList.add('open')});
}
function closeSidebar(){
  $('sidebar').classList.remove('open');
  var o=$('sbOverlay');
  o.classList.remove('open');
  setTimeout(function(){o.classList.remove('visible')},260);
}

function showTab(name,idx){
  document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active')});
  document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active')});
  $('tab-'+name).classList.add('active');
  document.querySelectorAll('.tab-btn')[idx].classList.add('active');
}

function setTheme(t){
  document.documentElement.dataset.theme=t;
  try{localStorage.setItem('ap-theme',t)}catch(e){}
  document.querySelectorAll('.theme-opt').forEach(function(el){el.classList.remove('active')});
  var el=$('th-'+t);if(el)el.classList.add('active');
}

async function init(){
  var r=await api.auth.getSession();
  if(!r.user){window.location.href='/';return}
  session={email:r.user.email,is_admin:r.user.is_admin===true};
  var email=session.email||r.user.username||'';
  var ini=email.charAt(0).toUpperCase();
  $('sbEmail').textContent=email;
  $('sbAvatar').textContent=ini;
  $('tbAvatar').textContent=ini;
  $('fEmail').textContent=email;
  $('fUid').textContent='—';
  if(session.is_admin===true){$('fRole').textContent='Admin';$('sbRole').textContent='Admin'}
  $('fProvider').textContent='Email';
  var t=document.documentElement.dataset.theme||'dark';
  var el=$('th-'+t);if(el)el.classList.add('active');

  // An admin (or the bootstrap seed) set this password directly, so it must
  // be changed before it's used for anything else — jump straight to the
  // Security tab and explain why, rather than silently letting them wander
  // off to Dashboard first.
  if(r.user.must_change_password){
    showTab('security',1);
    var banner=document.createElement('div');
    banner.setAttribute('role','alert');
    banner.style.cssText='background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);border-radius:6px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:var(--text);line-height:1.5';
    banner.innerHTML='<strong style="color:var(--warn)">Password change required.</strong> This account has a password that was set for you — choose a new one below before continuing.';
    var content=$('main-content')||document.querySelector('.content');
    if(content)content.insertBefore(banner,content.firstChild);
  }
}

async function changePassword(){
  var cur=$('curPw').value,p=$('newPw').value,c=$('confirmPw').value;
  if(!cur){fb('err','Enter your current password.');return}
  if(!p){fb('err','Enter a new password.');return}
  if(p.length<8){fb('err','Minimum 8 characters required.');return}
  if(p!==c){fb('err','Passwords do not match.');return}
  $('pwBtn').disabled=true;$('pwBtn').textContent='Updating…';
  try{
    await api.auth.changePassword(cur,p);
  }catch(err){
    $('pwBtn').disabled=false;$('pwBtn').textContent='Update Password';
    fb('err',err.message);return;
  }
  $('pwBtn').disabled=false;$('pwBtn').textContent='Update Password';
  fb('ok','Password updated.');
  $('curPw').value='';$('newPw').value='';$('confirmPw').value='';
}
function fb(type,msg){var el=$('pwFb');el.textContent=msg;el.className='fb '+type;setTimeout(function(){el.className='fb'},4000)}
function signOut(){document.getElementById('signout-modal').classList.add('open')}
function closeSignoutModal(){document.getElementById('signout-modal').classList.remove('open')}
async function confirmSignOut(){closeSignoutModal();try{await api.auth.signOut();}catch(e){}window.location.href='/'}
async function signOutAll(){closeSignoutModal();try{await api.auth.signOut(true);}catch(e){}window.location.href='/'}

function togglePw(fieldId,iconId){
  var f=document.getElementById(fieldId);
  var show=f.type==='password';
  f.type=show?'text':'password';
  var ic=document.getElementById(iconId);
  ic.innerHTML=show
    ?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    :'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

/* Wiring for elements that were onclick= attributes */
$('sidebarSignoutBtn').addEventListener('click',signOut);
$('sbOverlay').addEventListener('click',closeSidebar);
$('hamburgerBtn').addEventListener('click',openSidebar);
$('tabGeneralBtn').addEventListener('click',function(){showTab('general',0)});
$('tabSecurityBtn').addEventListener('click',function(){showTab('security',1)});
$('th-light').addEventListener('click',function(){setTheme('light')});
$('th-dark').addEventListener('click',function(){setTheme('dark')});
$('signoutRowBtn').addEventListener('click',signOut);
document.querySelectorAll('.pw-eye-toggle').forEach(function(btn){
  btn.addEventListener('click',function(){togglePw(btn.dataset.field,btn.dataset.icon)});
});
$('pwBtn').addEventListener('click',changePassword);
$('signoutAllBtn').addEventListener('click',signOutAll);
$('signoutModalCancelBtn').addEventListener('click',closeSignoutModal);
$('signoutModalConfirmBtn').addEventListener('click',confirmSignOut);

init();
