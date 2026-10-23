import { emptyShop, type Shop } from '../app/domain';
import { backend } from '../lib/runtime-config';
import { databaseClient } from '../lib/supabase/server';
async function d1() { const { env } = await import('cloudflare:workers'); if (!env.DB) throw new Error('D1 unavailable'); return env.DB; }
export async function readShop(owner: string): Promise<{ version: number; shop: Shop }> {
  if (await backend() === 'supabase') {
    const client = await databaseClient();
    const { data, error } = await client.from('shops').select('version,data').eq('owner', owner).maybeSingle();
    if (error) throw new Error('Supabase read failed.');
    return data ? { version: data.version, shop: data.data as Shop } : { version: 0, shop: emptyShop() };
  }
  const row = await (await d1()).prepare('SELECT version, data FROM shops WHERE owner = ?').bind(owner).first<{ version: number; data: string }>();
  return row ? { version: row.version, shop: JSON.parse(row.data) as Shop } : { version: 0, shop: emptyShop() };
}
export async function writeShop(owner: string, version: number, next: Shop): Promise<boolean> {
  if (await backend() === 'supabase') {
    const client = await databaseClient();
    if (version === 0) {
      const { error } = await client.from('shops').insert({ owner, version: 1, data: next });
      if (error?.code === '23505') return false;
      if (error) throw new Error('Supabase insert failed.');
      return true;
    }
    const { data, error } = await client.from('shops').update({ version: version + 1, data: next }).eq('owner', owner).eq('version', version).select('version').maybeSingle();
    if (error) throw new Error('Supabase update failed.');
    return data !== null;
  }
  const db = await d1(), now = new Date().toISOString();
  const result = version === 0
    ? await db.prepare('INSERT INTO shops (owner, version, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(owner) DO NOTHING').bind(owner, JSON.stringify(next), now).run()
    : await db.prepare('UPDATE shops SET data = ?, version = version + 1, updated_at = ? WHERE owner = ? AND version = ?').bind(JSON.stringify(next), now, owner, version).run();
  return result.meta.changes === 1;
}
