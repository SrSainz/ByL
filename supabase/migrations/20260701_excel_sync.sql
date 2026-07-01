alter table public.incidents
  add column if not exists categoria text,
  add column if not exists numero_factura text,
  add column if not exists fecha_factura text,
  add column if not exists importe_neto numeric(12,2),
  add column if not exists iva_factura numeric(12,2),
  add column if not exists observaciones text,
  add column if not exists excel_sync_key text,
  add column if not exists excel_last_synced_at timestamptz;

create unique index if not exists idx_incidents_excel_sync_key
on public.incidents(excel_sync_key)
where excel_sync_key is not null;

create index if not exists idx_incidents_numero_factura on public.incidents(numero_factura);
create index if not exists idx_incidents_fecha_factura on public.incidents(fecha_factura);
create index if not exists idx_incidents_categoria on public.incidents(categoria);

create table if not exists public.excel_imports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  rows_total integer not null default 0,
  rows_created integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  urgent_count integer not null default 0,
  saved boolean not null default true,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_excel_imports_uploaded_by on public.excel_imports(uploaded_by);
create index if not exists idx_excel_imports_created_at on public.excel_imports(created_at desc);

grant select, insert, update, delete on public.excel_imports to authenticated;
grant select, insert, update, delete on public.excel_imports to service_role;

alter table public.excel_imports enable row level security;

drop policy if exists "excel imports admin manage" on public.excel_imports;
create policy "excel imports admin manage"
on public.excel_imports for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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
      new.categoria := null;
      new.numero_factura := null;
      new.fecha_factura := null;
      new.importe_neto := null;
      new.iva_factura := null;
      new.importe_factura := null;
      new.observaciones := null;
      new.excel_sync_key := null;
      new.excel_last_synced_at := null;
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
        or new.categoria is distinct from old.categoria
        or new.numero_factura is distinct from old.numero_factura
        or new.fecha_factura is distinct from old.fecha_factura
        or new.importe_neto is distinct from old.importe_neto
        or new.iva_factura is distinct from old.iva_factura
        or new.importe_factura is distinct from old.importe_factura
        or new.observaciones is distinct from old.observaciones
        or new.excel_sync_key is distinct from old.excel_sync_key
        or new.excel_last_synced_at is distinct from old.excel_last_synced_at
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

revoke execute on function public.validate_incident_permissions() from public, anon, authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.incidents; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.incident_zones; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.incident_attachments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.invoice_extractions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.locals; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.zones; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.responsables_aviso; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.providers; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.priorities; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.statuses; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.custom_list_groups; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.custom_list_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.excel_imports; exception when duplicate_object then null; end;
end $$;
