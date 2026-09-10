// AP Workspace — Admin User Management
//
// Server-side only. Uses the service-role key (set as a Supabase secret,
// never shipped to the browser) to call the Auth Admin API. Every request
// is verified against the caller's own JWT before anything privileged runs —
// app_metadata.is_admin can only be true if it was set from the SQL editor
// or from this function itself, never from client-side code (see schema.sql).
//
// Actions (POST body: {action, ...}):
//   list                                                        -> { users: [...] }
//   create          {email,first_name,last_name,password,
//                    is_admin,verified_by_id}                    -> { id }
//   update_profile  {user_id,email,first_name,last_name}         -> { ok: true }
//   set_admin       {user_id,is_admin}                           -> { ok: true }
//   ban             {user_id}                                    -> { ok: true }
//   unban           {user_id}                                    -> { ok: true }
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
        verified_by_name: u.user_metadata?.verified_by_name || null,
      }));
      return json({ users });
    }

    if (action === 'create') {
      const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
      const firstName = typeof body?.first_name === 'string' ? body.first_name.trim() : '';
      const lastName = typeof body?.last_name === 'string' ? body.last_name.trim() : '';
      const makeAdmin = body?.is_admin === true;
      const password = typeof body?.password === 'string' ? body.password : '';
      const verifiedById =
        typeof body?.verified_by_id === 'string' && body.verified_by_id ? body.verified_by_id : null;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

      // "Verified By" records which admin vouched for this account — look the
      // caller-supplied id up server-side rather than trusting a client-sent
      // name, and reject it outright if it doesn't actually belong to an admin.
      let verifiedByName: string | null = null;
      if (verifiedById) {
        const { data: v, error: vErr } = await admin.auth.admin.getUserById(verifiedById);
        if (vErr || !v?.user || v.user.app_metadata?.is_admin !== true) {
          return json({ error: 'Verified By must be an existing admin' }, 400);
        }
        const vName = [v.user.user_metadata?.first_name, v.user.user_metadata?.last_name]
          .filter(Boolean)
          .join(' ');
        verifiedByName = vName || v.user.email || null;
      }

      // Admin sets the password directly here (by explicit choice — see
      // schema.sql for the tradeoff this reverses from the invite-email flow
      // used elsewhere). email_confirm is set so they can sign in right away
      // without a confirmation email that will never be sent.
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          verified_by_id: verifiedById || undefined,
          verified_by_name: verifiedByName || undefined,
        },
        app_metadata: { is_admin: makeAdmin },
      });
      if (error) {
        return json({ error: error.message }, error.status === 422 ? 409 : 500);
      }

      await admin.from('admin_audit_log').insert({
        actor_id: caller.id,
        action: 'create_user',
        target_user_id: created.user.id,
        details: { email, is_admin: makeAdmin, verified_by_id: verifiedById },
      });

      return json({ id: created.user.id });
    }

    if (action === 'update_profile') {
      const targetId = body?.user_id;
      if (!targetId || typeof targetId !== 'string') return json({ error: 'user_id required' }, 400);

      const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
      const firstName = typeof body?.first_name === 'string' ? body.first_name.trim() : '';
      const lastName = typeof body?.last_name === 'string' ? body.last_name.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email' }, 400);

      const { data: existing, error: getErr } = await admin.auth.admin.getUserById(targetId);
      if (getErr || !existing?.user) return json({ error: getErr?.message || 'User not found' }, 404);

      const mergedMeta = { ...(existing.user.user_metadata || {}), first_name: firstName || undefined, last_name: lastName || undefined };
      const { error } = await admin.auth.admin.updateUserById(targetId, { email, user_metadata: mergedMeta });
      if (error) {
        return json({ error: error.message }, error.status === 422 ? 409 : 500);
      }

      await admin.from('admin_audit_log').insert({
        actor_id: caller.id,
        action: 'update_profile',
        target_user_id: targetId,
        details: { email, first_name: firstName, last_name: lastName },
      });

      return json({ ok: true });
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
