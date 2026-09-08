-- Adds the one thing a source needs for an automated (rather than
-- admin-triggered) sync to have anything to do: a URL its connector can pull
-- fresh data from on a schedule. The csv_upload connector is push-based by
-- default (an admin manually supplies the file) — this column is what lets a
-- source instead point at a stable HTTPS URL it has permission to fetch a CSV
-- export from (e.g. a nightly export a property manager publishes), so
-- scheduled sync has real new data to pull each run rather than replaying
-- whatever was last manually uploaded.
--
-- Left null, a source keeps working exactly as before (manual upload only) —
-- see 0019_rental_sync_scheduling.sql for the cron job that only ever
-- considers sources where this is set.

alter table rental_sources add column feed_url text;
