import { backend, supabaseConfig } from '../../../lib/runtime-config';
import { sessionClient } from '../../../lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const url = new URL(request.url);
  const destination = (error?: string) => new Response(null, { status: 303, headers: { Location: error ? `/login?error=${error}` : '/', 'Cache-Control': 'private, no-store' } });
  if (request.headers.get('origin') !== url.origin) return new Response('Origen no permitido.', { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Formato inválido.', { status: 415 });
  const body = await request.text();
  if (body.length > 10000) return new Response('Solicitud demasiado grande.', { status: 413 });
  const fields = new URLSearchParams(body), email = (fields.get('email') || '').trim(), password = fields.get('password') || '';
  if (!email.includes('@') || email.length > 320 || !password || password.length > 1024) return destination('credenciales');
  try {
    if (await backend() !== 'supabase' || !await supabaseConfig()) return destination('configuracion');
    const client = await sessionClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return destination(error.status === 429 ? 'limite' : 'credenciales');
    return destination();
  } catch { return destination('conexion'); }
}
