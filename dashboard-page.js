
(function(){
  document.getElementById('legalYr').textContent=new Date().getFullYear();
  var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';
  document.getElementById('footer-mail').addEventListener('click',function(){window.location.href='mailto:'+e});
})();

var session=null;
var allRows=[];

function $(id){return document.getElementById(id)}

/* ── Theme toggle ── */
(function(){
  var btn=$('themeToggle');
  if(!btn)return;
  btn.addEventListener('click',function(){
    var curr=document.documentElement.dataset.theme||'dark';
    var next=curr==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    try{localStorage.setItem('ap-theme',next)}catch(e){}
    drawChart();
  });
})();

/* ── Clock ── */
function tickClock(){
  var d=new Date();
  $('tbClock').textContent=d.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' MT';
}
tickClock();setInterval(tickClock,1000);

/* ── Sidebar ── */
function openSidebar(){
  $('sidebar').classList.add('open');
  var ov=$('sbOverlay');
  ov.classList.add('visible');
  requestAnimationFrame(function(){ov.classList.add('open')});
}
function closeSidebar(){
  $('sidebar').classList.remove('open');
  var ov=$('sbOverlay');
  ov.classList.remove('open');
  setTimeout(function(){ov.classList.remove('visible')},260);
}

/* ── Section nav ── */
/* Slides the highlight bar (#navIndicator) behind the active sidebar
   item. Positions are read off the real DOM each time rather than
   hardcoded, since nav-users is conditionally hidden for non-admins and
   shifts every item below it. */
function moveNavIndicator(el){
  var ind=$('navIndicator');
  if(!ind||!el)return;
  ind.style.height=el.offsetHeight+'px';
  ind.style.transform='translateY('+el.offsetTop+'px)';
  ind.style.opacity='1';
}
var SECTION_TITLES={dashboard:'Dashboard',tools:'Calculators',logs:'Calc Logs',users:'Admin Console'};
function showSection(name, opts){
  if(!$('sec-'+name))name='dashboard';
  document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active')});
  document.querySelectorAll('.nav-item[id^="nav-"]').forEach(function(el){el.classList.remove('active')});
  $('sec-'+name).classList.add('active');
  var navEl=$('nav-'+name);if(navEl){navEl.classList.add('active');moveNavIndicator(navEl)}
  $('tbTitle').textContent=SECTION_TITLES[name]||name;
  document.title='AP Workspace — '+(SECTION_TITLES[name]||name);
  var url=name==='dashboard' ? '/dashboard.html' : '/dashboard.html#'+name;
  if(!(opts&&opts.skipHistory)){
    if(location.pathname+location.hash!==url) history.pushState({section:name},'',url);
  }
  if(name==='logs')loadLogs();
  if(name==='users')loadUsers();
  closeSidebar();
}
window.addEventListener('popstate',function(){
  var name=(location.hash||'#dashboard').slice(1)||'dashboard';
  showSection(name,{skipHistory:true});
});

/* ── Toast ── */
function toast(msg){
  var t=$('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show')},2200);
}

