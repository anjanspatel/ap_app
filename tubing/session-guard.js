window.__sbReady=api.auth.getSession().then(function(r){
  var session=r.user?{user:r.user}:null;
  if(!session){window.location.replace('/?next='+encodeURIComponent(window.location.pathname));return null;}
  return session;
});
