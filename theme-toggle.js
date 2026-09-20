(function(){
  var btn=document.getElementById('themeBtn');
  if(!btn)return;
  btn.addEventListener('click',function(){
    var curr=document.documentElement.dataset.theme||'dark';
    var next=curr==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    try{localStorage.setItem('ap-theme',next)}catch(e){}
  });
})();
