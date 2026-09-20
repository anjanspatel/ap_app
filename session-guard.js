window.__sbReady=api.auth.getSession().then(function(r){
  if(!r.user){window.location.replace('/?next='+encodeURIComponent(window.location.pathname));return null;}
  return {user:r.user};
});
