-- Run this once in Supabase SQL Editor for the shared bento order calendar.
create table if not exists public.order_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.order_group_members (
  group_id uuid not null references public.order_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.order_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  delivery_date date not null,
  delivery_time time not null,
  store text not null default '',
  product text not null default '',
  count text not null default '',
  tea text not null default '',
  packing text not null default '',
  bags text not null default '',
  trash_bag text not null default '',
  allergy text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists orders_group_date_idx on public.orders(group_id, delivery_date);

create or replace function public.is_order_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.create_order_group(p_name text)
returns table(group_id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_code text;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  insert into public.order_groups(name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'お弁当注文'), replace(gen_random_uuid()::text, '-', ''), auth.uid())
  returning id, order_groups.invite_code into new_id, new_code;
  insert into public.order_group_members(group_id, user_id) values (new_id, auth.uid());
  return query select new_id, new_code;
end;
$$;

create or replace function public.join_order_group(p_invite_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  select g.id into target_id from public.order_groups g
  where g.invite_code = lower(trim(p_invite_code));
  if target_id is null then raise exception '共有コードが見つかりません'; end if;
  insert into public.order_group_members(group_id, user_id)
  values (target_id, auth.uid()) on conflict do nothing;
  return target_id;
end;
$$;

alter table public.order_groups enable row level security;
alter table public.order_group_members enable row level security;
alter table public.orders enable row level security;

drop policy if exists order_groups_member_read on public.order_groups;
create policy order_groups_member_read on public.order_groups
  for select to authenticated using (public.is_order_group_member(id));

drop policy if exists group_members_read on public.order_group_members;
create policy group_members_read on public.order_group_members
  for select to authenticated using (user_id = auth.uid() or public.is_order_group_member(group_id));

drop policy if exists orders_member_read on public.orders;
create policy orders_member_read on public.orders
  for select to authenticated using (public.is_order_group_member(group_id));
drop policy if exists orders_member_insert on public.orders;
create policy orders_member_insert on public.orders
  for insert to authenticated with check (public.is_order_group_member(group_id) and created_by = auth.uid());
drop policy if exists orders_member_update on public.orders;
create policy orders_member_update on public.orders
  for update to authenticated using (public.is_order_group_member(group_id))
  with check (public.is_order_group_member(group_id));
drop policy if exists orders_member_delete on public.orders;
create policy orders_member_delete on public.orders
  for delete to authenticated using (public.is_order_group_member(group_id));

revoke all on public.order_groups, public.order_group_members, public.orders from anon;
grant select on public.order_groups, public.order_group_members to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
revoke all on function public.is_order_group_member(uuid) from public, anon;
grant execute on function public.is_order_group_member(uuid) to authenticated;
revoke all on function public.create_order_group(text) from public, anon;
grant execute on function public.create_order_group(text) to authenticated;
revoke all on function public.join_order_group(text) from public, anon;
grant execute on function public.join_order_group(text) to authenticated;

