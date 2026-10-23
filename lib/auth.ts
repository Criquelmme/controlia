import { backend, supabaseConfig } from './runtime-config';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { sessionClient } from './supabase/server';
export type SessionUser = { userId: string; displayName: string; email: string };
export async function getSessionUser(): Promise<SessionUser | null> {
  if (await backend() === 'sites') return getChatGPTUser();
  if (!await supabaseConfig()) return null;
  try {
    const client = await sessionClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.email) return null;
    return { userId: data.user.id, email: data.user.email, displayName: data.user.email };
  } catch { return null; } // Fail closed; cookies alone never establish identity.
}
