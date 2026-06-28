alter table public.incidents
add column if not exists importe_factura numeric(12,2);

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
      new.importe_factura := null;
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
        or new.importe_factura is distinct from old.importe_factura
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
