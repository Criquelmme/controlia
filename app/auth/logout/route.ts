import { backend } from '../../../lib/runtime-config';
import { sessionClient } from '../../../lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response('Origen no permitido.', { status: 403 });
  if (await backend() !== 'supabase') return new Response('No disponible.', { status: 404 });
  try {
    const client = await sessionClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) return new Response('No se pudo cerrar la sesión. Intenta nuevamente.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return new Response(null, { status: 303, headers: { Location: '/login', 'Cache-Control': 'private, no-store' } });
  } catch { return new Response('No se pudo cerrar la sesión.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
