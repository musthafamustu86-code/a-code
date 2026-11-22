create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('star-system-recognition','*/15 * * * *','select private.finalize_due_periods(null)');
