// AP Workspace — Cloudflare Worker API
// Replaces Supabase (auth + saved_lookups + admin-users Edge Function) with
// a self-hosted backend that runs entirely on Cloudflare (Workers + D1) —
// no other service, so this one file has zero external dependencies and can
// be pasted directly into the Cloudflare dashboard's Worker editor.
//
// Session model: an opaque random token in an httpOnly cookie, looked up
// against the `sessions` table on every request (not a JWT) — revoking a
// session is just deleting its row. The cookie is issued WITHOUT Max-Age/
// Expires, so browsers treat it as a session cookie and drop it the moment
// the browser closes — this preserves the "must sign in again after closing
// the app" requirement the site already had under Supabase.
//
// Passwords: PBKDF2-SHA256 via the native Web Crypto API (crypto.subtle) —
// no bcrypt library needed. Argon2id was considered (it's the generally
// preferred choice today) but has no native implementation in the Workers
// runtime — using it would require a WASM package, which breaks the
// deliberate zero-dependency, paste-into-the-dashboard design this Worker
// is built around. PBKDF2-SHA256 at 210,000 iterations is OWASP's current
// minimum-acceptable recommendation for that algorithm, and native to the
// runtime with no dependency at all.
//
// There is no self-service "forgot password" — that would need an email
// provider, which is a third-party service this app deliberately doesn't
// use. Instead an admin resets a user's password directly from the Admin
// Console (POST /api/admin/users/:id/reset-password), the same way an
// admin already sets the initial password when creating an account.
//
// CSRF: app.anjanpatel.ca and api.anjanpatel.ca share the registrable
// domain anjanpatel.ca, so browsers treat them as the same "site". A
// SameSite=Lax cookie is therefore sent on requests between them but
// withheld on genuinely cross-site requests (e.g. from evil.com), which is
// exactly the CSRF protection this needs — no separate CSRF token required.
//
// Brute-force protection: login_attempts tracks failed sign-ins by the
// identifier (email or username) someone typed in, not by IP — Workers
// doesn't reliably expose a stable client IP behind Cloudflare's edge, and
// keying by identifier stops credential-stuffing against one account
// regardless of which IP it comes from. After MAX_LOGIN_ATTEMPTS failures
// within the tracking window, that identifier is locked out for
// LOCKOUT_MINUTES. A successful login clears its row.

