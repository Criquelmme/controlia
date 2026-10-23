# Configurar Supabase

La aplicación usa por defecto **Supabase Auth con correo y contraseña** y PostgreSQL para los datos. La integración está implementada; este repositorio no contiene las credenciales de un proyecto alojado ni ejecuta cambios en tu cuenta de Supabase por sí solo.

## 1. Crear el proyecto y aplicar el esquema

1. Crea o selecciona un proyecto de Supabase.
2. En un proyecto nuevo, abre **SQL Editor** y ejecuta una vez el contenido de [`supabase/migrations/20261023000100_initial_shop.sql`](../supabase/migrations/20261023000100_initial_shop.sql).
3. Si usas Supabase CLI, vincula el proyecto con `supabase link --project-ref TU_PROJECT_REF` y aplica `supabase db push` en lugar de ejecutar manualmente la misma migración. No uses ambos métodos sin registrar la migración como aplicada.

El esquema documentado está en [DATABASE.md](DATABASE.md). Se conservó el documento atómico de tienda: una fila por propietario en `public.shops`, con `owner`, `version`, `data` y `updated_at`. Dentro de `data` están clientes, prendas, pedidos, pagos, encargos y movimientos. No se crearon tablas de clientes o pedidos desconectadas de la aplicación.

## 2. Configurar el acceso privado

En el Dashboard de Supabase:

- Habilita el proveedor de correo y contraseña en Authentication.
- Desactiva los registros públicos y el acceso anónimo para esta tienda de una administradora.
- Crea tu usuario desde **Authentication → Users → Add user**, usando tu correo y una contraseña propia de al menos 12 caracteres. Si se exige confirmación de correo, confirma la cuenta o usa el mecanismo administrativo de confirmación del Dashboard.
- En URL Configuration, establece Site URL como el origen HTTPS de la aplicación cuando esté publicada. Para desarrollo usa `http://127.0.0.1:5173`.

`supabase/config.toml` configura el entorno **local** de Supabase; no cambia automáticamente las opciones de un proyecto alojado. La app no ofrece registro público. Tampoco incluye un flujo de recuperación de contraseña en esta versión; la gestión inicial de usuarios se realiza desde el Dashboard.

## 3. Variables del servidor

Copia `.dev.vars.example` a `.dev.vars` para la vista previa Vinext/Cloudflare y completa los valores en tu equipo. Los archivos reales están ignorados por Git. En otro entorno de servidor puedes usar sus variables de entorno; `.env.example` documenta los mismos nombres.

```dotenv
APP_BACKEND=supabase
APP_URL=https://TU_DOMINIO
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
SUPABASE_SECRET_KEY=TU_CLAVE_SECRETA_DE_SERVIDOR
```

En desarrollo, `APP_URL=http://127.0.0.1:5173`. Se exige HTTPS fuera de loopback. Copia las claves del diálogo Connect / API Keys de Supabase. **No agregues valores reales a GitHub ni uses `NEXT_PUBLIC_` para la clave secreta.** La clave publicable identifica la aplicación; la sesión verificada identifica al usuario. La clave secreta solo se usa en el servidor para operaciones de negocio validadas.

El servidor no cae automáticamente al login de ChatGPT ni a D1 si faltan credenciales de Supabase: muestra el acceso pendiente de configuración y mantiene bloqueados los datos. El modo anterior sigue disponible únicamente si se establece explícitamente `APP_BACKEND=sites`.

### Proyecto seleccionado y conexión PostgreSQL

Las plantillas apuntan al proyecto `fdfgglmknbmcbjuxuwoq`, cuya URL API es `https://fdfgglmknbmcbjuxuwoq.supabase.co`. Puedes cambiarla cuando necesites otro proyecto.

La conexión directa proporcionada es `db.fdfgglmknbmcbjuxuwoq.supabase.co:5432`, base `postgres`, usuario `postgres`. `.env.example` documenta esas variables `PG*`, con una contraseña de ejemplo y `PGSSLMODE=verify-full` para exigir TLS y verificar el certificado. La contraseña real se conserva únicamente en `.env.local`, que no se sube al repositorio ni a los paquetes de entrega.

Estas variables directas sirven para herramientas PostgreSQL externas; el runtime web mantiene la conexión por API y no utiliza un controlador TCP. La contraseña de PostgreSQL no sustituye a `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. Ambas claves siguen pendientes en la configuración local; hasta completarlas no se ha establecido una conexión autenticada desde la app. Este cambio no aplica migraciones ni modifica la base remota.

## 4. Ejecutar y verificar

```sh
npm ci
npm run dev
```

No ejecutes las migraciones SQLite de `drizzle/` para Supabase. Inicia sesión con el usuario creado en el Dashboard y agrega tus prendas y clientes. El primer cambio crea la fila de tienda del propietario.

```sh
npm test
npm run typecheck
npm run build
```

`npm test` ejecuta reglas de negocio y pruebas PostgreSQL/RLS en memoria con PGlite, sin un proyecto real. Para probar también la API con un servicio Auth de prueba desechable, usa las instrucciones de [TESTING.md](TESTING.md). Esas pruebas no se ejecutan contra una URL externa.

## 5. Despliegue

El proyecto mantiene el runtime Vinext/Cloudflare del starter. Configura las cinco variables anteriores en el entorno de ejecución del Worker o del hosting compatible antes de publicar. El repositorio GitHub por sí solo no aloja la aplicación.

Si se publica mediante un Site que conserva acceso privado de ChatGPT, la plataforma seguirá pidiendo ese acceso además del login interno de Supabase. Para distribuir la app con únicamente correo y contraseña, usa un despliegue de este Worker fuera de esa puerta privada o solicita explícitamente cambiar la audiencia de ese Site. El código no cambia permisos de publicación por su cuenta.

## Seguridad y sesiones

- La sesión se verifica en el servidor con `auth.getUser()`; no se confía en el contenido de una cookie sin verificar.
- Las cookies de sesión son HttpOnly, SameSite=Lax y Secure en HTTPS. `proxy.ts` renueva la sesión antes de renderizar páginas y acceder a la API.
- El cliente no recibe la clave privilegiada ni envía un propietario confiable: la API toma el UUID del usuario verificado.
- RLS permite lecturas propias y bloquea lecturas anónimas. Los permisos SQL bloquean escrituras directas de clientes.
- La escritura de pedidos, reservas, entregas y pagos sigue siendo atómica, con comparación de versión y reintentos idempotentes.
- Las páginas, respuestas de negocio y sesiones no se almacenan en caché.

Referencias oficiales: [SSR y cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [claves API](https://supabase.com/docs/guides/getting-started/api-keys), [configuración CLI](https://supabase.com/docs/guides/local-development/cli/config).
