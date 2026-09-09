// AP Workspace — self-hosted backend (replaces Supabase) AND static site host.
// One process serves both the JSON API and the site's HTML/CSS/JS, so the
// whole app is one deployment at one URL instead of split across two hosts.
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const {
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
  randomToken,
  createSession,
  deleteSession,
  setSessionCookies,
  clearSessionCookies,
  requireAuth,
  requireAdmin,
  requireCsrf,
} = require('./auth');
const { sendResetEmail } = require('./email');

const app = express();
const ORIGIN = process.env.FRONTEND_ORIGIN || 'https://app.anjanpatel.ca';
const PORT = process.env.PORT || 3001;

// Render (and most PaaS hosts) sit behind a reverse proxy — without this,
// every request looks like it comes from the proxy's own IP, which makes
// IP-based rate limiting either share one bucket across all users or fail
// outright (express-rate-limit refuses to start without it in prod).
app.set('trust proxy', 1);

// Creates the very first admin account from plain environment variables,
// so a small deployment never needs shell/terminal access at all — just
// type an email and password into the host's dashboard once. Runs on every
// boot but is a no-op after the first, since it only inserts when that
// email doesn't already exist.
if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase().trim();
  if (process.env.BOOTSTRAP_ADMIN_PASSWORD.length < 8) {
    // Fail loudly instead of silently creating a login nobody can use — the
    // sign-in page itself refuses to submit anything under 8 characters.
    console.error(
      `BOOTSTRAP_ADMIN_PASSWORD is only ${process.env.BOOTSTRAP_ADMIN_PASSWORD.length} characters — ` +
        'it must be at least 8, or this account could never sign in. Not creating it.'
    );
  } else if (!db.prepare('select 1 from users where email = ?').get(email)) {
    db.prepare(
      'insert into users (id, email, password_hash, first_name, last_name, is_admin, created_at) values (?,?,?,?,?,1,?)'
    ).run(
      crypto.randomUUID(),
      email,
      hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD),
      process.env.BOOTSTRAP_ADMIN_FIRST_NAME || null,
      process.env.BOOTSTRAP_ADMIN_LAST_NAME || null,
      new Date().toISOString()
    );
    console.log(`Bootstrapped admin account for ${email}`);
  }
}

// contentSecurityPolicy is off here because every HTML page declares its own
// CSP via a <meta> tag, tuned per-page (fonts, analytics, the flange PDF
// lib); helmet's stricter default would fight that policy instead of
// complementing it. Its other headers (HSTS, nosniff, frame options) stay on.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ORIGIN, credentials: true }));

const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ── Auth ─────────────────────────────────────────────

// Two independent defenses against credential attacks: signinLimiter above
// throttles by IP (stops one attacker hammering many accounts), and the
// per-account lockout below throttles by account (stops an attacker who
// controls many IPs from brute-forcing one specific person's password).
app.post('/api/auth/signin', signinLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('select * from users where email = ?').get(String(email).toLowerCase().trim());

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(403).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }

  // Always run the bcrypt comparison, even for an email that doesn't
  // exist — comparing against DUMMY_HASH keeps the response time the
  // same either way, so timing can't reveal which emails have accounts.
  const passwordOk = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !passwordOk) {
    if (user) {
      const attempts = user.failed_attempts + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
          : null;
      db.prepare('update users set failed_attempts = ?, locked_until = ? where id = ?').run(
        attempts,
        lockedUntil,
        user.id
      );
    }
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.banned_until && new Date(user.banned_until) > new Date()) {
    return res.status(403).json({ error: 'This account has been blocked' });
  }

  db.prepare(
    'update users set last_sign_in_at = ?, failed_attempts = 0, locked_until = null where id = ?'
  ).run(new Date().toISOString(), user.id);

  const session = createSession(user.id);
  setSessionCookies(res, session);
  res.json({ email: user.email, is_admin: !!user.is_admin });
});

