-- Sprint 05 (found by the first REAL Flow Sandbox call): Flow rejects a commerceOrder longer than 45 characters
-- ({"code":1622,"message":"The commerceOrder can not be longer than 45 characters"}); our reference `fixo-sandbox-<uuid>` has 49.
-- New attempts use `fixo-sbx-<32 hex>` (41 characters). A legacy-format reference is only tolerated on an already FAILED attempt (history of a
-- creation Flow refused before any Flow identity existed); it can never be created again.
alter table private.payment_attempts drop constraint if exists payment_attempts_commerce_order_check;
alter table private.payment_attempts add constraint payment_attempts_commerce_order_check
 check(commerce_order ~ '^fixo-sbx-[0-9a-f]{32}$' or (state='failed' and commerce_order ~ '^fixo-sandbox-[0-9a-f-]{36}$'));

do $$ declare src text; begin
 select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='payment_prepare';
 if position('''fixo-sandbox-''||a.id' in src)=0 then raise exception 'payment_prepare inesperado'; end if;
 src:=replace(src,'''fixo-sandbox-''||a.id','''fixo-sbx-''||replace(a.id::text,''-'','''')');
 if position('fixo-sbx-' in src)=0 or position('fixo-sandbox-' in src)>0 then raise exception 'No se pudo extender payment_prepare'; end if;
 execute src;
end $$;
