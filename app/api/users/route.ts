import { getSessionUser } from '../../../lib/auth';
import { backend } from '../../../lib/runtime-config';
import { databaseClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: 'Inicia sesión para crear usuarios.' }, 401);
  if (user.userId !== user.shopOwnerId || await backend() !== 'supabase') return json({ error: 'Solo la administradora puede crear usuarios.' }, 403);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Origen no permitido.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Formato inválido.' }, 415);

  let body: { email?: unknown; password?: unknown };
  try {
    const text = await request.text();
    if (text.length > 10000) return json({ error: 'La solicitud es demasiado grande.' }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Solicitud inválida.' }, 400);
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return json({ error: 'Ingresa un correo válido.' }, 400);
  if (password.length < 12 || password.length > 128) return json({ error: 'La contraseña debe tener entre 12 y 128 caracteres.' }, 400);

  try {
    const client = await databaseClient();
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { shop_owner: user.shopOwnerId },
    });
    if (error) {
      if (error.code === 'email_exists' || error.status === 422) return json({ error: 'Ya existe una cuenta con ese correo.' }, 409);
      console.error('User creation failed', error);
      return json({ error: 'No se pudo crear el usuario. Intenta nuevamente.' }, 503);
    }
    return json({ user: { id: data.user.id, email: data.user.email } }, 201);
  } catch (error) {
    console.error('User creation failed', error);
    return json({ error: 'No se pudo crear el usuario. Intenta nuevamente.' }, 503);
  }
}