app.post('/api/auth/signout', (req, res) => {
  const token = req.cookies[require('./auth').SESSION_COOKIE];
  if (token) deleteSession(token);
  clearSessionCookies(res);
  res.json({ ok: true });
});

// Revokes every session for this user (all devices/browsers), not just the
// caller's own cookie — used by the "sign out everywhere" settings button.
app.post('/api/auth/signout-all', requireAuth, requireCsrf, (req, res) => {
  db.prepare('delete from sessions where user_id = ?').run(req.user.id);
  clearSessionCookies(res);
  res.json({ ok: true });
});

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ email: req.user.email, is_admin: !!req.user.is_admin });
});

app.post('/api/auth/change-password', requireAuth, requireCsrf, (req, res) => {
  const { current, new_password } = req.body || {};
  if (!current || !new_password) return res.status(400).json({ error: 'Current and new password required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (!verifyPassword(current, req.user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  db.prepare('update users set password_hash = ? where id = ?').run(hashPassword(new_password), req.user.id);
  res.json({ ok: true });
});

app.post('/api/auth/request-reset', signinLimiter, async (req, res) => {
  const { email } = req.body || {};
  // Always respond success, whether or not the email exists — don't leak
  // which addresses have accounts.
  if (email && EMAIL_RE.test(email)) {
    const user = db.prepare('select * from users where email = ?').get(String(email).toLowerCase().trim());
    if (user) {
      const token = randomToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('insert into password_resets (token, user_id, expires_at, used) values (?,?,?,0)').run(
        token,
        user.id,
        expires
      );
      // Reuses index.html's existing reset-password view rather than a
      // separate page — the frontend reads ?token= on load and shows it.
      const resetUrl = `${ORIGIN}/?token=${token}`;
      try {
        await sendResetEmail(user.email, resetUrl);
      } catch (e) {
        console.error('sendResetEmail failed:', e.message);
      }
    }
  }
  res.json({ ok: true });
});

app.post('/api/auth/reset', (req, res) => {
  const { token, new_password } = req.body || {};
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const reset = db.prepare('select * from password_resets where token = ?').get(token);
  if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  }
  db.prepare('update users set password_hash = ? where id = ?').run(hashPassword(new_password), reset.user_id);
  db.prepare('update password_resets set used = 1 where token = ?').run(token);
  res.json({ ok: true });
});

// ── Saved lookups ────────────────────────────────────

app.get('/api/lookups', requireAuth, (req, res) => {
  const rows = db
    .prepare('select id, tool, label, result_summary, params, created_at from saved_lookups where user_id = ? order by created_at desc')
    .all(req.user.id);
  res.json({ lookups: rows.map((r) => ({ ...r, params: JSON.parse(r.params) })) });
});

app.post('/api/lookups', requireAuth, requireCsrf, (req, res) => {
  const { tool, label, params, result_summary } = req.body || {};
  if (!['flange', 'torque', 'tubing'].includes(tool)) return res.status(400).json({ error: 'Invalid tool' });
  const id = crypto.randomUUID();
  db.prepare(
    'insert into saved_lookups (id, user_id, tool, label, result_summary, params, created_at) values (?,?,?,?,?,?,?)'
  ).run(id, req.user.id, tool, label || null, result_summary || null, JSON.stringify(params || {}), new Date().toISOString());
  res.json({ id });
});

app.delete('/api/lookups/:id', requireAuth, requireCsrf, (req, res) => {
  const result = db
    .prepare('delete from saved_lookups where id = ? and user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Admin-only: every user's lookups (mirrors the existing dashboard admin panel)
app.get('/api/admin/lookups', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      'select id, user_id, tool, label, result_summary, params, created_at from saved_lookups order by created_at desc limit 200'
    )
    .all();
  res.json({ lookups: rows.map((r) => ({ ...r, params: JSON.parse(r.params) })) });
});

// ── Admin: user management ──────────────────────────

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      'select id, email, first_name, last_name, is_admin, banned_until, created_at, last_sign_in_at from users order by created_at desc'
    )
    .all();
  res.json({ users: rows.map((u) => ({ ...u, is_admin: !!u.is_admin })) });
});

