if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(function(reg){
    reg.addEventListener('updatefound',function(){
      var sw=reg.installing;
      sw.addEventListener('statechange',function(){
        if(sw.state==='installed'&&navigator.serviceWorker.controller){
          var b=document.getElementById('sw-update-banner');if(b)b.style.display='flex';
        }
      });
    });
  }).catch(function(){});
  navigator.serviceWorker.addEventListener('controllerchange',function(){window.location.reload()});
}
var swRefreshBtn=document.getElementById('sw-refresh-btn');
if(swRefreshBtn){swRefreshBtn.addEventListener('click',function(){window.location.reload()})}
