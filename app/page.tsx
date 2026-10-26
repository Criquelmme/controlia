import { getSessionUser } from '../lib/auth';
import { backend } from '../lib/runtime-config';
import { redirect } from 'next/navigation';
import StoreApp from './store-app';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const authProvider = await backend();
  return <StoreApp ownerName={user.displayName} authProvider={authProvider} canManageUsers={authProvider === 'supabase' && user.userId === user.shopOwnerId} />;
}
