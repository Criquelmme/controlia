# Controlia Tiendas

Web privada y PWA para administrar una tienda de ropa, en español y pesos chilenos. Usa **Supabase Auth con correo y contraseña** y **PostgreSQL**. La interfaz se adapta al celular y al computador.

## Funciones

- Inventario por prenda, talla y color, con entradas, ajustes y movimientos.
- Registro del precio de compra y porcentaje de ganancia, con cálculo inmediato del precio de venta.
- Clientes e historial de pedidos y pagos.
- Pedidos con reservas, prendas faltantes y encargadas.
- Entregas parciales por prenda y recepción de encargos; cada entrega descuenta solo las unidades entregadas.
- Pago único por venta y devoluciones parciales o totales con reembolso en efectivo o transferencia; se registra fecha, referencia y si la prenda vuelve al inventario.
- Accesos compartidos: la administradora crea usuarios que trabajan sobre la misma tienda.
- Sesiones persistentes por 30 días, salvo cierre o revocación.
- Estados de entrega y pago independientes; protección contra operaciones duplicadas y cambios concurrentes.
- Login obligatorio, cookies HttpOnly y Secure en HTTPS, API autenticada, aislamiento por propietario y respuestas privadas sin caché.
- Instalación desde Chrome/Edge o Safari como PWA. Requiere conexión para consultar y guardar.

## Configurar Supabase

1. Aplica el [SQL de la base de datos](supabase/migrations/20261023000100_initial_shop.sql) en un proyecto Supabase nuevo.
2. Desactiva los registros públicos y crea tu usuario en Authentication del Dashboard.
3. Copia `.dev.vars.example` a `.dev.vars` y completa URL, claves y origen de la app. Los archivos reales no se suben a Git.
4. Ejecuta `npm ci` y `npm run dev` con Node.js >=22.13.

La guía completa está en **[docs/SUPABASE.md](docs/SUPABASE.md)**. Incluye las opciones del Dashboard, desarrollo local, variables del servidor y despliegue. La aplicación queda bloqueada si no tiene la configuración de acceso; no usa un proveedor alternativo automáticamente.

## Esquema de datos

`public.shops` contiene una fila por tienda: `owner uuid`, `version integer`, `data jsonb`, `updated_at timestamptz`. Los usuarios creados desde la app se asocian a esa tienda mediante `app_metadata` administrada por Supabase y solo el propietario puede crear accesos adicionales.

`data` guarda los registros de `clients`, `variants`, `orders` (con líneas y pago único), `supplies`, `movements` y `operations`. El documento se actualiza atómicamente con comparación de versión. [Ver campos, relaciones y reglas de acceso](docs/DATABASE.md).

RLS permite al usuario leer únicamente su tienda. Los clientes no tienen permisos SQL para modificarla directamente: la API verifica sesión y reglas de negocio antes de escribir con una clave exclusivamente del servidor.

## Pruebas

```sh
npm test
npm run typecheck
npm run build
```

Las [instrucciones de integración](docs/TESTING.md) permiten comprobar login, sesión, API y PostgreSQL con un entorno local desechable, sin credenciales reales. Estas pruebas no sustituyen la verificación contra tu proyecto alojado.

## Uso diario

Agrega prendas con su color, precio de compra y porcentaje de ganancia; Controlia calcula el precio de venta. Agrega clientes, crea el pedido, encarga sus faltantes y registra su recepción. Entrega las unidades disponibles de una sola vez o en varias entregas. Registra el pago cuando recibas el total; después puedes registrar devoluciones de unidades ya entregadas y el reembolso asociado.

Para instalar en Android usa «Instalar aplicación» en Chrome; en iPhone usa Safari → Compartir → Agregar a pantalla de inicio. Ambas vistas comparten la cuenta y los datos.

## Estado y límites

El código y las configuraciones están preparados; para usar una instancia alojada se requiere configurar un proyecto Supabase real y desplegar el Worker Vinext/Cloudflare. Subir el repositorio a GitHub no publica por sí solo la aplicación.

No incluye abonos, facturación tributaria, conexión bancaria, registro público ni recuperación de contraseña desde la app. La administradora crea usuarios desde la aplicación; los usuarios iniciales se administran en Supabase. El adaptador anterior de D1/ChatGPT se conserva solo como modo explícito `APP_BACKEND=sites`, sin migración automática de datos. La documentación del starter está en [docs/STARTER.md](docs/STARTER.md).
