import { backend, supabaseConfig } from './runtime-config';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { sessionClient } from './supabase/server';
export type SessionUser = { userId: string; shopOwnerId: string; displayName: string; email: string };
export async function getSessionUser(): Promise<SessionUser | null> {
  if (await backend() === 'sites') {
    const user = await getChatGPTUser();
    return user ? { ...user, shopOwnerId: user.userId } : null;
  }
  if (!await supabaseConfig()) return null;
  try {
    const client = await sessionClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.email) return null;
    const assignedOwner = data.user.app_metadata?.shop_owner;
    if (assignedOwner !== undefined && (typeof assignedOwner !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignedOwner))) return null;
    return { userId: data.user.id, shopOwnerId: assignedOwner ?? data.user.id, email: data.user.email, displayName: data.user.email };
  } catch { return null; } // Fail closed; cookies alone never establish identity.
}
