with seed(name) as (
  values
    ('Alegra - Sanse MAD'),
    ('Alfafar - Valencia'),
    ('Anecblau - Cateldefels'),
    ('Aqua - Valencia'),
    ('Bonaire - Valencia'),
    ('Bravo Murillo - MAD'),
    ('Burratina. Nassica. Getafe'),
    ('Diagonal Mar - Barcelona'),
    ('Dos Mares - San Javi Murcia'),
    ('Finestrelles - Espl. Llobre'),
    ('Garbera - San Sebastian'),
    ('Gran Plaza II - Majada. MAD'),
    ('Gran Plaza Shopping - Roque'),
    ('Gran Vía II - Barcelona'),
    ('Isla Azul - MAD'),
    ('La Cañada Shopping - Marbel'),
    ('La Fraga - Barcelona'),
    ('La Gavia - MAD'),
    ('La Vaguada - MAD'),
    ('Magic - Badalona'),
    ('Maquinista - Barcelona'),
    ('Max Center - Bilbao'),
    ('Mediterráneo Shopping - Alm'),
    ('Mena - MAD'),
    ('Nassica - Getafe MAD'),
    ('Nevada Shopping - Granada'),
    ('Oasiz - Torrejón MAD'),
    ('Parc Valles - Terrasa'),
    ('Parque Corrdor - Torrej MAD'),
    ('Parque Principado - Asturias'),
    ('Parque Sur - Leganés MAD'),
    ('Paseo del Mar - Torrevieja'),
    ('Plaza Mayor - MAD'),
    ('Plaza Norte II - Sanse MAD'),
    ('Plaza Rio II - MAD'),
    ('Plenilunio - MAD'),
    ('Puerto Venecia - Zaragoza'),
    ('Raw Açai Alberto Aguilera'),
    ('Raw Açai Narvaez - MAD'),
    ('Raw Açai Plaza Mayor - MAD'),
    ('Rio Shopping - Valladolid'),
    ('Tres Aguas - Alcorcón MAD'),
    ('Vialia - Vigo'),
    ('Xanadú - Arroyomolinos MAD')
)
insert into public.locals (name)
select seed.name
from seed
where not exists (
  select 1 from public.locals where lower(public.locals.name) = lower(seed.name)
);

with seed(name) as (
  values
    ('Almacén'),
    ('Baños personal'),
    ('Baños público'),
    ('Cámaras'),
    ('Cocina'),
    ('Sala')
)
insert into public.zones (name)
select seed.name
from seed
where not exists (
  select 1 from public.zones where lower(public.zones.name) = lower(seed.name)
);

with seed(name) as (
  values
    ('Ángel'),
    ('Bea'),
    ('Ismael'),
    ('Jaime'),
    ('Jesús'),
    ('Jordan'),
    ('María'),
    ('Miky'),
    ('Mónica'),
    ('Nelson'),
    ('Noelia'),
    ('Salvador'),
    ('Yolanda'),
    ('Younes')
)
insert into public.responsables_aviso (name)
select seed.name
from seed
where not exists (
  select 1 from public.responsables_aviso where lower(public.responsables_aviso.name) = lower(seed.name)
);

with seed(name) as (
  values
    ('ABANFOC'),
    ('ACEROS NAVARRO SL'),
    ('ACM Mantenimiento'),
    ('AGUA PUR'),
    ('AID'),
    ('ARLOS'),
    ('CALFIMAR'),
    ('CARLOS'),
    ('DIGILAB'),
    ('FERGO'),
    ('FRIO LOSAN'),
    ('GIDES'),
    ('JORGE'),
    ('MAMSAF'),
    ('OPENMATIC'),
    ('RECOLUX')
)
insert into public.providers (name)
select seed.name
from seed
where not exists (
  select 1 from public.providers where lower(public.providers.name) = lower(seed.name)
);

with seed(name, sort_order, color) as (
  values
    ('Muy alta', 45, '#b42318')
)
insert into public.priorities (name, sort_order, color)
select seed.name, seed.sort_order, seed.color
from seed
where not exists (
  select 1 from public.priorities where lower(public.priorities.name) = lower(seed.name)
);

with seed(name, sort_order, color) as (
  values
    ('Pendiente', 80, '#b24000'),
    ('En curso', 90, '#4f46e5'),
    ('Completado', 100, '#16754f')
)
insert into public.statuses (name, sort_order, color)
select seed.name, seed.sort_order, seed.color
from seed
where not exists (
  select 1 from public.statuses where lower(public.statuses.name) = lower(seed.name)
);
