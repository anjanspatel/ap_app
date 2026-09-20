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
-- must_change_password is set to 1, so the app forces a change on first
-- sign-in — nobody keeps using this shared temporary password. If anyone
-- ever gets locked out afterward, an admin can set a new password for them
-- from the Admin Console → Users table (that also sets must_change_password
-- back to 1) — that is this app's only "forgot password" path, since
-- there's no email provider wired up to send reset links.
--
-- `username` is optional — leave it null (just omit the column/value) for
-- anyone who's fine signing in with email. Set it when you want a plain
-- username login instead, e.g. for a bootstrap admin account.
-- ═══════════════════════════════════════════════════

-- Row 1 — make this yourself, as the first admin.
insert into users (id, email, username, password_hash, first_name, last_name, is_admin, account_number, must_change_password, created_at)
values (
  'u1',                                                                       -- any unique id — 'u1', 'u2', ... is fine
  'you@example.com',                                                          -- <-- your real email
  null,                                                                       -- <-- or a plain username, e.g. 'YourName_admin'
  'pbkdf2$100000$T2XVHC8xxQJLhddq1jLLEQ==$YIWLZ1kZaWGVdoHkaAqzBFl5P8k6jWyY+/2yLIhF1sw=',
  'Your First Name',                                                          -- <-- edit
  'Your Last Name',                                                           -- <-- edit
  1,                                                                          -- 1 = admin, 0 = regular user
  'AP-0001',
  1,                                                                          -- must_change_password
  datetime('now')
);

-- Row 2 — copy this block for each additional person, change id/email/name/admin.
-- insert into users (id, email, username, password_hash, first_name, last_name, is_admin, account_number, must_change_password, created_at)
-- values (
--   'u2',
--   'someone-else@example.com',
--   null,
--   'pbkdf2$100000$T2XVHC8xxQJLhddq1jLLEQ==$YIWLZ1kZaWGVdoHkaAqzBFl5P8k6jWyY+/2yLIhF1sw=',
--   'Their First Name',
--   'Their Last Name',
--   0,
--   'AP-0002',
--   1,
--   datetime('now')
-- );
