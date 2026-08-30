-- Perfect Match™ needs a lease-length signal on the property side to match
-- against tenants.lease_pref_months — properties didn't carry one before.
alter table properties add column if not exists lease_term_months int not null default 12;
