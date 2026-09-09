/* AP Workspace — shared API client (replaces the Supabase JS SDK)
   Loaded like global-features.js: <script src="/api.js"></script>

   Every page previously built its own Supabase client (SB_URL/SB_KEY +
   supabase.createClient). This is the single place that talks to the
   self-hosted backend instead, so auth/session/lookup logic isn't
   duplicated six times across the site.

   The backend serves these pages itself (same origin), so requests are
   relative by default — no cross-site cookie/CORS setup needed.
   window.__API_BASE__ is an escape hatch for pointing a local static
   checkout at a separately-running backend during development.
*/
(function () {
  var API_BASE = window.__API_BASE__ || '';

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function request(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      var csrf = getCookie('ap_csrf');
      if (csrf) headers['x-csrf-token'] = csrf;
    }
    return fetch(API_BASE + path, {
      method: method,
      credentials: 'include',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) return { error: data.error || ('Request failed (' + res.status + ')') };
        return data;
      });
    }).catch(function () {
      return { error: 'Could not reach the server. Check your connection and try again.' };
    });
  }

  var api = {
    // ── Auth ──
    getSession: function () {
      return request('/api/auth/session').then(function (r) {
        return r.error ? null : r;
      });
    },
    signIn: function (email, password) {
      return request('/api/auth/signin', { method: 'POST', body: { email: email, password: password } });
    },
    signOut: function () {
      return request('/api/auth/signout', { method: 'POST' });
    },
    signOutAllDevices: function () {
      return request('/api/auth/signout-all', { method: 'POST' });
    },
    changePassword: function (current, newPassword) {
      return request('/api/auth/change-password', { method: 'POST', body: { current: current, new_password: newPassword } });
    },
    requestReset: function (email) {
      return request('/api/auth/request-reset', { method: 'POST', body: { email: email } });
    },
    resetPassword: function (token, newPassword) {
      return request('/api/auth/reset', { method: 'POST', body: { token: token, new_password: newPassword } });
    },

    // ── Saved lookups ──
    getLookups: function () {
      return request('/api/lookups');
    },
    saveLookup: function (lookup) {
      return request('/api/lookups', { method: 'POST', body: lookup });
    },
    deleteLookup: function (id) {
      return request('/api/lookups/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    // ── Admin ──
    adminListUsers: function () {
      return request('/api/admin/users');
    },
    adminCreateUser: function (user) {
      return request('/api/admin/users', { method: 'POST', body: user });
    },
    adminAllLookups: function () {
      return request('/api/admin/lookups');
    },
    adminSetAdmin: function (userId, isAdmin) {
      return request('/api/admin/users/' + encodeURIComponent(userId) + '/set-admin', {
        method: 'POST',
        body: { is_admin: isAdmin },
      });
    },
    adminBan: function (userId) {
      return request('/api/admin/users/' + encodeURIComponent(userId) + '/ban', { method: 'POST' });
    },
    adminUnban: function (userId) {
      return request('/api/admin/users/' + encodeURIComponent(userId) + '/unban', { method: 'POST' });
    },
  };

  window.api = api;
})();
