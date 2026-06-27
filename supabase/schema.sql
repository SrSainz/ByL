create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'basic' check (role in ('basic', 'admin')),
  active boolean not null default true,
  provided_password text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  local_id uuid references public.locals(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.responsables_aviso (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.priorities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  fecha_incidencia text not null,
  local_id uuid not null references public.locals(id),
  zona_id uuid not null references public.zones(id),
  descripcion text not null,
  responsable_aviso_id uuid not null references public.responsables_aviso(id),
  proveedor_id uuid references public.providers(id),
  prioridad_id uuid references public.priorities(id),
  fecha_resolucion text,
  estado_id uuid references public.statuses(id),
  created_by uuid not null references public.profiles(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  title text not null,
  message text not null,
  "read" boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  change_type text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_zones (
  incident_id uuid not null references public.incidents(id) on delete cascade,
  zona_id uuid not null references public.zones(id),
  created_at timestamptz not null default now(),
  primary key (incident_id, zona_id)
);

create table if not exists public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  status text not null default 'pending' check (status in ('pending', 'linked', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_extractions (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null unique references public.incident_attachments(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  raw_text text,
  parsed_data jsonb not null default '{}'::jsonb,
  confidence numeric(5,2),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incidents_created_by on public.incidents(created_by);
create index if not exists idx_incidents_status on public.incidents(estado_id);
create index if not exists idx_incidents_priority on public.incidents(prioridad_id);
create index if not exists idx_incidents_created_at on public.incidents(created_at desc);
create index if not exists idx_incidents_local_id on public.incidents(local_id);
create index if not exists idx_incidents_zona_id on public.incidents(zona_id);
create index if not exists idx_incidents_responsable_aviso_id on public.incidents(responsable_aviso_id);
create index if not exists idx_incidents_proveedor_id on public.incidents(proveedor_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, "read");
create index if not exists idx_notifications_incident_id on public.notifications(incident_id);
create index if not exists idx_zones_local_id on public.zones(local_id);
create index if not exists idx_incident_history_incident_id on public.incident_history(incident_id);
create index if not exists idx_incident_history_changed_by on public.incident_history(changed_by);
create index if not exists idx_incident_zones_zona_id on public.incident_zones(zona_id);
create index if not exists idx_incident_attachments_incident_id on public.incident_attachments(incident_id);
create index if not exists idx_incident_attachments_uploaded_by on public.incident_attachments(uploaded_by);
create index if not exists idx_invoice_extractions_attachment_id on public.invoice_extractions(attachment_id);

update public.profiles set role = 'admin' where role = 'premium';

do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check check (role in ('basic', 'admin'));
end $$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'admin';
$$;

create or replace function public.is_premium_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'admin';
$$;

create or replace function public.status_id_by_name(status_name text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.statuses where name = status_name limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'basic',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.validate_incident_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := public.current_profile_role();
  nueva_id uuid := public.status_id_by_name('Nueva');
  old_status_name text;
begin
  if user_role is null then
    raise exception 'Usuario no autenticado o inactivo';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by <> auth.uid() then
      raise exception 'created_by debe ser el usuario autenticado';
    end if;

    if user_role = 'basic' then
      new.proveedor_id := null;
      new.prioridad_id := null;
      new.fecha_resolucion := null;
      new.estado_id := nueva_id;
    end if;

    if new.estado_id is null then
      new.estado_id := nueva_id;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if user_role = 'basic' then
      select name into old_status_name from public.statuses where id = old.estado_id;

      if old.created_by <> auth.uid() or old_status_name <> 'Nueva' then
        raise exception 'Un basic solo puede editar sus incidencias en estado Nueva';
      end if;

      if new.proveedor_id is distinct from old.proveedor_id
        or new.prioridad_id is distinct from old.prioridad_id
        or new.fecha_resolucion is distinct from old.fecha_resolucion
        or new.estado_id is distinct from old.estado_id
        or new.archived is distinct from old.archived then
        raise exception 'Un basic no puede editar campos de administrador';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' and user_role <> 'admin' then
    raise exception 'Solo admin puede borrar incidencias';
  end if;

  return old;
end;
$$;

drop trigger if exists validate_incident_permissions_trigger on public.incidents;
create trigger validate_incident_permissions_trigger
before insert or update or delete on public.incidents
for each row execute function public.validate_incident_permissions();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_incidents_updated_at on public.incidents;
create trigger set_incidents_updated_at
before update on public.incidents
for each row execute function public.set_updated_at();

create or replace function public.notify_basic_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_role text;
  recipient record;
begin
  select role into creator_role from public.profiles where id = new.created_by;

  if creator_role = 'basic' then
    for recipient in
      select id from public.profiles where active = true and role = 'admin'
    loop
      insert into public.notifications (user_id, incident_id, title, message)
      values (
        recipient.id,
        new.id,
        'Nueva incidencia basic',
        'Un usuario basic ha creado una incidencia: ' || left(new.descripcion, 140)
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_basic_incident_trigger on public.incidents;
create trigger notify_basic_incident_trigger
after insert on public.incidents
for each row execute function public.notify_basic_incident();

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
    values (old.id, auth.uid(), 'deleted', to_jsonb(old));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists audit_incident_changes_trigger on public.incidents;
create trigger audit_incident_changes_trigger
after insert or update or delete on public.incidents
for each row execute function public.audit_incident_changes();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_incident_permissions() from public, anon, authenticated;
revoke execute on function public.notify_basic_incident() from public, anon, authenticated;
revoke execute on function public.audit_incident_changes() from public, anon, authenticated;
revoke execute on function public.status_id_by_name(text) from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.locals enable row level security;
alter table public.zones enable row level security;
alter table public.responsables_aviso enable row level security;
alter table public.providers enable row level security;
alter table public.priorities enable row level security;
alter table public.statuses enable row level security;
alter table public.notifications enable row level security;
alter table public.incident_history enable row level security;
alter table public.incident_zones enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.invoice_extractions enable row level security;

create policy "profiles read own or elevated"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_premium_or_admin());

create policy "profiles admin manage"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "incidents read by role"
on public.incidents for select
to authenticated
using (public.is_premium_or_admin() or created_by = auth.uid());

create policy "incidents insert authenticated"
on public.incidents for insert
to authenticated
with check (created_by = auth.uid());

create policy "incidents update by role"
on public.incidents for update
to authenticated
using (public.is_premium_or_admin() or created_by = auth.uid())
with check (public.is_premium_or_admin() or created_by = auth.uid());

create policy "incidents admin delete"
on public.incidents for delete
to authenticated
using (public.is_admin());

create policy "notifications read own"
on public.notifications for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notifications update own"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "incident history read by incident access"
on public.incident_history for select
to authenticated
using (
  public.is_premium_or_admin()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_history.incident_id
    and incidents.created_by = auth.uid()
  )
);

create policy "incident zones read by incident access"
on public.incident_zones for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_zones.incident_id
    and incidents.created_by = auth.uid()
  )
);

create policy "incident zones insert by incident access"
on public.incident_zones for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_zones.incident_id
    and incidents.created_by = auth.uid()
  )
);

create policy "incident zones update by admin"
on public.incident_zones for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "incident zones delete by incident access"
on public.incident_zones for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_zones.incident_id
    and incidents.created_by = auth.uid()
  )
);

create policy "attachments read by incident access"
on public.incident_attachments for select
to authenticated
using (
  public.is_admin()
  or uploaded_by = auth.uid()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_attachments.incident_id
    and incidents.created_by = auth.uid()
  )
);

