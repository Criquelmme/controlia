// Local-only HTTP fixture with real Postgres migration and RLS (PGlite).
// It is NOT an authentication service and is never part of a deployed app.
import http from 'node:http';
import { createDatabase,asRole,ownerA,ownerB } from './postgres.mjs';
const db=await createDatabase(),tokens=new Map(),refreshes=new Map();let issued=0,refreshCount=0;
const users=[{id:ownerA,email:'owner@example.test'},{id:ownerB,email:'other@example.test'}];
const user=(u)=>({...u,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email'],...(u.app_metadata||{})},user_metadata:{},identities:[]});
function session(u,refresh=false){
  const expiresIn=refresh?3600:15,exp=Math.floor(Date.now()/1000)+expiresIn;
  const access=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:u.id,email:u.email,role:'authenticated',aud:'authenticated',exp,iat:Math.floor(Date.now()/1000)})).toString('base64url'),'local-only-'+(++issued)].join('.');
  const token='local-refresh-'+issued;tokens.set(access,u);refreshes.set(token,u);
  return {access_token:access,token_type:'bearer',expires_in:expiresIn,expires_at:exp,refresh_token:token,user:user(u)};
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:54331');
  const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(body===null?'null':JSON.stringify(body));};
  try{
    if(url.pathname==='/__test-health')return json({localSupabaseTest:true});
    if(url.pathname==='/__test-state')return json({refreshCount});
    let body='';for await(const part of req){body+=part;if(body.length>2000000)throw new Error('Oversized fixture request');}
    const input=body?JSON.parse(body):{};
    if(url.pathname==='/auth/v1/admin/users'&&req.method==='POST'&&req.headers.apikey==='local-secret-test-key'){
      if(users.some(existing=>existing.email===input.email))return json({code:'email_exists',message:'User already registered'},422);
      const created={id:crypto.randomUUID(),email:input.email,app_metadata:input.app_metadata||{}};
      users.push(created);
      return json(user(created),200);
    }
    if(url.pathname==='/auth/v1/token'){
      if(url.searchParams.get('grant_type')==='refresh_token'){const u=refreshes.get(input.refresh_token);if(!u)return json({message:'Invalid test refresh token'},400);refreshCount++;return json(session(u,true));}
      const u=users.find(u=>u.email===input.email);
      return u&&input.password==='local-password-only'?json(session(u)):json({message:'Invalid credentials',error_code:'invalid_credentials'},400);
    }
    const token=(req.headers.authorization||'').replace(/^Bearer /,''),u=tokens.get(token);
    if(url.pathname==='/auth/v1/user')return u?json(user(u)):json({message:'Invalid session',error_code:'bad_jwt'},401);
    if(url.pathname==='/auth/v1/logout'){tokens.delete(token);res.writeHead(204);return res.end();}
    if(url.pathname!=='/rest/v1/shops')return json({message:'Unknown local fixture route'},404);
    const privileged=req.headers.apikey==='local-secret-test-key';
    const role=privileged?'service_role':u?'authenticated':'anon';
    const ownerFilter=url.searchParams.get('owner')?.replace(/^eq\./,''),versionFilter=url.searchParams.get('version')?.replace(/^eq\./,'');
    if(req.method==='GET'){
      const result=await asRole(db,role,u?.id||'','select owner,version,data from public.shops'+(ownerFilter?' where owner=$1':''),ownerFilter?[ownerFilter]:[]);
      return json(result.rows);
    }
    if(req.method==='POST'){
      await asRole(db,role,u?.id||'','insert into public.shops(owner,version,data) values ($1,$2,$3)',[input.owner,input.version,input.data]);
      res.writeHead(201);return res.end();
    }
    if(req.method==='PATCH'){
      const result=await asRole(db,role,u?.id||'','update public.shops set version=$1,data=$2 where owner=$3 and version=$4 returning version',[input.version,input.data,ownerFilter,Number(versionFilter)]);
      return json(result.rows[0]||null);
    }
    return json({message:'Unsupported method'},405);
  }catch(e){return json({code:e.code||'fixture_error',message:e.message},e.code==='42501'?403:e.code==='23505'?409:400);}
});
server.listen(54331,'127.0.0.1',()=>console.log('Local Supabase test fixture: http://127.0.0.1:54331'));
process.on('SIGINT',()=>server.close(()=>db.close().then(()=>process.exit(0))));
process.on('SIGTERM',()=>server.close(()=>db.close().then(()=>process.exit(0))));