const ALLOWED_ORIGIN = 'https://app.anjanpatel.ca';
const COOKIE_NAME = 'ap_sess';
const SESSION_MAX_AGE_S = 60 * 60 * 24; // 24h absolute server-side cap, checked per request
const PBKDF2_ITERATIONS = 210000; // OWASP's current minimum for PBKDF2-HMAC-SHA256
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_KEYLEN_BITS = 256;
const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(), ...extraHeaders },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function minutesFromNow(mins) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEYLEN_BITS
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    expected.length * 8
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function sessionCookieHeader(token) {
  // No Max-Age/Expires on purpose — see the header comment above.
  return `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username || null,
    first_name: u.first_name || null,
    last_name: u.last_name || null,
    is_admin: !!u.is_admin,
    banned_until: u.banned_until || null,
    account_number: u.account_number || null,
    verified_by_name: u.verified_by_name || null,
    must_change_password: !!u.must_change_password,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at || null,
  };
}

async function getSessionUser(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const row = await env.DB.prepare(
    `select s.expires_at, u.* from sessions s join users u on u.id = s.user_id where s.token = ?`
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.banned_until && new Date(row.banned_until).getTime() > Date.now()) return null;
  await env.DB.prepare(`update sessions set last_used_at = ? where token = ?`).bind(nowIso(), token).run();
  return row;
}

async function requireAuth(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { error: json({ error: 'Not signed in' }, 401) };
  return { user };
}

async function requireAdmin(request, env) {
  const { user, error } = await requireAuth(request, env);
  if (error) return { error };
  if (!user.is_admin) return { error: json({ error: 'Forbidden — admin access required' }, 403) };
  return { user };
}

// Never logs passwords or password hashes — `details` is always a small,
// specific JSON object describing what changed, not raw request bodies.
async function logAudit(env, actorId, action, targetUserId, details) {
  await env.DB.prepare(
    `insert into audit_logs (id, actor_id, action, target_user_id, details, created_at) values (?,?,?,?,?,?)`
  )
    .bind(crypto.randomUUID(), actorId, action, targetUserId, JSON.stringify(details || {}), nowIso())
    .run();
}

// ── Login rate limiting ──────────────────────────────────────────────
async function checkLoginLockout(env, identifier) {
  const row = await env.DB.prepare(`select * from login_attempts where identifier = ?`).bind(identifier).first();
  if (!row) return { locked: false };
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return { locked: true };
  return { locked: false };
}

async function recordFailedLogin(env, identifier) {
  const row = await env.DB.prepare(`select * from login_attempts where identifier = ?`).bind(identifier).first();
  const windowExpired = row && Date.now() - new Date(row.first_attempt_at).getTime() > ATTEMPT_WINDOW_MINUTES * 60 * 1000;
  if (!row || windowExpired) {
    await env.DB.prepare(
      `insert into login_attempts (identifier, attempt_count, first_attempt_at, locked_until) values (?, 1, ?, null)
       on conflict(identifier) do update set attempt_count = 1, first_attempt_at = excluded.first_attempt_at, locked_until = null`
    )
      .bind(identifier, nowIso())
      .run();
    return;
  }
  const nextCount = row.attempt_count + 1;
  const lockedUntil = nextCount >= MAX_LOGIN_ATTEMPTS ? minutesFromNow(LOCKOUT_MINUTES) : null;
  await env.DB.prepare(`update login_attempts set attempt_count = ?, locked_until = ? where identifier = ?`)
    .bind(nextCount, lockedUntil, identifier)
    .run();
}

async function clearLoginAttempts(env, identifier) {
  await env.DB.prepare(`delete from login_attempts where identifier = ?`).bind(identifier).run();
}

// Named exports alongside the default — purely additive, so this is still
// a valid Cloudflare Workers ES-module entrypoint (only `fetch` on the
// default export matters to the runtime). This just makes the
// dependency-free crypto/validation logic unit-testable with plain
// `node --test`, without needing a D1 mock or a Workers runtime.
export { hashPassword, verifyPassword, isValidEmail };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Auth ──────────────────────────────────────────────
      if (path === '/api/auth/signin' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        // Accepts either field name — the login form sends one "identifier"
        // that can be an email or a username (e.g. the bootstrap admin).
        const identifierRaw = String(body.identifier || body.email || body.username || '').trim();
        const identifier = identifierRaw.toLowerCase();
        const password = String(body.password || '');

        if (!identifier || !password) return json({ error: 'Invalid email or password' }, 401);

        const { locked } = await checkLoginLockout(env, identifier);
        if (locked) {
          return json({ error: 'Too many failed attempts. Try again in a few minutes.' }, 429);
        }

        const user = isValidEmail(identifierRaw)
          ? await env.DB.prepare(`select * from users where email = ?`).bind(identifier).first()
          : await env.DB.prepare(`select * from users where username = ?`).bind(identifierRaw).first();

        // Deliberately identical error for "no such account" and "wrong
        // password" — never confirms whether an identifier exists.
        if (!user || !(await verifyPassword(password, user.password_hash))) {
          await recordFailedLogin(env, identifier);
          await logAudit(env, user ? user.id : null, 'LOGIN_FAILURE', user ? user.id : null, { identifier });
          return json({ error: 'Invalid email or password' }, 401);
        }
        if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
          await logAudit(env, user.id, 'LOGIN_FAILURE', user.id, { reason: 'disabled' });
          return json({ error: 'This account has been disabled' }, 403);
        }

        await clearLoginAttempts(env, identifier);
        const token = randomToken();
        const expires = new Date(Date.now() + SESSION_MAX_AGE_S * 1000).toISOString();
        await env.DB.prepare(`insert into sessions (token, user_id, created_at, expires_at, last_used_at) values (?,?,?,?,?)`)
          .bind(token, user.id, nowIso(), expires, nowIso())
          .run();
        await env.DB.prepare(`update users set last_sign_in_at = ? where id = ?`).bind(nowIso(), user.id).run();
        await logAudit(env, user.id, 'LOGIN_SUCCESS', user.id, {});
        return json({ user: publicUser({ ...user, last_sign_in_at: nowIso() }) }, 200, { 'Set-Cookie': sessionCookieHeader(token) });
      }

      if (path === '/api/auth/signout' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const token = getCookie(request, COOKIE_NAME);
        if (token) {
          const row = await env.DB.prepare(`select user_id from sessions where token = ?`).bind(token).first();
          if (row) {
            if (body.scope === 'global') {
              await env.DB.prepare(`delete from sessions where user_id = ?`).bind(row.user_id).run();
              await logAudit(env, row.user_id, 'SESSION_REVOKED', row.user_id, { scope: 'all_devices' });
            } else {
              await env.DB.prepare(`delete from sessions where token = ?`).bind(token).run();
              await logAudit(env, row.user_id, 'LOGOUT', row.user_id, {});
            }
          }
        }
        return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
      }

      if (path === '/api/auth/session' && request.method === 'GET') {
        const user = await getSessionUser(request, env);
        if (!user) return json({ error: 'Not signed in' }, 401);
        return json({ user: publicUser(user) });
      }

      if (path === '/api/auth/change-password' && request.method === 'POST') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        const body = await request.json().catch(() => ({}));
        const current = String(body.current || '');
        const next = String(body.new || '');
        if (!(await verifyPassword(current, user.password_hash))) return json({ error: 'Current password is incorrect' }, 400);
        if (next.length < 8) return json({ error: 'New password must be at least 8 characters' }, 400);
        const hash = await hashPassword(next);
        await env.DB.prepare(
          `update users set password_hash = ?, must_change_password = 0, password_changed_at = ? where id = ?`
        )
          .bind(hash, nowIso(), user.id)
          .run();
        await logAudit(env, user.id, 'PASSWORD_CHANGED', user.id, { self_service: true });
        return json({ ok: true });
      }

      // ── Saved lookups ─────────────────────────────────────
      if (path === '/api/lookups' && request.method === 'GET') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        const rows = user.is_admin
          ? await env.DB.prepare(`select * from saved_lookups order by created_at desc limit 500`).all()
          : await env.DB.prepare(`select * from saved_lookups where user_id = ? order by created_at desc`)
              .bind(user.id)
              .all();
        const lookups = rows.results.map((r) => ({ ...r, params: JSON.parse(r.params) }));
        return json({ lookups });
      }

      if (path === '/api/lookups' && request.method === 'POST') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        const body = await request.json().catch(() => ({}));
        const tool = String(body.tool || '');
        if (!['flange', 'torque', 'tubing'].includes(tool)) return json({ error: 'Invalid tool' }, 400);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `insert into saved_lookups (id, user_id, tool, label, params, result_summary, created_at) values (?,?,?,?,?,?,?)`
        )
          .bind(id, user.id, tool, body.label || null, JSON.stringify(body.params || {}), body.result_summary || null, nowIso())
          .run();
        return json({ id });
      }

      if (path.startsWith('/api/lookups/') && request.method === 'DELETE') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        const id = path.split('/').pop();
        await env.DB.prepare(`delete from saved_lookups where id = ? and user_id = ?`).bind(id, user.id).run();
        return json({ ok: true });
      }

      // ── Admin: user management ───────────────────────────
      if (path === '/api/admin/users' && request.method === 'GET') {
        const { error } = await requireAdmin(request, env);
        if (error) return error;
        const rows = await env.DB.prepare(`select * from users order by created_at asc limit 200`).all();
        return json({ users: rows.results.map(publicUser) });
      }

      if (path === '/api/admin/users' && request.method === 'POST') {
        const { user: caller, error } = await requireAdmin(request, env);
        if (error) return error;
        const body = await request.json().catch(() => ({}));
        const email = String(body.email || '').toLowerCase().trim();
        const username = body.username ? String(body.username).trim() : null;
        const firstName = String(body.first_name || '').trim();
        const lastName = String(body.last_name || '').trim();
        const makeAdmin = body.is_admin === true;
        const password = String(body.password || '');
        const verifiedById = body.verified_by_id || null;

        if (!isValidEmail(email)) return json({ error: 'Enter a valid email' }, 400);
        if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

        const existing = await env.DB.prepare(`select id from users where email = ?`).bind(email).first();
        if (existing) return json({ error: 'An account with this email already exists' }, 409);
        if (username) {
          const usernameTaken = await env.DB.prepare(`select id from users where username = ?`).bind(username).first();
          if (usernameTaken) return json({ error: 'That username is already taken' }, 409);
        }

        let verifiedByName = null;
        if (verifiedById) {
          const v = await env.DB.prepare(`select * from users where id = ?`).bind(verifiedById).first();
          if (!v || !v.is_admin) return json({ error: 'Verified By must be an existing admin' }, 400);
          verifiedByName = [v.first_name, v.last_name].filter(Boolean).join(' ') || v.email;
        }

        const { count } = await env.DB.prepare(`select count(*) as count from users`).first();
        const accountNumber = 'AP-' + String(count + 1).padStart(4, '0');

        const id = crypto.randomUUID();
        const hash = await hashPassword(password);
        await env.DB.prepare(
          `insert into users (id, email, username, password_hash, first_name, last_name, is_admin, verified_by_id, verified_by_name, account_number, must_change_password, created_at)
           values (?,?,?,?,?,?,?,?,?,?,1,?)`
        )
          .bind(id, email, username, hash, firstName || null, lastName || null, makeAdmin ? 1 : 0, verifiedById, verifiedByName, accountNumber, nowIso())
          .run();

        await logAudit(env, caller.id, 'USER_CREATED', id, { email, is_admin: makeAdmin, verified_by_id: verifiedById, account_number: accountNumber });
        return json({ id, account_number: accountNumber });
      }

      const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)(\/.*)?$/);
      if (adminUserMatch) {
        const { user: caller, error } = await requireAdmin(request, env);
        if (error) return error;
        const targetId = adminUserMatch[1];
        const sub = adminUserMatch[2] || '';

        if (sub === '' && request.method === 'PATCH') {
          const body = await request.json().catch(() => ({}));
          const email = String(body.email || '').toLowerCase().trim();
          const firstName = String(body.first_name || '').trim();
          const lastName = String(body.last_name || '').trim();
          if (!isValidEmail(email)) return json({ error: 'Enter a valid email' }, 400);

          const existing = await env.DB.prepare(`select id from users where email = ? and id != ?`).bind(email, targetId).first();
          if (existing) return json({ error: 'Another account already uses this email' }, 409);

          await env.DB.prepare(`update users set email = ?, first_name = ?, last_name = ? where id = ?`)
            .bind(email, firstName || null, lastName || null, targetId)
            .run();
          await logAudit(env, caller.id, 'USER_UPDATED', targetId, { email, first_name: firstName, last_name: lastName });
          return json({ ok: true });
        }

        if (sub === '' && request.method === 'DELETE') {
          if (targetId === caller.id) return json({ error: "You can't delete your own account" }, 400);
          const target = await env.DB.prepare(`select id, email from users where id = ?`).bind(targetId).first();
          if (!target) return json({ error: 'User not found' }, 404);
          await env.DB.prepare(`delete from saved_lookups where user_id = ?`).bind(targetId).run();
          await env.DB.prepare(`delete from sessions where user_id = ?`).bind(targetId).run();
          await env.DB.prepare(`delete from users where id = ?`).bind(targetId).run();
          await logAudit(env, caller.id, 'USER_DELETED', null, { deleted_user_id: targetId, email: target.email });
          return json({ ok: true });
        }

        if (sub === '/reset-password' && request.method === 'POST') {
          // Admin-initiated reset — the only "forgot password" path this app
          // has, since there's no email provider to deliver a self-service
          // reset link through. The admin sets a new password directly
          // (same validation as creating a user) and hands it to the person
          // out of band; every existing session for that account is
          // revoked so a stolen session can't survive the reset.
          const body = await request.json().catch(() => ({}));
          const newPassword = String(body.new_password || '');
          if (newPassword.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
          const hash = await hashPassword(newPassword);
          await env.DB.prepare(
            `update users set password_hash = ?, must_change_password = 1 where id = ?`
          )
            .bind(hash, targetId)
            .run();
          await env.DB.prepare(`delete from sessions where user_id = ?`).bind(targetId).run();
          await logAudit(env, caller.id, 'PASSWORD_RESET_BY_ADMIN', targetId, {});
          await logAudit(env, caller.id, 'SESSION_REVOKED', targetId, { reason: 'password_reset' });
          return json({ ok: true });
        }

        if (sub === '/revoke-sessions' && request.method === 'POST') {
          await env.DB.prepare(`delete from sessions where user_id = ?`).bind(targetId).run();
          await logAudit(env, caller.id, 'SESSION_REVOKED', targetId, { reason: 'admin_action' });
          return json({ ok: true });
        }

        if (targetId === caller.id) return json({ error: "You can't change your own access" }, 400);

        if (sub === '/set-admin' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const makeAdmin = body.is_admin === true;
          await env.DB.prepare(`update users set is_admin = ? where id = ?`).bind(makeAdmin ? 1 : 0, targetId).run();
          await logAudit(env, caller.id, 'ROLE_CHANGED', targetId, { is_admin: makeAdmin });
          return json({ ok: true });
        }

        if (sub === '/ban' && request.method === 'POST') {
          const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
          await env.DB.prepare(`update users set banned_until = ? where id = ?`).bind(farFuture, targetId).run();
          await env.DB.prepare(`delete from sessions where user_id = ?`).bind(targetId).run();
          await logAudit(env, caller.id, 'USER_DISABLED', targetId, {});
          return json({ ok: true });
        }

        if (sub === '/unban' && request.method === 'POST') {
          await env.DB.prepare(`update users set banned_until = null where id = ?`).bind(targetId).run();
          await logAudit(env, caller.id, 'USER_ENABLED', targetId, {});
          return json({ ok: true });
        }
      }

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      // Never leak stack traces, internal paths, or the raw error message
      // (which for a D1 error can include schema/column detail) to the
      // client — log the real error server-side only.
      console.error('[AP Workspace API error]', e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
