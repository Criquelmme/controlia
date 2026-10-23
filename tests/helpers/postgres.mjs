import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ownerA='11111111-1111-4111-8111-111111111111',ownerB='22222222-2222-4222-8222-222222222222';
export const blank={clients:[],variants:[],orders:[],supplies:[],movements:[],operations:[]};
export async function createDatabase(){
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $uid$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $uid$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${ownerA}'),('${ownerB}');`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261023000100_initial_shop.sql',import.meta.url),'utf8'));
  return db;
}
export async function asRole(db,role,owner,sql,params=[]){
  if(!['anon','authenticated','service_role'].includes(role))throw new Error('Invalid test role');
  return db.transaction(async tx=>{
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner||'']);
    return tx.query(sql,params);
  });
}