create policy "attachments insert own"
on public.incident_attachments for insert
to authenticated
with check (uploaded_by = auth.uid());

create policy "attachments update by incident access"
on public.incident_attachments for update
to authenticated
using (
  public.is_admin()
  or uploaded_by = auth.uid()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_attachments.incident_id
    and incidents.created_by = auth.uid()
  )
)
with check (
  public.is_admin()
  or uploaded_by = auth.uid()
  or exists (
    select 1 from public.incidents
    where incidents.id = incident_attachments.incident_id
    and incidents.created_by = auth.uid()
  )
);

create policy "extractions read by attachment access"
on public.invoice_extractions for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.incident_attachments attachments
    left join public.incidents incidents on incidents.id = attachments.incident_id
    where attachments.id = invoice_extractions.attachment_id
      and (attachments.uploaded_by = auth.uid() or incidents.created_by = auth.uid())
  )
);

create policy "extractions insert own attachment"
on public.invoice_extractions for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.incident_attachments attachments
    where attachments.id = invoice_extractions.attachment_id
    and attachments.uploaded_by = auth.uid()
  )
);

create policy "extractions update own attachment"
on public.invoice_extractions for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.incident_attachments attachments
    where attachments.id = invoice_extractions.attachment_id
    and attachments.uploaded_by = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.incident_attachments attachments
    where attachments.id = invoice_extractions.attachment_id
    and attachments.uploaded_by = auth.uid()
  )
);

