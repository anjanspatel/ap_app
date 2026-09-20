(function(){
  document.getElementById('legalYr').textContent=new Date().getFullYear();
  var e='support'+'@'+'app'+'.'+'anjanpatel'+'.'+'ca';
  var fn=function(){window.location.href='mailto:'+e};
  document.getElementById('footer-mail').addEventListener('click',fn);
  document.getElementById('terms-mail').addEventListener('click',fn);
})();
