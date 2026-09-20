/* ── Save lookup (flange) ── */
function openSaveModal(){
  var s=document.getElementById('size'),r=document.getElementById('rating');
  if(s&&r){
    document.getElementById('saveModalDesc').textContent=
      'Saving: '+(s.options[s.selectedIndex]||{}).text+' × '+(r.options[r.selectedIndex]||{}).text;
  }
  document.getElementById('saveModal').classList.add('open');
  setTimeout(function(){document.getElementById('saveLabel').focus()},60);
}
function closeSaveModal(){document.getElementById('saveModal').classList.remove('open');}
document.getElementById('saveModal').addEventListener('click',function(e){if(e.target===this)closeSaveModal();});
async function confirmSave(){
  var btn=document.getElementById('saveConfirmBtn');
  btn.disabled=true;btn.textContent='Saving…';
  var s=document.getElementById('size'),r=document.getElementById('rating');
  var params={
    size:(s.options[s.selectedIndex]||{}).text||s.value,
    rating:(r.options[r.selectedIndex]||{}).text||r.value
  };
  var label=document.getElementById('saveLabel').value.trim()||null;
  var job=document.getElementById('jobNote');
  if(job&&job.value.trim())label=label||(job.value.trim());
  var summary=params.size+' × '+params.rating;
  try{
    var session=await window.__sbReady;
    if(!session){window.location.replace('/?next='+encodeURIComponent(window.location.pathname));return;}
    await api.lookups.add({
      tool:'flange',
      label:label,
      params:params,
      result_summary:summary
    });
    closeSaveModal();
    document.getElementById('saveLabel').value='';
    var t=document.getElementById('saveToast');
    t.classList.add('show');
    setTimeout(function(){t.classList.remove('show')},2800);
  }catch(e){
    alert('Could not save: '+(e.message||'unknown error'));
  }finally{btn.disabled=false;btn.textContent='Save to Dashboard';}
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSaveModal();});

/* Wiring for buttons that were onclick= attributes */
document.getElementById('saveLookupBtn').addEventListener('click',openSaveModal);
document.getElementById('saveModalCancelBtn').addEventListener('click',closeSaveModal);
document.getElementById('saveConfirmBtn').addEventListener('click',confirmSave);
