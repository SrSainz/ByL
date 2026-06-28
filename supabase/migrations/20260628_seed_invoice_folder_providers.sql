with seed(name) as (
  values
    ('COMERCIAL FRIOLOSAN'),
    ('CUBAS TOT'),
    ('CUBAS TOT NET'),
    ('DESATASCOS HENARES'),
    ('EDIFICA'),
    ('EUNASA'),
    ('FERRETERIA GABAN'),
    ('GEORGI PAVLINOV ANDREEV'),
    ('INOXNAVARRO'),
    ('KEMIKAL'),
    ('NERO VITAL TEC'),
    ('OB CONSULTORIA DE RESIDUS'),
    ('RENTAVISION'),
    ('SERVITEL'),
    ('WOLTER KLUWER')
)
insert into public.providers (name)
select seed.name
from seed
where not exists (
  select 1 from public.providers where lower(public.providers.name) = lower(seed.name)
);
