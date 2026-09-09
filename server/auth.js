// AP Workspace — auth helpers (replaces Supabase Auth)
//
// Sessions are opaque random tokens stored server-side (not JWT) — revoking
// a session is just deleting its row, which a stateless JWT can't do
// without extra infrastructure (a blocklist, short expiry + refresh, etc).

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const SESSION_DAYS = 30;
const SESSION_COOKIE = 'ap_session';
const CSRF_COOKIE = 'ap_csrf';

// A precomputed hash of a value nobody will ever type, used to make the
// bcrypt comparison run even when the email isn't registered — otherwise
// "no such user" returns instantly while "wrong password" takes ~100ms of
// bcrypt work, and that timing gap lets an attacker enumerate which
// emails have accounts without ever seeing an error message.
const DUMMY_HASH = bcrypt.hashSync('ap-workspace-dummy-hash-for-timing-safety', 12);

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 12);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userId) {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    'insert into sessions (token, user_id, created_at, expires_at) values (?,?,?,?)'
  ).run(token, userId, now.toISOString(), expires.toISOString());
  return { token, expires };
}

function deleteSession(token) {
  db.prepare('delete from sessions where token = ?').run(token);
}

function getUserBySession(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `select u.* from sessions s
       join users u on u.id = s.user_id
       where s.token = ? and s.expires_at > ?`
    )
    .get(token, new Date().toISOString());
  return row || null;
}

const isProd = process.env.NODE_ENV === 'production';

function setSessionCookies(res, session) {
  const csrfToken = randomToken();
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    // 'lax' because the API and the pages it serves share one origin now —
    // 'none' is for cross-site cookies and requires Secure, which breaks
    // the cookie entirely on plain http (e.g. local dev without TLS).
    sameSite: 'lax',
    expires: session.expires,
    path: '/',
  };
  res.cookie(SESSION_COOKIE, session.token, cookieOpts);
  // CSRF cookie must be readable by frontend JS, so httpOnly is off here —
  // the double-submit pattern relies on the attacker's page being unable
  // to read it cross-origin, not on it being a secret from the browser.
  res.cookie(CSRF_COOKIE, csrfToken, { ...cookieOpts, httpOnly: false });
}

function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  const user = getUserBySession(token);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  if (user.banned_until && new Date(user.banned_until) > new Date()) {
    return res.status(403).json({ error: 'This account has been banned' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden — admin access required' });
    next();
  });
}

// Double-submit CSRF check for mutating requests: the header must match
// the (non-httpOnly) cookie, which a cross-origin attacker page cannot read.
function requireCsrf(req, res, next) {
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}

module.exports = {
  SESSION_COOKIE,
  CSRF_COOKIE,
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
  randomToken,
  createSession,
  deleteSession,
  getUserBySession,
  setSessionCookies,
  clearSessionCookies,
  requireAuth,
  requireAdmin,
  requireCsrf,
};
