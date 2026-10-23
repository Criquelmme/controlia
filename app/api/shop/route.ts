import { getSessionUser } from '../../../lib/auth';
import { readShop, writeShop } from '../../../db/shop-store';
import { applyCommand, BusinessError, type Command } from '../../domain';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });
export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: 'Inicia sesión para ver tu tienda.' }, 401);
  try { return json(await readShop(user.userId)); } catch (error) { console.error('Shop read failed', error); return json({ error: 'No se pudo cargar la tienda. Intenta nuevamente.' }, 503); }
}
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, 401);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Origen no permitido.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Formato inválido.' }, 415);
  let command: Command;
  try {
    const body = await request.text();
    if (body.length > 100000) return json({ error: 'La solicitud es demasiado grande.' }, 413);
    command = JSON.parse(body);
    if (!command || typeof command !== 'object') return json({ error: 'Solicitud inválida.' }, 400);
  } catch { return json({ error: 'Solicitud inválida.' }, 400); }
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await readShop(user.userId);
      const next = applyCommand(current.shop, command);
      if (next === current.shop) return json(current);
      if (await writeShop(user.userId, current.version, next)) return json({ shop: next, version: current.version + 1 });
    }
    return json({ error: 'La tienda cambió desde otro dispositivo. Actualiza e intenta nuevamente.' }, 409);
  } catch (error) {
    if (error instanceof BusinessError) return json({ error: error.message }, 400);
    console.error('Shop write failed', error); return json({ error: 'No pudimos confirmar la operación. Actualiza antes de volver a intentarlo.' }, 503);
  }
}
