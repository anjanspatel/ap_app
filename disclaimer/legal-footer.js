(function(){
  var yr=new Date().getFullYear();
  document.getElementById('legalYr').textContent=yr;
  document.getElementById('dyr').textContent=yr;
  var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';
  var fn=function(){window.location.href='mailto:'+e};
  document.getElementById('footer-mail').addEventListener('click',fn);
  document.getElementById('disc-mail').addEventListener('click',fn);
})();
