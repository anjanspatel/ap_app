/* ── Save lookup (tubing) ── */
function openSaveModal(){
  var bhn=document.getElementById('inBHN'),w=document.getElementById('inW'),t=document.getElementById('inT');
  if(bhn||w||t){
    var parts=[];
    if(bhn&&bhn.value)parts.push('BHN '+bhn.value);
    if(w&&w.value)parts.push(w.value+'" W');
    if(t&&t.value)parts.push(t.value+'" T');
    if(parts.length)document.getElementById('saveModalDesc').textContent='Saving: '+parts.join(' / ');
  }
  document.getElementById('saveModal').classList.add('open');
  setTimeout(function(){document.getElementById('saveLabel').focus()},60);
}
function closeSaveModal(){document.getElementById('saveModal').classList.remove('open');}
document.getElementById('saveModal').addEventListener('click',function(e){if(e.target===this)closeSaveModal();});
async function confirmSave(){
  var btn=document.getElementById('saveConfirmBtn');
  btn.disabled=true;btn.textContent='Saving…';
  var bhn=document.getElementById('inBHN'),w=document.getElementById('inW'),t=document.getElementById('inT');
  var params={
    bhn:bhn?bhn.value:'',
    width:w?w.value:'',
    thickness:t?t.value:''
  };
  var label=document.getElementById('saveLabel').value.trim()||null;
  var summary=['BHN '+(params.bhn||'?'),params.width+'" W',params.thickness+'" T'].join(' / ');
  try{
    var session=await window.__sbReady;
    if(!session){window.location.replace('/?next='+encodeURIComponent(window.location.pathname));return;}
    await api.lookups.add({
      tool:'tubing',
      label:label,
      params:params,
      result_summary:summary
    });
    closeSaveModal();
    document.getElementById('saveLabel').value='';
    var toast=document.getElementById('saveToast');
    toast.classList.add('show');
    setTimeout(function(){toast.classList.remove('show')},2800);
  }catch(e){
    alert('Could not save: '+(e.message||'unknown error'));
  }finally{btn.disabled=false;btn.textContent='Save to Dashboard';}
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSaveModal();});

/* Wiring for buttons that were onclick= attributes */
document.getElementById('saveLookupBtn').addEventListener('click',openSaveModal);
document.getElementById('saveModalCancelBtn').addEventListener('click',closeSaveModal);
document.getElementById('saveConfirmBtn').addEventListener('click',confirmSave);
