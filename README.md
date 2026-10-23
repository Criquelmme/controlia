# Hilo · Mi tienda

Aplicación privada para una tienda de ropa, en español y CLP. Incluye inventario por talla y color, clientes, pedidos, reservas, encargos, entregas completas y un pago por venta en efectivo o transferencia. Se puede instalar como PWA desde el navegador.

**Estado:** implementación y pruebas locales completas; publicación pendiente por un bloqueo de aprobación del entorno al sincronizar la fuente. No hay URL de producción confirmada. Conserva el identificador existente de `.openai/hosting.json` para retomar la publicación sin crear otro sitio.

## Uso

1. Agrega las variantes de prendas en **Inventario** con precio y unidades iniciales.
2. Registra a tus clientes en **Clientes**.
3. Crea un **Pedido**. Las unidades disponibles se reservan; el resto queda como faltante.
4. En el detalle del pedido, usa **Encargar faltantes**. Desde **Encargos**, registra su recepción.
5. Cuando estén todas las prendas, confirma **Entregar pedido**. Se descuenta el inventario físico.
6. Confirma **Registrar pago** solo cuando recibas el total. Puedes hacerlo antes o después de entregar. Los pagos posteriores admiten cambios de fecha con historial.

La web y la app instalada comparten los datos del mismo usuario de ChatGPT. Las vistas se actualizan al volver a la aplicación, cada 30 segundos mientras está visible y con el botón Actualizar.

### Acceso privado

La ruta `/login` presenta el inicio de sesión con ChatGPT. Sin autenticación, `/` redirige a esa pantalla y la API responde 401 sin datos de la tienda. No se reciben ni guardan contraseñas en Hilo. Al detectar una sesión vencida se retiran los datos cargados y se cierran los formularios. Al volver desde otra pestaña o desde el historial se verifica nuevamente la sesión antes de mostrar la tienda.

Las páginas y respuestas de negocio llevan `Cache-Control: private, no-store`; el service worker no guarda datos privados. El Worker de producción redirige HTTP a HTTPS y envía HSTS en respuestas HTTPS. Esto protege el acceso en tránsito cuando esté publicado; la vista previa local permite HTTP en la dirección de loopback. No se añadió cifrado propio de la base de datos ni un sistema de contraseñas independiente.

### Instalar en el celular

- Android: abre el sitio en Chrome y usa **Instalar aplicación** en Hilo o en el menú del navegador.
- iPhone: abre el sitio en Safari, toca **Compartir → Agregar a pantalla de inicio**.

Se requiere conexión para consultar datos actualizados o registrar operaciones. No se guardan datos de negocio en almacenamiento local ni se envían operaciones en segundo plano sin conexión.

## Desarrollo

Requiere Node.js >=22.13. El proyecto usa el starter Vinext de Sites y Cloudflare D1. La autenticación de producción pertenece a Sites; el simulador de inicio de sesión es solo para desarrollo local.

```sh
npm run install:ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_amusing_machine_man.sql
npm run dev
```

Aplica la migración una sola vez en una base de datos local nueva. Las migraciones alojadas se aplican al publicar mediante Sites.

```sh
node --test tests/domain.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node tests/api.test.mjs
node tests/auth.test.mjs
```

La última prueba requiere la vista previa local en el puerto 5173 y crea datos exclusivamente locales. Rechaza URLs externas. Los datos locales de prueba no se incluyen en la publicación.

## Persistencia y concurrencia

La tabla `shops` guarda un documento de tienda por ID de usuario, con versión. Cada operación valida y aplica juntas las modificaciones a pedidos, reservas, stock, movimientos y pagos. La escritura compara la versión y reintenta con datos recientes si hay concurrencia; una clave de operación hace seguros los reintentos. No existe una secuencia de escrituras parciales entre entidades. Este diseño está orientado a una tienda pequeña, con una administradora; para historiales grandes se deberá migrar a tablas de entidades y paginación.

El servidor verifica la identidad en cada solicitud y delimita los datos por propietario. Las mutaciones aceptan JSON del mismo origen. Los datos y respuestas de negocio no se cachean. Las unidades recibidas desde un encargo se reservan primero para su pedido; las entradas generales se asignan al pedido pendiente más antiguo.

## Límites de esta versión

Sin abonos, entregas parciales, facturación tributaria, devoluciones, conexión bancaria o administración completa de proveedores. No se cancela un pedido pagado porque no existe un flujo de devolución. La entrega conserva su detalle sin edición. La instalación física en Android e iPhone debe verificarse desde esos dispositivos.
