-- Sprint 05 — Supabase Cron executor for the Flow payments worker (NOT a migration: it enables extensions and a schedule, so it is applied
-- explicitly, per environment, only after the owner approves it. See docs/production/SPRINT_05_FLOW_SANDBOX_RUNBOOK.md §3).
--
-- What it does: every minute pg_cron calls private.payment_worker_tick(), which POSTs (pg_net) to the protected Vercel endpoint
-- /api/payments/worker with `Authorization: Bearer <secret>`. The endpoint runs ONE bounded pass of the existing worker (inbox, reconciliation,
-- housekeeping). All idempotency, retries, leases and fencing live in the database/worker; a missed, repeated or overlapping tick is harmless.
--
-- Prerequisite (value supplied out of band, never in this file or in Git):
--   select vault.create_secret('<https origin>/api/payments/worker','fixo_payments_worker_url','Flow payments worker endpoint');
--   select vault.create_secret('<FIXO_PAYMENTS_WORKER_SECRET>','fixo_payments_worker_secret','Flow payments worker bearer secret');
-- The secret therefore lives only in Supabase Vault (encrypted) and in the Vercel environment; the cron command text contains no secret.
-- Idempotent: safe to re-run.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One row per request so health can be derived from pg_net's (short-lived) response table without trusting it for history.
create table if not exists private.payment_worker_ticks(
 request_id bigint primary key,
 requested_at timestamptz not null default now()
);
alter table private.payment_worker_ticks enable row level security;
revoke all on private.payment_worker_ticks from public,anon,authenticated,service_role;

create or replace function private.payment_worker_tick()
returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare target text; secret text; req bigint;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='fixo_payments_worker_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='fixo_payments_worker_secret';
 -- Fail closed and quietly: a missing/odd configuration sends nothing (the secret is never echoed).
 if target is null or secret is null or length(secret)<32
  or target !~ '^(https://[a-z0-9.-]+|http://(localhost|127\.0\.0\.1|host\.docker\.internal)(:[0-9]{2,5})?)/api/payments/worker$' then
  raise warning 'payments worker tick skipped: endpoint or secret not configured';
  return null;
 end if;
 select net.http_post(url:=target,
  headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||secret),
  body:='{}'::jsonb, timeout_milliseconds:=25000) into req;
 insert into private.payment_worker_ticks(request_id)values(req)on conflict do nothing;
 delete from private.payment_worker_ticks where requested_at<now()-interval '2 days';
 return req;
end; $$;

-- Operator view (counters only; the endpoint never returns provider data). `degraded` = the last 5 requests did not all succeed.
create or replace function private.payment_worker_health()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare last_req record; summary jsonb; recent record;
begin
 select t.requested_at,t.request_id,r.status_code,r.timed_out,left(r.error_msg,200) error_msg,r.content,r.content_type into last_req
  from private.payment_worker_ticks t left join net._http_response r on r.id=t.request_id order by t.requested_at desc limit 1;
 begin summary:=case when last_req.status_code=200 and last_req.content_type like 'application/json%' then last_req.content::jsonb end; exception when others then summary:=null; end;
 select count(*) filter(where r.status_code=200) ok,count(*) filter(where r.id is not null and r.status_code is distinct from 200) failed,
  count(*) filter(where r.id is null and t.requested_at<now()-interval '2 minutes') unanswered,count(*) total into recent
  from(select * from private.payment_worker_ticks where requested_at>now()-interval '15 minutes' order by requested_at desc)t left join net._http_response r on r.id=t.request_id;
 return jsonb_build_object('scheduled',exists(select 1 from cron.job where jobname='fixo-payments-worker' and active),
  'last_request_at',last_req.requested_at,'last_status',last_req.status_code,'last_timed_out',last_req.timed_out,'last_error',last_req.error_msg,'last_summary',summary,
  'requests_15m',recent.total,'ok_15m',recent.ok,'failed_15m',recent.failed,'unanswered_15m',recent.unanswered,
  'degraded',(select count(*) filter(where r.status_code is distinct from 200)>0 from(select * from private.payment_worker_ticks order by requested_at desc limit 5)t left join net._http_response r on r.id=t.request_id));
end; $$;
revoke all on function private.payment_worker_tick(),private.payment_worker_health()from public,anon,authenticated,service_role;

-- Schedule: every minute (the minimum for the standard cron syntax). Re-running replaces the job of the same name.
select cron.schedule('fixo-payments-worker','* * * * *','select private.payment_worker_tick()');
