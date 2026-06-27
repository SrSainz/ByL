create extension if not exists "pgcrypto";

update public.profiles set role = 'admin' where role = 'premium';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('basic', 'admin'));

create or replace function public.is_premium_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'admin';
$$;

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

create index if not exists idx_incident_zones_zona_id on public.incident_zones(zona_id);
create index if not exists idx_incident_attachments_incident_id on public.incident_attachments(incident_id);
create index if not exists idx_incident_attachments_uploaded_by on public.incident_attachments(uploaded_by);
create index if not exists idx_invoice_extractions_attachment_id on public.invoice_extractions(attachment_id);

alter table public.incident_zones enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.invoice_extractions enable row level security;

drop policy if exists "incident zones read by incident access" on public.incident_zones;
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

drop policy if exists "incident zones insert by incident access" on public.incident_zones;
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

drop policy if exists "incident zones delete by incident access" on public.incident_zones;
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

drop policy if exists "attachments read by incident access" on public.incident_attachments;
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

drop policy if exists "attachments insert own" on public.incident_attachments;
create policy "attachments insert own"
on public.incident_attachments for insert
to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists "attachments update by incident access" on public.incident_attachments;
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

drop policy if exists "extractions read by attachment access" on public.invoice_extractions;
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

drop policy if exists "extractions insert own attachment" on public.invoice_extractions;
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

drop policy if exists "extractions update own attachment" on public.invoice_extractions;
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
