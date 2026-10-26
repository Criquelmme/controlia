# Pruebas

## Pruebas sin servicios externos

```sh
npm test
npm run typecheck
npm run build
```

Incluyen escenarios de negocio para reservas, entregas parciales, devoluciones y reembolsos, además de pruebas del SQL en PostgreSQL/PGlite: migración válida, RLS, lectura por propietario, denegación anónima, bloqueo de escrituras directas, control de versión, propietario inmutable y datos inválidos. PGlite reemplaza únicamente la infraestructura de prueba; la aplicación utiliza Supabase.

## Integración de Supabase en entorno desechable

No requiere claves reales. En una terminal:

```sh
node tests/helpers/mock-supabase.mjs
```

En otra terminal PowerShell, sin una `.dev.vars` de producción:

```powershell
$env:APP_BACKEND='supabase'
$env:APP_URL='http://127.0.0.1:5173'
$env:SUPABASE_URL='http://127.0.0.1:54331'
$env:SUPABASE_PUBLISHABLE_KEY='local-public-test-key'
$env:SUPABASE_SECRET_KEY='local-secret-test-key'
node scripts/run-framework.mjs dev
```

Si el runtime de tu plataforma no hereda esas variables, escríbelas solo en una `.dev.vars` local temporal y elimínala después. No sustituyas una configuración real sin conservarla antes. Cuando la vista previa responda en `http://127.0.0.1:5173`, ejecuta en otra terminal:

```sh
npm run test:supabase-api
```

El fixture HTTP simula Auth y PostgREST y ejecuta las consultas sobre PostgreSQL/PGlite con la migración real. Comprueba login, cookies persistentes HttpOnly, renovación, creación de usuarios compartidos y denegación a colaboradores para administrar usuarios, datos aislados, escrituras concurrentes, entregas, pagos y logout. Es un fixture, no sustituye una verificación final contra tu proyecto alojado de Supabase.

Solo para inspección manual de este fixture, el usuario es `owner@example.test` y la contraseña es `local-password-only`. No son credenciales de producción. El fixture solo escucha en loopback, no se utiliza desde la aplicación desplegada y sus datos se descartan al detenerlo.

## Pruebas del modo anterior

`tests/api.test.mjs` y `tests/auth.test.mjs` se conservaron para `APP_BACKEND=sites`, con la base D1 local inicializada. No prueban el login Supabase. Sus resultados anteriores no deben confundirse con una conexión a un proyecto alojado de Supabase.
