-- 20250101000000_initial_schema.sql already ran once, so editing its
-- CHECK constraint in place wouldn't reapply to the live table — the CLI
-- tracks which migration files already ran and skips them. This is a new
-- file so it applies on the next push, adding 'update_profile' (the
-- Admin Console's Edit User feature) to the allowed audit log actions.
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check
  check (action in ('create_user','update_profile','set_admin','revoke_admin','ban_user','unban_user'));