insert into public.incident_zones (incident_id, zona_id)
select id, zona_id from public.incidents
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incident-invoices', 'incident-invoices', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "incident invoice files own folder insert" on storage.objects;
create policy "incident invoice files own folder insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'incident-invoices'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "incident invoice files own folder read" on storage.objects;
create policy "incident invoice files own folder read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'incident-invoices'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "lookup read active or admin locals"
on public.locals for select to authenticated using (active = true or public.is_admin());
create policy "lookup admin manage locals"
on public.locals for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lookup read active or admin zones"
on public.zones for select to authenticated using (active = true or public.is_admin());
create policy "lookup admin manage zones"
on public.zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lookup read active or admin responsables"
on public.responsables_aviso for select to authenticated using (active = true or public.is_admin());
create policy "lookup admin manage responsables"
on public.responsables_aviso for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lookup read active or admin providers"
on public.providers for select to authenticated using (active = true or public.is_admin());
create policy "lookup admin manage providers"
on public.providers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lookup read active or admin priorities"
on public.priorities for select to authenticated using (active = true or public.is_admin());
create policy "lookup admin manage priorities"
on public.priorities for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lookup read active or admin statuses"
on public.statuses for select to authenticated using (active = true or public.is_admin());
create policy "lookup admin manage statuses"
on public.statuses for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.locals (name)
select U&'PENDIENTE_DE_A\00D1ADIR'
where not exists (select 1 from public.locals where name = U&'PENDIENTE_DE_A\00D1ADIR');

insert into public.zones (name)
select U&'PENDIENTE_DE_A\00D1ADIR'
where not exists (select 1 from public.zones where name = U&'PENDIENTE_DE_A\00D1ADIR');

insert into public.responsables_aviso (name)
select U&'PENDIENTE_DE_A\00D1ADIR'
where not exists (select 1 from public.responsables_aviso where name = U&'PENDIENTE_DE_A\00D1ADIR');

insert into public.providers (name)
select U&'PENDIENTE_DE_A\00D1ADIR'
where not exists (select 1 from public.providers where name = U&'PENDIENTE_DE_A\00D1ADIR');

insert into public.priorities (name, sort_order)
select value, sort_order
from (values ('Baja', 10), ('Media', 20), ('Alta', 30), ('Urgente', 40)) as seed(value, sort_order)
where not exists (select 1 from public.priorities where priorities.name = seed.value);

update public.priorities set color = '#6c665c' where name = 'Baja' and color is null;
update public.priorities set color = '#2563eb' where name = 'Media' and color is null;
update public.priorities set color = '#b24000' where name = 'Alta' and color is null;
update public.priorities set color = '#b42318' where name = 'Urgente' and color is null;

insert into public.statuses (name, sort_order)
select value, sort_order
from (
  values
    ('Nueva', 10),
    (U&'En revisi\00F3n', 20),
    ('Asignada', 30),
    ('En proceso', 40),
    ('Resuelta', 50),
    ('Cerrada', 60),
    ('Cancelada', 70)
) as seed(value, sort_order)
where not exists (select 1 from public.statuses where statuses.name = seed.value);

update public.statuses set color = '#2563eb' where name = 'Nueva' and color is null;
update public.statuses set color = '#b24000' where name = U&'En revisi\00F3n' and color is null;
update public.statuses set color = '#0e7490' where name = 'Asignada' and color is null;
update public.statuses set color = '#4f46e5' where name = 'En proceso' and color is null;
update public.statuses set color = '#16754f' where name = 'Resuelta' and color is null;
update public.statuses set color = '#171717' where name = 'Cerrada' and color is null;
update public.statuses set color = '#b42318' where name = 'Cancelada' and color is null;
