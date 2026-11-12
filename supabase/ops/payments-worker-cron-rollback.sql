-- Stops the Flow payments worker schedule. Does NOT drop the tick log, the functions, the extensions or the Vault secrets (reversible, no data loss).
-- Reverting a Sandbox enablement: turn off FIXO_PAYMENTS_CREATION_ENABLED first, keep this schedule running until every pending attempt/inbox row is resolved
-- (PLAN §11), then run this file.
select cron.unschedule(jobid) from cron.job where jobname='fixo-payments-worker';
-- Optional full cleanup (only after the above and with the owner's approval):
--   select vault.update_secret(id,'x'||repeat('0',40)) from vault.secrets where name='fixo_payments_worker_secret';  -- or delete the rows
--   drop function if exists private.payment_worker_tick(), private.payment_worker_health();
