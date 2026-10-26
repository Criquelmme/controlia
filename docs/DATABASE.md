# Esquema de la base de datos

## Modelo que utiliza la aplicación

La implementación guarda una tienda como un documento atómico. Los clientes, variantes, pedidos y pagos no son tablas independientes: son registros dentro de `shops.data`. Esto permite confirmar en una sola escritura el stock, las reservas, las entregas, las devoluciones y los reembolsos, con control de versión para dos dispositivos simultáneos.

| Columna | Supabase / PostgreSQL | Descripción |
|---|---|---|
| `owner` | `uuid`, clave primaria y referencia a `auth.users(id)` | Identificador del propietario autenticado |
| `version` | `integer`, obligatorio | Versión de la tienda para evitar escrituras concurrentes perdidas |
| `data` | `jsonb`, obligatorio | Documento `Shop` definido en `app/domain.ts` |
| `updated_at` | `timestamptz`, obligatorio | Fecha de la última actualización, asignada por PostgreSQL |

El SQL ejecutable está en [`supabase/migrations/20261023000100_initial_shop.sql`](../supabase/migrations/20261023000100_initial_shop.sql). `auth.users` es una tabla administrada por Supabase: no hay que crearla ni guardar contraseñas en `shops`.

RLS permite a un usuario autenticado leer únicamente la fila cuyo `owner` coincide con `auth.uid()`. `anon` no tiene acceso. Los usuarios autenticados no tienen permisos de escritura directa: las modificaciones pasan por la API, que verifica la identidad y las reglas de negocio. Para cuentas colaboradoras, Supabase conserva el UUID del propietario en `app_metadata.shop_owner`; la API usa ese dato administrado por servidor para leer y escribir el documento compartido. Solo la cuenta propietaria puede crear cuentas adicionales. El cliente privilegiado utiliza una clave solo de servidor y siempre filtra por el propietario verificado. Un trigger exige que cada actualización incremente exactamente una versión e impide cambiar el propietario.

## Registros dentro del documento

| Colección / registro | Campos |
|---|---|
| `clients[]` | `id`, `name`, `phone`, `notes`, `createdAt?` |
| `variants[]` | `id`, `name`, `size`, `color`, `price`, `stock`, `purchasePrice?`, `profitPercent?` |
| `orders[]` | `id`, `number`, `clientId`, `lines`, `total`, `notes`, `createdAt`, `status`, `deliveredAt?`, `deliveries?`, `cancelledAt?`, `paymentMode`, `method`, `dueDate`, `paidAt?`, `paymentMethod?`, `paymentReference?`, `dueHistory`, `refunds?` |
| `orders[].lines[]` | `variantId`, `name`, `size`, `color`, `price`, `quantity`, `reserved`, `delivered?` |
| `orders[].deliveries[]` | `id`, `at`, `lines[]` con `variantId` y cantidad entregada en ese evento |
| `orders[].refunds[]` | `id`, `at`, líneas devueltas con cantidad y si se reingresaron al inventario, importe, método, referencia y motivo |
| `orders[].dueHistory[]` | `from`, `to`, `at` |
| `supplies[]` | `id`, `orderId`, `variantId`, `quantity`, `received`, `eta`, `createdAt`, `cancelled?` |
| `movements[]` | `id`, `variantId`, `delta`, `reason`, `at`, `orderId?` |

Para nuevas prendas, `price` se calcula en el servidor redondeando `purchasePrice * (1 + profitPercent / 100)`. Los campos de compra y margen son opcionales en el tipo de datos para conservar la compatibilidad con prendas registradas antes de esta función.
| `operations[]` | Identificadores de solicitudes ya aplicadas, para reintentos seguros |

## Relaciones y valores

- Un pedido pertenece a un cliente mediante `clientId`.
- Cada línea de pedido referencia una variante mediante `variantId`; conserva el nombre, talla, color y precio de la venta.
- Los encargos referencian un pedido y una variante. Los movimientos pueden referenciar el pedido que los originó.
- `status`: `pending`, `delivered` o `cancelled`.
- `paymentMode`: `now` o `later`; método: `cash` o `transfer`.
- Los precios y totales son enteros CLP. `dueDate` y `eta` usan `YYYY-MM-DD`; los eventos usan fecha y hora ISO 8601.
- El stock disponible es el stock físico menos las reservas de pedidos pendientes.
- El pago único pertenece al pedido y se registra mediante `paidAt`, `paymentMethod` y `paymentReference`; no existe una tabla de abonos.
- `delivered` en cada línea acumula las unidades entregadas. Un pedido continúa pendiente hasta completar todas sus líneas; cada evento de `deliveries` conserva la fecha y cantidades.
- `refunds` registra las prendas ya entregadas y reembolsadas. El importe se calcula con los precios congelados en el pedido; las cantidades no pueden exceder lo entregado ni lo aún no devuelto. Solo las prendas marcadas aptas generan una entrada al inventario.
- `delivered?` y `refunds?` son opcionales para conservar compatibilidad con documentos guardados antes de estas funciones; las cantidades entregadas antiguas se interpretan como cero.

Las reglas de negocio y las validaciones están en `app/domain.ts`. Las migraciones anteriores de D1 se conservan en `drizzle/` para el modo legado `APP_BACKEND=sites`. El modo predeterminado es Supabase; no se mezclan ni migran automáticamente datos entre proveedores. Al tratarse de una tienda nueva, la base alojada empieza vacía. Antes de importar datos anteriores hay que mapear explícitamente su propietario al UUID de Supabase.
