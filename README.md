# Gestion de incidencias ByL

Aplicacion web responsive tipo PWA para registrar y gestionar incidencias con Next.js App Router, React, TypeScript, Tailwind CSS, Supabase y despliegue preparado para Vercel.

## Funcionalidades

- Autenticacion con email y contrasena mediante Supabase Auth.
- Roles `basic` y `admin`.
- CRUD de incidencias con campos visibles y editables segun rol.
- Seleccion de una o varias zonas/areas por incidencia.
- Adjuntos de facturas PDF privadas, lectura automatica revisable y bandeja admin de facturas pendientes.
- RLS en PostgreSQL y validaciones de permisos en server actions.
- Notificaciones internas para `admin` cuando un `basic` crea una incidencia.
- Dashboard, filtros, exportacion CSV para admin y administracion de usuarios/listas.
- PWA instalable en Android y Windows con manifest y service worker basico.

## Instalacion local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

## Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=
OPENAI_INVOICE_MODEL=gpt-4.1-nano
OPENAI_INVOICE_MAX_OUTPUT_TOKENS=700
INVOICE_AI_PROVIDER=openai
INVOICE_AI_MAX_TEXT_CHARS=6000
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_INVOICE_MODEL=gemma-3-4b-it
INVOICE_IMPORT_USER_ID=
```

`SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor para operaciones admin y facturas privadas. No debe exponerse en el cliente.

`OPENAI_API_KEY` es opcional. Si existe, la lectura de facturas usa IA para extraer datos estructurados. Por defecto usa `gpt-4.1-nano`, limita el texto enviado con `INVOICE_AI_MAX_TEXT_CHARS` y limita salida con `OPENAI_INVOICE_MAX_OUTPUT_TOKENS` para contener coste. Si no existe, la app guarda el PDF y usa reglas simples sobre texto/nombre de archivo.

Para lectura local con LM Studio, arranca el servidor local compatible con OpenAI y usa:

```bash
INVOICE_AI_PROVIDER=lmstudio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_INVOICE_MODEL=gemma-3-4b-it
```

En Vercel se recomienda `INVOICE_AI_PROVIDER=openai`, porque Vercel no puede conectar con tu LM Studio local salvo que publiques ese servicio de forma segura.

## Configurar Supabase

1. Crea o abre tu proyecto de Supabase.
2. Ve a `SQL Editor`.
3. Ejecuta el contenido completo de `supabase/schema.sql`.
4. En `Authentication > Providers`, activa email/password.
5. En `Authentication > URL Configuration`, anade:
   - Local: `http://localhost:3000`
   - Produccion: la URL de Vercel
6. Copia `Project URL`, publishable/anon key y secret/service key a las variables de entorno.

El SQL crea tablas, indices, triggers, politicas RLS, bucket privado `incident-invoices` y datos iniciales.

## Crear el primer admin

1. Crea el usuario en Supabase Auth.
2. Ejecuta:

```sql
update public.profiles
set role = 'admin', active = true
where email = 'tu-email@dominio.com';
```

## Listas desplegables

Un usuario `admin` puede anadir, editar, activar o desactivar valores desde `Listas`.

- Locales
- Zonas
- Responsables del aviso
- Proveedores
- Prioridades con color
- Estados con color

Los valores inactivos dejan de aparecer en formularios normales.

## Facturas PDF

1. En `Incidencias`, adjunta un PDF en el bloque `Factura`.
2. Pulsa `Leer factura`.
3. La app sube el PDF al bucket privado, extrae texto y rellena sugerencias.
4. Revisa local, zonas, descripcion, proveedor, prioridad y estado.
5. Guarda la incidencia. La factura queda vinculada y se puede abrir desde el detalle con una URL firmada temporal.

Las facturas no son publicas. Se guardan en Supabase Storage privado y la app valida permisos antes de crear una URL temporal de descarga.

## Importar carpeta local de facturas

Vercel no puede leer carpetas de tu ordenador. Para importar los PDFs existentes de:

```text
C:\Users\alvar\Desktop\AIDA\Estudio LUART\ByL\MANTENIMIENTO
```

ejecuta primero una simulacion:

```bash
npm run import:invoices
```

Para subirlas como facturas pendientes necesitas poner en `.env.local` `INVOICE_IMPORT_USER_ID` con el `id` UUID de un usuario admin y ejecutar:

```bash
npm run import:invoices -- --upload
```

Despues entra como admin en `Facturas` para revisar o descartar documentos.

## Probar permisos

1. Crea dos usuarios: uno `basic` y uno `admin`.
2. Inicia sesion como `basic`:
   - Puede crear incidencias.
   - Puede adjuntar facturas y revisar datos detectados antes de guardar.
   - Solo ve sus incidencias.
   - Solo puede editar mientras el estado sea `Nueva`.
   - No ve proveedor, prioridad, fecha de resolucion ni controles admin.
3. Inicia sesion como `admin`:
   - Ve todas las incidencias.
   - Puede editar campos basicos y de seguimiento.
   - Recibe notificaciones cuando un `basic` crea una incidencia.
   - Puede gestionar usuarios y listas.
   - Puede archivar o borrar incidencias.
   - Puede revisar facturas pendientes.

Las reglas se aplican en UI, server actions, triggers y politicas RLS.

## Exportacion CSV

En `Incidencias`, aplica filtros y pulsa `Exportar CSV`.

- `basic` no ve el boton de exportacion.
- `admin` exporta todas las incidencias permitidas segun filtros.

## Despliegue en Vercel

1. Sube el repositorio a GitHub.
2. Crea o actualiza el proyecto en Vercel.
3. Configura variables de entorno en Development, Preview y Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app`
   - `OPENAI_API_KEY` si quieres lectura inteligente de facturas
   - `OPENAI_INVOICE_MODEL=gpt-4.1-nano`
   - `OPENAI_INVOICE_MAX_OUTPUT_TOKENS=700`
   - `INVOICE_AI_MAX_TEXT_CHARS=6000`
4. Despliega.
5. Anade la URL final en Supabase Auth URL Configuration.

## Comandos

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run import:invoices
npm run openai:costs -- --days=1
```
