// AP Workspace — Admin User Management
//
// Server-side only. Uses the service-role key (set as a Supabase secret,
// never shipped to the browser) to call the Auth Admin API. Every request
// is verified against the caller's own JWT before anything privileged runs —
// app_metadata.is_admin can only be true if it was set from the SQL editor
// or from this function itself, never from client-side code (see schema.sql).
//
// Actions (POST body: {action, ...}):
//   list                                                     -> { users: [...] }
//   create     {email,password,first_name,last_name,is_admin} -> { id }
//   set_admin  {user_id,is_admin}                             -> { ok: true }
//   ban        {user_id}                                      -> { ok: true }
//   unban      {user_id}                                      -> { ok: true }
//
// Every mutating action is written to admin_audit_log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const CORS = {
  'Access-Control-Allow-Origin': 'https://app.anjanpatel.ca',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Step 1: verify the caller is a signed-in admin. The anon client only
    // ever sees what the caller's own JWT permits — it cannot be spoofed
    // into claiming admin from the request body.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !callerData?.user) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const caller = callerData.user;
    if (caller.app_metadata?.is_admin !== true) {
      return json({ error: 'Forbidden — admin access required' }, 403);
    }

    // Step 2: everything below runs with the service role, but only ever
    // reached after the admin check above passes.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) return json({ error: error.message }, 500);
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.user_metadata?.first_name || null,
        last_name: u.user_metadata?.last_name || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_admin: u.app_metadata?.is_admin === true,
        banned_until: u.banned_until && u.banned_until !== 'none' ? u.banned_until : null,
      }));
      return json({ users });
    }

    if (action === 'create') {
      const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
      const firstName = typeof body?.first_name === 'string' ? body.first_name.trim() : '';
      const lastName = typeof body?.last_name === 'string' ? body.last_name.trim() : '';
      const makeAdmin = body?.is_admin === true;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email' }, 400);

      // No password is set here — inviteUserByEmail creates the account and
      // sends them a real email with a link to choose their own password.
      // Nobody but the new user ever knows it, unlike an admin picking one
      // and relaying it out of band.
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName || undefined, last_name: lastName || undefined },
        redirectTo: 'https://app.anjanpatel.ca/',
      });
      if (error) {
        // Supabase's own message for this case is reasonably clear already;
        // surface it as-is rather than guessing at a status code mapping.
        return json({ error: error.message }, error.status === 422 ? 409 : 500);
      }

      // inviteUserByEmail has no app_metadata param — set admin access, if
      // requested, as a separate update right after creating the account.
      if (makeAdmin) {
        await admin.auth.admin.updateUserById(invited.user.id, { app_metadata: { is_admin: true } });
      }

      await admin.from('admin_audit_log').insert({
        actor_id: caller.id,
        action: 'create_user',
        target_user_id: invited.user.id,
        details: { email, is_admin: makeAdmin },
      });

      return json({ id: invited.user.id });
    }

    if (action === 'set_admin' || action === 'ban' || action === 'unban') {
      const targetId = body?.user_id;
      if (!targetId || typeof targetId !== 'string') {
        return json({ error: 'user_id required' }, 400);
      }
      if (targetId === caller.id) {
        return json({ error: "You can't change your own access" }, 400);
      }

      let logAction = '';
      let details: Record<string, unknown> = {};

      if (action === 'set_admin') {
        const makeAdmin = body?.is_admin === true;
        // Fetch first and merge — never assume the Admin API replaces vs.
        // merges app_metadata; being explicit avoids silently wiping other keys.
        const { data: existing, error: getErr } = await admin.auth.admin.getUserById(targetId);
        if (getErr || !existing?.user) return json({ error: getErr?.message || 'User not found' }, 404);

        const mergedMeta = { ...(existing.user.app_metadata || {}), is_admin: makeAdmin };
        const { error } = await admin.auth.admin.updateUserById(targetId, { app_metadata: mergedMeta });
        if (error) return json({ error: error.message }, 500);

        logAction = makeAdmin ? 'set_admin' : 'revoke_admin';
        details = { is_admin: makeAdmin };
      } else {
        const banning = action === 'ban';
        const { error } = await admin.auth.admin.updateUserById(targetId, {
          ban_duration: banning ? '876000h' : 'none', // ~100 years, or lift immediately
        });
        if (error) return json({ error: error.message }, 500);

        logAction = banning ? 'ban_user' : 'unban_user';
      }

      await admin.from('admin_audit_log').insert({
        actor_id: caller.id,
        action: logAction,
        target_user_id: targetId,
        details,
      });

      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
