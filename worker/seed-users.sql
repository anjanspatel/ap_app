-- ═══════════════════════════════════════════════════
-- AP Workspace — starter accounts
-- Run this ONCE, after schema.sql, in the same D1 dashboard Console —
-- paste, edit the placeholder rows below for your real people, then
-- Execute.
--
-- Every row below shares the SAME temporary password:
--
--     ChangeMe123!
--
-- Everyone should sign in with that once, then immediately set their own
-- password from Settings → Change Password (no admin needed for that
-- part). If anyone ever gets locked out afterward, an admin can set a
-- new password for them from the Admin Console → Users table — that is
-- this app's only "forgot password" path, since there's no email
-- provider wired up to send reset links.
-- ═══════════════════════════════════════════════════

-- Row 1 — make this yourself, as the first admin.
insert into users (id, email, password_hash, first_name, last_name, is_admin, account_number, created_at)
values (
  'u1',                                                                       -- any unique id — 'u1', 'u2', ... is fine
  'you@example.com',                                                          -- <-- your real email
  'pbkdf2$210000$SHUUzhgyszYMdFnoc13eQQ==$OnLivIzRXmOs4wkdBNUdBTmCUxQ5iTp+6d1fHJ64EtY=',
  'Your First Name',                                                          -- <-- edit
  'Your Last Name',                                                           -- <-- edit
  1,                                                                          -- 1 = admin, 0 = regular user
  'AP-0001',
  datetime('now')
);

-- Row 2 — copy this block for each additional person, change id/email/name/admin.
-- insert into users (id, email, password_hash, first_name, last_name, is_admin, account_number, created_at)
-- values (
--   'u2',
--   'someone-else@example.com',
--   'pbkdf2$210000$SHUUzhgyszYMdFnoc13eQQ==$OnLivIzRXmOs4wkdBNUdBTmCUxQ5iTp+6d1fHJ64EtY=',
--   'Their First Name',
--   'Their Last Name',
--   0,
--   'AP-0002',
--   datetime('now')
-- );