/* ── Relative time ── */
function relTime(iso){
  var d=Date.now()-new Date(iso).getTime();
  var m=Math.floor(d/60000);
  if(m<1)return'just now';if(m<60)return m+'m ago';
  var h=Math.floor(m/60);if(h<24)return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

/* ── Escape ── */
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

/* ── Format params ── */
function fmtP(tool,p){
  if(!p)return'—';
  if(tool==='flange'){return[(p.size?'Size: '+p.size:''),(p.rating?p.rating:''),(p.bore?'Bore: '+p.bore:'')].filter(Boolean).join(' · ')||esc(JSON.stringify(p))}
  if(tool==='tubing'){return[(p.bhn?'BHN: '+p.bhn:''),(p.width?'W: '+p.width+'"':''),(p.thickness?'T: '+p.thickness+'"':'')].filter(Boolean).join(' · ')||esc(JSON.stringify(p))}
  if(tool==='torque'){return[(p.size?p.size+'"':''), (p.grade||''),(p.bolts?p.bolts+' bolts':''),(p.lube||''),(p.preload?p.preload+'% preload':'')].filter(Boolean).join(' · ')||esc(JSON.stringify(p))}
  return esc(JSON.stringify(p));
}

/* ── Auth guard ── */
async function init(){
  var r=await api.auth.getSession();
  if(!r.user){window.location.href='/';return}
  session={userId:r.user.id,email:r.user.email,is_admin:r.user.is_admin===true};
  var email=session.email||'';
  var init=email.charAt(0).toUpperCase();
  $('sbEmail').textContent=email;
  $('sbAvatar').textContent=init;
  $('tbAvatar').textContent=init;
  if(session.is_admin===true){
    $('sbRole').textContent='Admin';
    $('adminPanel').style.display='';
    $('nav-admin-section').style.display='';
    $('nav-users').style.display='';
    loadAdmin();
  }
  var hr=new Date().getHours();
  var greet;
  if(hr<12)greet='Good morning';else if(hr<18)greet='Good afternoon';else greet='Good evening';
  $('greetSub').textContent=greet+' · Alberta, CA';
  loadDashboard();
  var initialSection=(location.hash||'').slice(1);
  if(initialSection && initialSection!=='dashboard'){
    showSection(initialSection,{skipHistory:true});
  } else {
    document.title='AP Workspace — '+SECTION_TITLES.dashboard;
  }
}

function signOut(){document.getElementById('signout-modal').classList.add('open')}
function closeSignoutModal(){document.getElementById('signout-modal').classList.remove('open')}
async function confirmSignOut(){
  closeSignoutModal();
  try{await api.auth.signOut();}catch(e){}
  window.location.href='/';
}

/* ── Dashboard ── */
async function loadDashboard(){
  var rows;
  try{
    rows=(await api.lookups.list()).lookups;
  }catch(err){
    console.error('saved_lookups fetch error:',err);
    var wrap=$('recentWrap');
    if(wrap)wrap.innerHTML='<div class="empty"><span class="empty-label" style="color:var(--error)">DB error: '+esc(err.message)+'</span></div>';
    return;
  }
  allRows=rows;
  $('mSaved').textContent=rows.length;
  if(rows.length>0){
    $('mSavedDot').className='status-dot dot-ok';
    $('mSavedLbl').textContent='Last: '+relTime(rows[0].created_at);
    var d=new Date(rows[0].created_at);
    $('mLast').textContent=d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
    $('mLastDot').className='status-dot dot-ok';
    $('mLastLbl').textContent=relTime(rows[0].created_at);
    /* breakdown bar */
    var nF=rows.filter(function(r){return r.tool==='flange'}).length;
    var nT=rows.filter(function(r){return r.tool==='tubing'}).length;
    var nTq=rows.filter(function(r){return r.tool==='torque'}).length;
    var pct=rows.length>0?Math.round((nF/rows.length)*100):0;
    $('actLblA').textContent='Flange '+nF;
    $('actLblB').textContent='Torque '+nTq+(nT?' / Block '+nT:'');
    $('actBreak').style.display='flex';
    setTimeout(function(){$('actFill').style.width=pct+'%'},80);
  } else {
    $('mSavedDot').className='status-dot dot-idle';
    $('mSavedLbl').textContent='No lookups yet';
    $('mLast').textContent='—';
    $('mLastLbl').textContent='No activity';
  }
  renderRecent(rows.slice(0,5));
}

function renderRecent(rows){
  var wrap=$('recentWrap');
  if(!rows.length){wrap.innerHTML='<div class="empty"><span class="empty-label">No saved lookups yet — launch a calculator and hit Save.</span></div>';return}
  var total=allRows.length;
  var html='<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Tool</th><th>Parameters</th><th>When</th></tr></thead><tbody>';
  rows.forEach(function(l){
    var idx=allRows.findIndex(function(r){return r.id===l.id});
    var jobNum=idx<0?'?':(total-idx);
    var tool=l.tool==='flange'?'Flange':l.tool==='torque'?'Torque':'Tubing';
    html+='<tr style="cursor:pointer" data-id="'+l.id+'"><td class="td-mono" style="color:var(--accent-fg)">#'+jobNum+'</td><td class="td-mono">'+esc(tool)+'</td><td class="td-dim">'+esc(fmtP(l.tool,l.params))+'</td><td class="td-mono">'+relTime(l.created_at)+'</td></tr>';
  });
  html+='</tbody></table></div>';
  wrap.innerHTML=html;
  wrap.querySelector('tbody').addEventListener('click',function(e){
    var tr=e.target.closest('tr[data-id]');
    if(tr)openDetail(tr.dataset.id);
  });
}

/* ── Logs ── */
async function loadLogs(){
  showSkeleton('logsWrap',5);
  var rows;
  try{
    rows=(await api.lookups.list()).lookups;
  }catch(err){
    console.error('saved_lookups logs error:',err);
    $('logsWrap').innerHTML='<div class="empty"><span class="empty-label" style="color:var(--error)">DB error: '+esc(err.message)+'</span></div>';
    return;
  }
  allRows=rows;
  var total=rows.length;
  $('logCount').textContent=total+' records';
  var wrap=$('logsWrap');
  if(!total){wrap.innerHTML='<div class="empty"><span class="empty-label">No saved lookups yet.</span></div>';return}
  var html='<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Tool</th><th>Parameters</th><th>Label</th><th>Date</th><th></th></tr></thead><tbody>';
  rows.forEach(function(l,i){
    var jobNum=total-i;
    var tool=l.tool==='flange'?'Flange':l.tool==='torque'?'Torque':'Tubing';
    var date=new Date(l.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    var label=l.label?esc(l.label):'<span style="color:var(--dim)">—</span>';
    var searchText=(tool+' '+(l.label||'')+' '+fmtP(l.tool,l.params)).toLowerCase();
    html+='<tr style="cursor:pointer" data-id="'+l.id+'" data-lookup-row="1" data-lookup-text="'+esc(searchText)+'"><td class="td-mono" style="color:var(--accent-fg)">#'+jobNum+'</td><td class="td-mono">'+esc(tool)+'</td><td class="td-dim">'+esc(fmtP(l.tool,l.params))+'</td><td class="td-label">'+label+'</td><td class="td-mono">'+date+'</td><td><button class="btn-del" data-del-id="'+l.id+'" title="Delete">✕</button></td></tr>';
  });
  html+='</tbody></table><div id="search-no-results" class="no-results" style="display:none">No lookups match your search.</div></div>';
  wrap.innerHTML=html;
  wrap.querySelector('tbody').addEventListener('click',function(e){
    var delBtn=e.target.closest('.btn-del');
    if(delBtn){delLookup(delBtn.dataset.delId);return}
    var tr=e.target.closest('tr[data-id]');
    if(tr)openDetail(tr.dataset.id);
  });
  var searchBox=$('tbSearch');
  if(searchBox&&searchBox.value)filterLookups(searchBox.value);
}

/* ── CSV export ── */
function exportLogsCsv(){
  if(!allRows.length){toast('No saved lookups to export.');return}
  var cols=['#','Tool','Parameters','Label','Date'];
  var lines=[cols.join(',')];
  var total=allRows.length;
  allRows.forEach(function(l,i){
    var jobNum=total-i;
    var tool=l.tool==='flange'?'Flange':l.tool==='torque'?'Torque':'Tubing';
    var date=new Date(l.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    var params=fmtP(l.tool,l.params).replace(/<[^>]*>/g,'');
    var row=[jobNum,tool,params,l.label||'',date].map(function(v){
      v=String(v).replace(/"/g,'""');
      return/[",\n]/.test(v)?'"'+v+'"':v;
    });
    lines.push(row.join(','));
  });
  var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='ap-workspace-lookups-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},1000);
}
$('exportCsvBtn').addEventListener('click',exportLogsCsv);

/* ── Search keyboard shortcut (Ctrl/Cmd+K) ── */
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
    e.preventDefault();
    if(!$('sec-logs').classList.contains('active')){
      showSection('logs');
      toast('Jumped to Calc Logs to search your saved lookups.');
    }
    var box=$('tbSearch');
    if(box){box.focus();box.select();}
  }
});

async function delLookup(id){
  try{
    await api.lookups.remove(id);
  }catch(err){toast('Error deleting.');return}
  toast('Lookup deleted.');
  loadDashboard();
  if($('sec-logs').classList.contains('active'))loadLogs();
}

/* ── Admin ── */
async function loadAdmin(){
  var rows=[];
  try{
    rows=(await api.lookups.list()).lookups.slice(0,200);
  }catch(err){}
  $('adminCount').textContent=rows.length+' total';
  renderAdminStats(rows);
  var tbody=$('adminRows');
  if(!rows.length){tbody.innerHTML='<tr><td colspan="5" class="empty"><span class="empty-label">No data.</span></td></tr>';return}
  tbody.innerHTML=rows.map(function(l){
    var uid=l.user_id?l.user_id.substring(0,8)+'…':'';
    var tool=l.tool==='flange'?'Flange':l.tool==='torque'?'Torque':'Tubing';
    var date=new Date(l.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    var label=l.label?esc(l.label):'<span style="color:var(--dim)">—</span>';
    return'<tr><td class="td-mono" title="'+esc(l.user_id||'')+'">'+esc(uid)+'</td><td class="td-mono">'+esc(tool)+'</td><td class="td-dim">'+esc(fmtP(l.tool,l.params))+'</td><td class="td-label">'+label+'</td><td class="td-mono">'+date+'</td></tr>';
  }).join('');
}

function renderAdminStats(rows){
  var uniqueUsers={};
  var toolCounts={flange:0,torque:0,tubing:0};
  var weekMs=7*24*60*60*1000;
  var now=Date.now();
  var weekCount=0;
  rows.forEach(function(l){
    if(l.user_id)uniqueUsers[l.user_id]=true;
    if(toolCounts[l.tool]!==undefined)toolCounts[l.tool]++;
    if(l.created_at&&(now-new Date(l.created_at).getTime())<=weekMs)weekCount++;
  });
  $('aStatUsers').textContent=Object.keys(uniqueUsers).length;
  $('aStatWeek').textContent=weekCount;
  $('aStatTotal').textContent=rows.length;
  var topTool='—',topCount=0;
  Object.keys(toolCounts).forEach(function(t){
    if(toolCounts[t]>topCount){topCount=toolCounts[t];topTool=t;}
  });
  var toolLabels={flange:'Flange',torque:'Torque',tubing:'Tubing'};
  if(rows.length&&topCount>0){
    $('aStatTool').textContent=toolLabels[topTool]||topTool;
    var pct=Math.round((topCount/rows.length)*100);
    $('aStatToolPct').textContent=pct+'% of lookups';
  }else{
    $('aStatTool').textContent='—';
    $('aStatToolPct').textContent='No data';
  }
}

/* ── User Management ── */
var allUsers=[];

async function loadUsers(){
  var tbody=$('usersRows');
  tbody.innerHTML='<tr><td colspan="8" class="empty"><span class="empty-label">Loading…</span></td></tr>';
  var r;
  try{
    r=await api.admin.list();
  }catch(err){
    tbody.innerHTML='<tr><td colspan="8" class="empty"><span class="empty-label">'+esc(err.message||'Could not load users.')+'</span></td></tr>';
    return;
  }
  allUsers=r.users||[];
  renderUsers();
}

function renderUsers(){
  var q=($('usersSearch').value||'').toLowerCase().trim();
  var rows=q?allUsers.filter(function(u){return (u.email||'').toLowerCase().indexOf(q)!==-1}):allUsers;
  $('usersCount').textContent=rows.length+' of '+allUsers.length;
  var tbody=$('usersRows');
  if(!rows.length){tbody.innerHTML='<tr><td colspan="8" class="empty"><span class="empty-label">No matching users.</span></td></tr>';return}
  tbody.innerHTML=rows.map(function(u){
    var joined=u.created_at?new Date(u.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'—';
    var lastSeen=u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'Never';
    var isBanned=!!u.banned_until;
    var roleBadge=u.is_admin?'<span class="badge-role">Admin</span>':'<span class="badge-role plain">User</span>';
    var statusBadge=isBanned?'<span class="badge-status banned">Blocked</span>':'<span class="badge-status">Active</span>';
    var editBtn='<button class="row-action" data-act="edit" data-id="'+esc(u.id)+'">Edit</button>';
    var resetBtn='<button class="row-action" data-act="reset" data-id="'+esc(u.id)+'" data-email="'+esc(u.email)+'">Reset password</button>';
    var adminBtn='<button class="row-action" data-act="admin" data-id="'+esc(u.id)+'" data-make="'+(!u.is_admin)+'" data-email="'+esc(u.email)+'">'+(u.is_admin?'Revoke admin':'Make admin')+'</button>';
    var banBtn='<button class="row-action'+(isBanned?'':' danger')+'" data-act="ban" data-id="'+esc(u.id)+'" data-make="'+(!isBanned)+'" data-email="'+esc(u.email)+'">'+(isBanned?'Unblock':'Block')+'</button>';
    var deleteBtn='<button class="row-action danger" data-act="delete" data-id="'+esc(u.id)+'" data-email="'+esc(u.email)+'">Delete</button>';
    var name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'—';
    var acctNum=u.account_number?esc(u.account_number):'—';
    var emailCell=esc(u.email||'—')+(u.username?'<br><span class="td-dim td-mono" style="font-size:10px">@'+esc(u.username)+' (username login)</span>':'');
    return '<tr><td class="td-mono">'+acctNum+'</td><td>'+esc(name)+'</td><td>'+emailCell+'</td><td class="td-mono">'+joined+'</td><td class="td-mono">'+lastSeen+'</td><td>'+roleBadge+'</td><td>'+statusBadge+'</td>'
      +'<td style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">'+editBtn+resetBtn+adminBtn+banBtn+deleteBtn+'</td></tr>';
  }).join('');
}

function openAddUserModal(){
  $('auFirst').value='';$('auLast').value='';$('auEmail').value='';$('auPassword').value='';
  $('auPassword').type='password';$('auPwdToggle').textContent='Show';
  $('auRoleGeneral').checked=true;$('auRoleAdmin').checked=false;
  populateVerifiedByOptions();
  $('auDateAdded').textContent='Added: '+new Date().toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
  $('adduserFb').style.display='none';
  $('adduserOverlay').classList.add('open');
  $('auFirst').focus();
}
function closeAddUserModal(){$('adduserOverlay').classList.remove('open')}
function adduserFb(msg){var el=$('adduserFb');el.textContent=msg;el.style.display=msg?'block':'none'}

function toggleAuPwd(){
  var inp=$('auPassword'),btn=$('auPwdToggle');
  var show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.textContent=show?'Hide':'Show';
}

function populateVerifiedByOptions(){
  var sel=$('auVerifiedBy');
  var admins=allUsers.filter(function(u){return u.is_admin});
  sel.innerHTML='<option value="">— none —</option>'+admins.map(function(u){
    var name=[u.first_name,u.last_name].filter(Boolean).join(' ')||u.email;
    return '<option value="'+esc(u.id)+'">'+esc(name)+'</option>';
  }).join('');
}

async function submitAddUser(){
  var first=$('auFirst').value.trim(),last=$('auLast').value.trim();
  var email=$('auEmail').value.trim();
  var password=$('auPassword').value;
  var isAdmin=$('auRoleAdmin').checked;
  var verifiedBy=$('auVerifiedBy').value||null;
  if(!email){adduserFb('Enter an email address.');return}
  if(password.length<8){adduserFb('Password must be at least 8 characters.');return}
  $('auSubmit').disabled=true;$('auSubmit').textContent='Creating…';
  var r;
  try{
    r=await api.admin.create({first_name:first||null,last_name:last||null,email:email,password:password,is_admin:isAdmin,verified_by_id:verifiedBy});
  }catch(err){
    $('auSubmit').disabled=false;$('auSubmit').textContent='Create User';
    adduserFb(err.message||'Could not create user.');return;
  }
  $('auSubmit').disabled=false;$('auSubmit').textContent='Create User';
  closeAddUserModal();
  toast('User created — '+(r.account_number||'')+'.');
  loadUsers();
}

async function toggleAdmin(userId,makeAdmin,email){
  var verb=makeAdmin?'grant admin access to':'revoke admin access from';
  if(!confirm('Are you sure you want to '+verb+' '+email+'?'))return;
  try{
    await api.admin.setAdmin(userId,makeAdmin);
  }catch(err){toast('Error: '+(err.message||'could not update role.'));return}
  toast(makeAdmin?'Admin access granted.':'Admin access revoked.');
  loadUsers();
}

async function toggleBan(userId,ban,email){
  var verb=ban?'block':'unblock';
  if(!confirm('Are you sure you want to '+verb+' '+email+'?'+(ban?' They will be signed out and unable to sign in again until unblocked.':'')))return;
  try{
    await (ban?api.admin.ban(userId):api.admin.unban(userId));
  }catch(err){toast('Error: '+(err.message||'could not update status.'));return}
  toast(ban?'User blocked.':'User unblocked.');
  loadUsers();
}

async function deleteUser(userId,email){
  if(!confirm('Permanently delete '+email+'? This removes their account and all saved lookups. This cannot be undone.'))return;
  try{
    await api.admin.delete(userId);
  }catch(err){toast('Error: '+(err.message||'could not delete user.'));return}
  toast('User deleted.');
  loadUsers();
}

async function resetUserPassword(userId,email){
  // The only "forgot password" path this app has — there's no email
  // provider wired up to send a self-service reset link, so an admin
  // sets a new password directly and hands it to the person.
  var pw=prompt('Enter a new password for '+email+' (at least 8 characters). They will be signed out everywhere and must use this password next time.');
  if(pw===null)return;
  if(pw.length<8){toast('Password must be at least 8 characters.');return}
  try{
    await api.admin.resetPassword(userId,pw);
  }catch(err){toast('Error: '+(err.message||'could not reset password.'));return}
  toast('Password reset for '+email+'.');
}

$('usersRows').addEventListener('click',function(e){
  var btn=e.target.closest('button[data-act]');
  if(!btn)return;
  var id=btn.dataset.id,make=btn.dataset.make==='true',email=btn.dataset.email;
  if(btn.dataset.act==='admin')toggleAdmin(id,make,email);
  else if(btn.dataset.act==='ban')toggleBan(id,make,email);
  else if(btn.dataset.act==='reset')resetUserPassword(id,email);
  else if(btn.dataset.act==='edit')openEditUserModal(id);
  else if(btn.dataset.act==='delete')deleteUser(id,email);
});

function openEditUserModal(userId){
  var u=allUsers.find(function(x){return x.id===userId});
  if(!u)return;
  $('euId').value=u.id;
  $('euFirst').value=u.first_name||'';
  $('euLast').value=u.last_name||'';
  $('euEmail').value=u.email||'';
  var added=u.created_at?new Date(u.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'—';
  $('euMeta').textContent=(u.account_number||'—')+' · Added: '+added+' · Verified by: '+(u.verified_by_name||'—');
  $('edituserFb').style.display='none';
  $('edituserOverlay').classList.add('open');
  $('euFirst').focus();
}
function closeEditUserModal(){$('edituserOverlay').classList.remove('open')}
function edituserFb(msg){var el=$('edituserFb');el.textContent=msg;el.style.display=msg?'block':'none'}

async function submitEditUser(){
  var userId=$('euId').value;
  var first=$('euFirst').value.trim(),last=$('euLast').value.trim();
  var email=$('euEmail').value.trim();
  if(!email){edituserFb('Enter an email address.');return}
  $('euSubmit').disabled=true;$('euSubmit').textContent='Saving…';
  try{
    await api.admin.updateProfile(userId,{first_name:first||null,last_name:last||null,email:email});
  }catch(err){
    $('euSubmit').disabled=false;$('euSubmit').textContent='Save Changes';
    edituserFb(err.message||'Could not save changes.');return;
  }
  $('euSubmit').disabled=false;$('euSubmit').textContent='Save Changes';
  closeEditUserModal();
  toast('User updated.');
  loadUsers();
}

/* ── Detail panel ── */
function openDetail(id){
  var l=allRows.find(function(r){return r.id===id});
  if(!l)return;
  var total=allRows.length;
  var idx=allRows.findIndex(function(r){return r.id===id});
  var jobNum=total-idx;
  var toolName=l.tool==='flange'?'Flange Slide Rule':l.tool==='torque'?'Bolt Torque Calculator':'Safety Block Calculator';
  var toolBase=l.tool==='flange'?'/flange/':l.tool==='torque'?'/torque/':'/tubing/';
  var toolPath=toolBase;
  if(l.params){
    var qp=new URLSearchParams();
    if(l.tool==='flange'){
      if(l.params.size)qp.set('size',l.params.size);
      if(l.params.rating)qp.set('rating',l.params.rating);
      if(l.params.units)qp.set('units',l.params.units);
    } else if(l.tool==='tubing'){
      if(l.params.bhn!=null)qp.set('bhn',l.params.bhn);
      if(l.params.width!=null)qp.set('width',l.params.width);
      if(l.params.thickness!=null)qp.set('thickness',l.params.thickness);
    } else if(l.tool==='torque'){
      if(l.params.size)qp.set('size',l.params.size);
      if(l.params.grade)qp.set('grade',l.params.grade);
      if(l.params.bolts)qp.set('bolts',l.params.bolts);
      if(l.params.lube)qp.set('lube',l.params.lube);
      if(l.params.preload)qp.set('preload',l.params.preload);
      if(l.params.units)qp.set('units',l.params.units);
    }
    var qs=qp.toString();
    if(qs)toolPath=toolBase+'?'+qs;
  }
  var date=new Date(l.created_at).toLocaleString('en-CA',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  var rows=[
    ['Job','#'+jobNum],
    ['Tool',toolName],
    ['Saved',date],
    ['Label',l.label||null],
    ['Params',fmtP(l.tool,l.params)],
    ['Summary',l.result_summary||null]
  ];
  var html='';
  rows.forEach(function(r){
    if(r[1]===null)return;
    html+='<div class="det-row"><span class="det-k">'+r[0]+'</span><span class="det-v">'+esc(r[1])+'</span></div>';
  });
  if(l.params){
    html+='<div class="det-row"><span class="det-k">Raw</span><span class="det-v muted" style="font-size:10px;word-break:break-all">'+esc(JSON.stringify(l.params))+'</span></div>';
  }
  $('detTitle').textContent='Job #'+jobNum+' · '+esc(l.tool==='flange'?'Flange':l.tool==='torque'?'Torque':'Tubing');
  $('detBody').innerHTML=html;
  $('detLink').href=toolPath;
  $('detLink').textContent='Open in '+toolName+' →';
  var dlBtn=$('detDl');
  dlBtn.onclick=function(){
    var data={job:jobNum,tool:l.tool,label:l.label||null,saved:l.created_at,params:l.params||null,summary:l.result_summary||null};
    var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='job-'+jobNum+'-'+l.tool+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
  };
  $('detBg').style.display='flex';
  document.body.style.overflow='hidden';
}
function closeDetail(){
  $('detBg').style.display='none';
  document.body.style.overflow='';
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDetail()});

init();
/* ── Metric tile cursor glow ── */
(function(){
  document.querySelectorAll('.metric').forEach(function(tile){
    tile.addEventListener('mousemove',function(e){
      var r=tile.getBoundingClientRect();
      tile.style.setProperty('--mx',(e.clientX-r.left)+'px');
      tile.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  });
})();
/* ── Site search: filter saved-lookup rows ──
   The search box lives in the topbar, visible from every section, but it
   only ever filters the Calc Logs table — which isn't rendered into the DOM
   until that section has actually been visited. Without this, clicking the
   box from Dashboard or Admin Console and typing does nothing visible: the
   query runs, finds zero [data-lookup-row] elements because the table was
   never mounted, and the user sees no feedback at all. Jumping to Calc Logs
   on focus (not on every keystroke — that would refetch on every letter)
   guarantees the table exists before the user starts typing. */
function jumpToSearchableSection() {
  if (!$('sec-logs').classList.contains('active')) {
    showSection('logs');
    toast('Jumped to Calc Logs to search your saved lookups.');
  }
}
function filterLookups(q) {
  q = (q || '').toLowerCase().trim();
  var rows = document.querySelectorAll('[data-lookup-row]');
  var visible = 0;
  rows.forEach(function(row) {
    var text = (row.dataset.lookupText || '').toLowerCase();
    var show = !q || text.indexOf(q) !== -1;
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  var noRes = document.getElementById('search-no-results');
  if (noRes) noRes.style.display = (q && visible === 0) ? '' : 'none';
}
/* ── Skeleton loader helper ── */
function showSkeleton(wrapId, rows) {
  rows = rows || 4;
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  var html = '';
  for (var i = 0; i < rows; i++) {
    html += '<div class="sk-row"><div class="sk-block sk-icon"></div><div class="sk-lines"><div class="sk-block sk-line-a"></div><div class="sk-block sk-line-b"></div></div><div class="sk-block sk-chip"></div></div>';
  }
  wrap.innerHTML = html;
}

/* Wiring for elements that were onclick=/onfocus=/oninput= attributes */
document.getElementById('nav-dashboard').addEventListener('click',function(){showSection('dashboard')});
document.getElementById('nav-tools').addEventListener('click',function(){showSection('tools')});
document.getElementById('nav-logs').addEventListener('click',function(){showSection('logs')});
document.getElementById('nav-users').addEventListener('click',function(){showSection('users')});
document.getElementById('sidebarSignoutBtn').addEventListener('click',signOut);
document.getElementById('sbOverlay').addEventListener('click',closeSidebar);
document.getElementById('hamburgerBtn').addEventListener('click',openSidebar);
document.getElementById('viewAllLogsBtn').addEventListener('click',function(){showSection('logs')});
document.getElementById('usersSearch').addEventListener('input',renderUsers);
document.getElementById('addUserBtn').addEventListener('click',openAddUserModal);
document.getElementById('detBg').addEventListener('click',function(event){if(event.target===this)closeDetail()});
document.getElementById('detCloseBtn').addEventListener('click',closeDetail);
document.getElementById('auPwdToggle').addEventListener('click',toggleAuPwd);
document.getElementById('auCancelBtn').addEventListener('click',closeAddUserModal);
document.getElementById('auSubmit').addEventListener('click',submitAddUser);
document.getElementById('euCancelBtn').addEventListener('click',closeEditUserModal);
document.getElementById('euSubmit').addEventListener('click',submitEditUser);
document.getElementById('tbSearch').addEventListener('focus',jumpToSearchableSection);
document.getElementById('tbSearch').addEventListener('input',function(){filterLookups(this.value)});
document.getElementById('signoutModalCancelBtn').addEventListener('click',closeSignoutModal);
document.getElementById('signoutModalConfirmBtn').addEventListener('click',confirmSignOut);
