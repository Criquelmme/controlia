-- Run through Supabase migrations or once in the SQL Editor of a NEW project.
-- Auth credentials are owned by Supabase auth.users, never by this table.
create table public.shops (
  owner uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint shop_data_shape check (
    jsonb_typeof(data) = 'object'
    and data ?& array['clients','variants','orders','supplies','movements','operations']
    and jsonb_typeof(data -> 'clients') = 'array'
    and jsonb_typeof(data -> 'variants') = 'array'
    and jsonb_typeof(data -> 'orders') = 'array'
    and jsonb_typeof(data -> 'supplies') = 'array'
    and jsonb_typeof(data -> 'movements') = 'array'
    and jsonb_typeof(data -> 'operations') = 'array'
  )
);

create function public.enforce_shop_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner <> old.owner then
    raise exception 'Shop owner is immutable' using errcode = '23514';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'Shop version must increase by one' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger shops_before_update
before update on public.shops
for each row execute function public.enforce_shop_version();

alter table public.shops enable row level security;
alter table public.shops force row level security;

revoke all on public.shops from public, anon, authenticated;
grant select on public.shops to authenticated;
grant select, insert, update, delete on public.shops to service_role;

create policy shop_owner_read
on public.shops for select
to authenticated
using ((select auth.uid()) = owner);

-- No authenticated write policies or grants: all business mutations pass through
-- the server, which verifies the session, validates rules and compares versions.
-- SUPABASE_SECRET_KEY is only used by that server; it must never reach a browser.
revoke all on function public.enforce_shop_version() from public, anon, authenticated;

comment on table public.shops is 'One atomic shop document per Supabase Auth owner. Only the application server writes business records.';
comment on column public.shops.data is 'Shop JSON: clients, variants, orders (lines and payment), supplies, movements and idempotency operations.';
