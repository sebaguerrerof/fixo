-- Sprint 05: persistent, shared rate limiting for payment endpoints (fixed windows in PostgreSQL; no in-memory counters).
-- Defence in depth only: idempotency keys and provider verification remain independent. Subjects are opaque hashes chosen by the server
-- (never a raw IP). Service role only; the table is private, RLS enabled, no direct grants.
create table private.payment_rate_limits(
 scope text not null check(scope in('checkout_user','callback_ip')),
 subject text not null check(length(subject) between 1 and 128),
 window_start timestamptz not null,
 hits integer not null default 0 check(hits>=0),
 primary key(scope,subject,window_start)
);
create index payment_rate_limits_window_idx on private.payment_rate_limits(window_start);
alter table private.payment_rate_limits enable row level security;
revoke all on private.payment_rate_limits from public,anon,authenticated,service_role;

-- Counts one hit and reports whether it is within the limit. A denied hit still counts, so a flood cannot reset by retrying.
create function public.payment_rate_limit_hit(limit_scope text,limit_subject text,max_hits integer,window_seconds integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare started timestamptz; n integer;
begin
 perform private.require_service_role();
 if limit_scope is null or limit_scope not in('checkout_user','callback_ip') or limit_subject is null or length(limit_subject) not between 1 and 128
  or max_hits is null or max_hits not between 1 and 10000 or window_seconds is null or window_seconds not between 1 and 86400 then
  raise exception 'Límite inválido' using errcode='22023'; end if;
 started:=to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);
 insert into private.payment_rate_limits as l(scope,subject,window_start,hits)values(limit_scope,limit_subject,started,1)
 on conflict(scope,subject,window_start)do update set hits=l.hits+1 returning hits into n;
 -- Opportunistic bounded cleanup when a new window opens; the explicit cleanup RPC covers quiet periods.
 if n=1 then delete from private.payment_rate_limits where ctid in(select ctid from private.payment_rate_limits where window_start<now()-interval '2 days' limit 500); end if;
 return jsonb_build_object('allowed',n<=max_hits,'hits',n,'retry_after_seconds',greatest(1,ceil(extract(epoch from(started+make_interval(secs=>window_seconds)-now())))::integer));
end; $$;

create function public.payment_rate_limit_cleanup()
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare removed integer;
begin
 perform private.require_service_role();
 with gone as(delete from private.payment_rate_limits where window_start<now()-interval '2 days' returning 1)select count(*)::integer into removed from gone;
 return removed;
end; $$;

revoke all on function public.payment_rate_limit_hit(text,text,integer,integer),public.payment_rate_limit_cleanup()from public,anon,authenticated;
grant execute on function public.payment_rate_limit_hit(text,text,integer,integer),public.payment_rate_limit_cleanup()to service_role;
