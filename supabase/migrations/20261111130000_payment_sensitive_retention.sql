-- Sprint 05: minimum retention for encrypted provider tokens (PLAN 6: "retención mínima documentada").
-- Only the sensitive MATERIAL is purged (checkout/callback token ciphertext + key id). Hashes, Flow identities, references, amounts and events are kept.
-- Purged: (a) checkout material of attempts in a FINAL technical state (paid/failed/cancelled) not touched for `retention_days`;
--         (b) callback material of inbox rows that are fully processed (state 'done', every received generation processed) and quiet for `retention_days`.
-- Never purged: pending/creating/reconciliation_required attempts (the customer can still reopen the checkout), prepared attempts, quarantined or
-- unprocessed inbox rows (they need investigation or are still to be processed). A replay of a purged callback token restores its material from the new request.
alter table private.payment_inbox alter column token_ciphertext drop not null, alter column key_id drop not null;
alter table private.payment_inbox add constraint payment_inbox_material_check check((token_ciphertext is null)=(key_id is null));

create or replace function public.payment_inbox_receive(token_hash text,ciphertext bytea,key_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid;
begin
 perform private.require_service_role();
 insert into private.payment_inbox(token_sha256,token_ciphertext,key_id)values(token_hash,ciphertext,key_id)
 on conflict(token_sha256)do update set generation=private.payment_inbox.generation+1,last_received_at=now(),
  token_ciphertext=coalesce(private.payment_inbox.token_ciphertext,excluded.token_ciphertext),key_id=coalesce(private.payment_inbox.key_id,excluded.key_id),
  state=case when private.payment_inbox.state in('quarantined','processing') then private.payment_inbox.state else 'pending' end,
  next_attempt_at=case when private.payment_inbox.state='processing' then private.payment_inbox.next_attempt_at else now() end
 returning id into result;
 return result;
end; $$;

create function public.payment_purge_sensitive(retention_days integer default 30)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare cutoff timestamptz; attempts_purged integer; inbox_purged integer;
begin
 perform private.require_service_role();
 if retention_days is null or retention_days not between 0 and 3650 then raise exception 'Retención inválida' using errcode='22023'; end if;
 cutoff:=now()-make_interval(days=>retention_days);
 with gone as(update private.payment_attempts set checkout_ciphertext=null,checkout_key_id=null
  where state in('paid','failed','cancelled') and checkout_ciphertext is not null and updated_at<=cutoff returning 1)
 select count(*)::integer into attempts_purged from gone;
 with gone as(update private.payment_inbox set token_ciphertext=null,key_id=null
  where state='done' and processed_generation>=generation and token_ciphertext is not null and last_received_at<=cutoff returning 1)
 select count(*)::integer into inbox_purged from gone;
 return jsonb_build_object('attempts',attempts_purged,'inbox',inbox_purged,'retention_days',retention_days);
end; $$;

revoke all on function public.payment_purge_sensitive(integer)from public,anon,authenticated;
grant execute on function public.payment_purge_sensitive(integer)to service_role;
