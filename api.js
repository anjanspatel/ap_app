// AP Workspace — API client for the self-hosted Cloudflare Worker backend
// (replaces the Supabase JS SDK). Every call sends the session cookie
// automatically via credentials:'include'; there is no token to manage
// client-side.
(function () {
  var BASE = 'https://api.anjanpatel.ca';

  async function call(path, opts) {
    opts = opts || {};
    var res = await fetch(BASE + path, {
      method: opts.method || 'GET',
      credentials: 'include',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) {
      var err = new Error(data.error || 'Something went wrong. Try again.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.api = {
    auth: {
      signIn: function (identifier, password) {
        // identifier may be an email or a username (e.g. the bootstrap admin).
        return call('/api/auth/signin', { method: 'POST', body: { identifier: identifier, password: password } });
      },
      signOut: function (global) {
        return call('/api/auth/signout', { method: 'POST', body: { scope: global ? 'global' : undefined } });
      },
      getSession: function () {
        return call('/api/auth/session').catch(function (e) {
          if (e.status === 401) return { user: null };
          throw e;
        });
      },
      changePassword: function (current, next) {
        return call('/api/auth/change-password', { method: 'POST', body: { current: current, new: next } });
      },
    },
    lookups: {
      list: function () {
        return call('/api/lookups');
      },
      add: function (lookup) {
        return call('/api/lookups', { method: 'POST', body: lookup });
      },
      remove: function (id) {
        return call('/api/lookups/' + encodeURIComponent(id), { method: 'DELETE' });
      },
    },
    admin: {
      list: function () {
        return call('/api/admin/users');
      },
      create: function (u) {
        return call('/api/admin/users', { method: 'POST', body: u });
      },
      updateProfile: function (userId, u) {
        return call('/api/admin/users/' + encodeURIComponent(userId), { method: 'PATCH', body: u });
      },
      setAdmin: function (userId, isAdmin) {
        return call('/api/admin/users/' + encodeURIComponent(userId) + '/set-admin', { method: 'POST', body: { is_admin: isAdmin } });
      },
      ban: function (userId) {
        return call('/api/admin/users/' + encodeURIComponent(userId) + '/ban', { method: 'POST' });
      },
      unban: function (userId) {
        return call('/api/admin/users/' + encodeURIComponent(userId) + '/unban', { method: 'POST' });
      },
      resetPassword: function (userId, newPassword) {
        return call('/api/admin/users/' + encodeURIComponent(userId) + '/reset-password', { method: 'POST', body: { new_password: newPassword } });
      },
      revokeSessions: function (userId) {
        return call('/api/admin/users/' + encodeURIComponent(userId) + '/revoke-sessions', { method: 'POST' });
      },
      delete: function (userId) {
        return call('/api/admin/users/' + encodeURIComponent(userId), { method: 'DELETE' });
      },
    },
  };
})();
