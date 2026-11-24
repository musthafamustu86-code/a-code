-- A form may legitimately run twice on the same date (for example two
-- sessions), and a repeated submission for the same class set must not be
-- rejected. The key table only guarded against duplicates, so remove its
-- primary key instead of blocking the second submission.
alter table private.attendance_keys
  drop constraint if exists attendance_keys_pkey;
