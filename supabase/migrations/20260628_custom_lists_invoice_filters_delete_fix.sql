create table if not exists public.custom_list_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_list_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.custom_list_groups(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_custom_list_groups_name_lower
on public.custom_list_groups (lower(name));

create unique index if not exists idx_custom_list_items_group_name_lower
on public.custom_list_items (group_id, lower(name));

create index if not exists idx_custom_list_items_group_id
on public.custom_list_items(group_id);

alter table public.custom_list_groups enable row level security;
alter table public.custom_list_items enable row level security;

drop trigger if exists set_custom_list_groups_updated_at on public.custom_list_groups;
create trigger set_custom_list_groups_updated_at
before update on public.custom_list_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_custom_list_items_updated_at on public.custom_list_items;
create trigger set_custom_list_items_updated_at
before update on public.custom_list_items
for each row execute function public.set_updated_at();

drop policy if exists "custom list groups read active or admin" on public.custom_list_groups;
create policy "custom list groups read active or admin"
on public.custom_list_groups for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "custom list groups admin manage" on public.custom_list_groups;
create policy "custom list groups admin manage"
on public.custom_list_groups for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "custom list items read active or admin" on public.custom_list_items;
create policy "custom list items read active or admin"
on public.custom_list_items for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "custom list items admin manage" on public.custom_list_items;
create policy "custom list items admin manage"
on public.custom_list_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.custom_list_groups (name, sort_order)
values (U&'Categor\00EDas', 10)
on conflict do nothing;

with category_group as (
  select id from public.custom_list_groups where lower(name) in (U&'categor\00EDas', 'categorias') order by created_at limit 1
),
seed(name, sort_order, color) as (
  values
    (U&'Fontaner\00EDa', 10, '#0e7490'),
    ('Electricidad', 20, '#b24000'),
    ('Maquinaria', 30, '#4f46e5'),
    (U&'Climatizaci\00F3n', 40, '#2563eb'),
    ('Gas', 50, '#b42318'),
    ('Recambios', 60, '#6c665c'),
    ('Obra', 70, '#171717'),
    ('Limpieza', 80, '#16754f'),
    ('General', 90, '#6c665c')
)
insert into public.custom_list_items (group_id, name, sort_order, color)
select category_group.id, seed.name, seed.sort_order, seed.color
from category_group, seed
where not exists (
  select 1
  from public.custom_list_items existing
  where existing.group_id = category_group.id
    and lower(existing.name) = lower(seed.name)
);

create or replace function public.audit_incident_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.incident_history (incident_id, changed_by, change_type, new_value)
    values (new.id, auth.uid(), 'created', to_jsonb(new));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.incident_history (incident_id, changed_by, change_type, old_value, new_value)
    values (new.id, auth.uid(), 'updated', to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.incident_history (incident_id, changed_by, change_type, old_value)
    values (
      null,
      auth.uid(),
      'deleted',
      jsonb_build_object('incident_id', old.id, 'datos', to_jsonb(old))
    );
    return old;
  end if;

  return null;
end;
$$;
