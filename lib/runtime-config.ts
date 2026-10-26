// Server-only runtime bindings. Never import this module from a client component.
export const sessionCookieMaxAge = 30 * 24 * 60 * 60;

export async function runtimeValue(name: string): Promise<string> {
  const local = process.env[name];
  if (local) return local;
  try {
    const { env } = await import('cloudflare:workers');
    const value = (env as unknown as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : '';
  } catch { return ''; }
}
export async function backend(): Promise<'supabase' | 'sites'> {
  const value = (await runtimeValue('APP_BACKEND')) || 'supabase';
  if (value !== 'supabase' && value !== 'sites') throw new Error('APP_BACKEND must be supabase or sites.');
  return value;
}
export async function supabaseConfig() {
  const [url, publishableKey, appUrl] = await Promise.all(['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_URL'].map(runtimeValue));
  if (!url || !publishableKey || !appUrl) return null;
  const parsed = new URL(url), origin = new URL(appUrl);
  for (const value of [parsed, origin]) {
    if (value.username || value.password || value.search || value.hash || value.pathname !== '/') throw new Error('Use an origin URL without credentials, paths or parameters.');
    if (value.protocol !== 'https:' && !(value.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(value.hostname))) throw new Error('HTTPS is required except on loopback.');
  }
  return { url: parsed.origin, publishableKey, appUrl: origin.origin, secureCookies: origin.protocol === 'https:' };
}