function logAdminAction(actorId, action, targetUserId, details) {
  db.prepare(
    'insert into admin_audit_log (id, actor_id, action, target_user_id, details, created_at) values (?,?,?,?,?,?)'
  ).run(crypto.randomUUID(), actorId, action, targetUserId, JSON.stringify(details || {}), new Date().toISOString());
}

// Lets an admin create a user directly from the Admin Console — no shell,
// no environment variables, no signup page. This is the only way accounts
// get created day-to-day; migration and the bootstrap env vars just seed
// the very first one.
app.post('/api/admin/users', requireAdmin, requireCsrf, (req, res) => {
  const { first_name, last_name, email, password, is_admin } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = db.prepare('select 1 from users where email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const id = crypto.randomUUID();
  db.prepare(
    'insert into users (id, email, password_hash, first_name, last_name, is_admin, created_at) values (?,?,?,?,?,?,?)'
  ).run(
    id,
    normalizedEmail,
    hashPassword(password),
    first_name || null,
    last_name || null,
    is_admin === true ? 1 : 0,
    new Date().toISOString()
  );
  logAdminAction(req.user.id, 'create_user', id, { email: normalizedEmail, is_admin: is_admin === true });
  res.json({ id });
});

app.post('/api/admin/users/:id/set-admin', requireAdmin, requireCsrf, (req, res) => {
  const targetId = req.params.id;
  const makeAdmin = req.body?.is_admin === true;
  if (targetId === req.user.id) return res.status(400).json({ error: "You can't change your own access" });
  const target = db.prepare('select id from users where id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  db.prepare('update users set is_admin = ? where id = ?').run(makeAdmin ? 1 : 0, targetId);
  logAdminAction(req.user.id, makeAdmin ? 'set_admin' : 'revoke_admin', targetId, { is_admin: makeAdmin });
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/ban', requireAdmin, requireCsrf, (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: "You can't change your own access" });
  const target = db.prepare('select id from users where id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const farFuture = new Date('2099-01-01T00:00:00Z').toISOString();
  db.prepare('update users set banned_until = ? where id = ?').run(farFuture, targetId);
  db.prepare('delete from sessions where user_id = ?').run(targetId); // cut any active session immediately
  logAdminAction(req.user.id, 'ban_user', targetId, {});
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/unban', requireAdmin, requireCsrf, (req, res) => {
  const targetId = req.params.id;
  const target = db.prepare('select id from users where id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  db.prepare('update users set banned_until = null where id = ?').run(targetId);
  logAdminAction(req.user.id, 'unban_user', targetId, {});
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Static site ──────────────────────────────────────
// Serves the HTML/CSS/JS pages from the repo root so the whole app — API and
// site — is one deployment. This directory also holds server/ itself,
// render.yaml, etc., so block those explicitly rather than publish the
// backend's source alongside the pages.
const SITE_ROOT = path.join(__dirname, '..');
const BLOCKED_PREFIXES = ['/server', '/.git', '/.github', '/test', '/.dev'];
const BLOCKED_FILES = ['/render.yaml', '/DEPLOY.md', '/.gitignore'];

app.use((req, res, next) => {
  const p = req.path;
  if (BLOCKED_FILES.includes(p) || BLOCKED_PREFIXES.some((bp) => p === bp || p.startsWith(bp + '/'))) {
    return res.status(404).sendFile(path.join(SITE_ROOT, '404.html'));
  }
  next();
});

app.use(express.static(SITE_ROOT));

app.use((req, res) => {
  res.status(404).sendFile(path.join(SITE_ROOT, '404.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`AP Workspace API listening on :${PORT}`));
}

module.exports = app;
