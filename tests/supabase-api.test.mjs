import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173',fixture='http://127.0.0.1:54331';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('Local tests only.');
const health=await fetch(fixture+'/__test-health').then(r=>r.json());
assert.equal(health.localSupabaseTest,true,'requires disposable local fixture, never production');
let count=0;const check=(v,m)=>{assert.ok(v,m);count++;};
function browser(){const cookies=new Map();return {
  async request(path,init={}){
    const r=await fetch(base+path,{...init,redirect:'manual',headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...init.headers}});
    for(const h of r.headers.getSetCookie()){const [name,value]=h.split(';')[0].split('=');if(!value)cookies.delete(name);else cookies.set(name,value);}
    return r;
  },
  async login(email='owner@example.test',password='local-password-only') {return this.request('/auth/login',{method:'POST',headers:{origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password})});},
  async read(){const r=await this.request('/api/shop');const data=await r.json();return{status:r.status,...data};},
  async send(kind,payload,id=crypto.randomUUID()){const r=await this.request('/api/shop',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({kind,payload,id})});return{status:r.status,...await r.json()};},
};}
const a=browser();
let r=await a.request('/');check(r.status===307&&r.headers.get('location')==='/login','anonymous home denied');
r=await a.request('/login');const html=await r.text();check(html.includes('Correo electrónico')&&html.includes('Contraseña'),'email/password login available');check(!html.includes('ADMINISTRACIÓN')&&!html.includes('Por cobrar'),'login has no private UI');check(!html.includes('local-secret-test-key'),'server key absent from HTML');
check((await a.read()).status===401,'anonymous API denied');
r=await a.login('owner@example.test','wrong-password');check(r.status===303&&r.headers.get('location')==='/login?error=credenciales','invalid credentials rejected');check((await a.read()).status===401,'invalid login does not establish a session');
r=await a.request('/auth/login',{method:'POST',headers:{origin:'https://other.example','Content-Type':'application/x-www-form-urlencoded'},body:'email=owner%40example.test&password=local-password-only'});check(r.status===403,'cross-site sign-in denied');
r=await a.login();check(r.status===303&&r.headers.get('location')==='/','login succeeds');check(r.headers.getSetCookie().some(c=>/HttpOnly/i.test(c)&&/SameSite=Lax/i.test(c)),'session uses HttpOnly SameSite cookies');check(r.headers.getSetCookie().some(c=>/Max-Age=2592000/i.test(c)),'session cookie persists for 30 days');
r=await a.request('/');check(r.status===200,'authenticated home available');check(r.headers.get('cache-control')?.includes('no-store'),'private pages are not cached');
let data=await a.read();check(data.status===200&&data.version===0,'new account starts with empty shop');
data=await a.send('client.save',{name:'Cliente Supabase local',phone:'',notes:''});check(data.status===200,'client stored through Postgres adapter');const clientId=data.shop.clients.at(-1).id;
data=await a.send('variant.create',{name:'Polera Supabase',size:'M',color:'Verde',purchasePrice:10000,profitPercent:0,stock:2});check(data.status===200,'variant persisted');const variantId=data.shop.variants.at(-1).id;
let createdUser=await a.request('/api/users',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'staff@example.test',password:'local-password-only'})});check(createdUser.status===201,'shop administrator creates a shared user');
const staff=browser();r=await staff.login('staff@example.test');check(r.status===303,'created user can log in');let shared=await staff.read();check(shared.status===200&&shared.shop.clients.some(c=>c.id===clientId)&&shared.shop.variants.some(v=>v.id===variantId),'created user sees the same shop');createdUser=await staff.request('/api/users',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'blocked@example.test',password:'local-password-only'})});check(createdUser.status===403,'shared user cannot create other users');
const payload={clientId,lines:[{variantId,quantity:2}],paymentMode:'later',method:'transfer',dueDate:'2099-01-01'};
const created=await Promise.all([a.send('order.create',payload),a.send('order.create',payload)]);check(created.every(x=>x.status===200),'concurrent orders both persist');
data=await a.read();const orders=data.shop.orders;check(orders.length===2,'no order lost');check(orders.reduce((s,o)=>s+o.lines[0].reserved,0)===2,'no overselling under concurrent writes');
const ready=orders.find(o=>o.lines[0].reserved===2),pending=orders.find(o=>o.lines[0].reserved===0);
check((await a.send('order.deliver',{orderId:pending.id,lines:[{variantId,quantity:1}]})).status===400,'unreserved delivery rejected');
const delivery=crypto.randomUUID(),partial={orderId:ready.id,lines:[{variantId,quantity:1}]};check((await a.send('order.deliver',partial,delivery)).status===200,'partial delivery accepted');check((await a.send('order.deliver',partial,delivery)).status===200,'retried partial delivery idempotent');data=await a.read();check(data.shop.orders.find(o=>o.id===ready.id).lines[0].delivered===1&&data.shop.orders.find(o=>o.id===ready.id).status==='pending','partial order remains pending');check((await a.send('order.deliver',{orderId:ready.id,lines:[{variantId,quantity:1}]})).status===200,'remaining delivery completes the order');
const payments=await Promise.all([a.send('payment.record',{orderId:ready.id,method:'cash'}),a.send('payment.record',{orderId:ready.id,method:'transfer'})]);check(payments.filter(x=>x.status===200).length===1,'only one concurrent payment accepted');
data=await a.send('supply.create',{orderId:pending.id,variantId,quantity:2});check(data.status===200,'supply persisted');const supplyId=data.shop.supplies.at(-1).id;
data=await a.send('supply.receive',{supplyId,quantity:2});check(data.status===200&&data.shop.orders.find(o=>o.id===pending.id).lines[0].reserved===2,'receipt reserves stock');
data=await a.send('payment.reschedule',{orderId:pending.id,dueDate:'2099-02-01'});check(data.status===200&&data.shop.orders.find(o=>o.id===pending.id).dueHistory.length===1,'payment history persisted');
check((await a.send('payment.record',{orderId:pending.id,method:'transfer'})).status===200,'payment before delivery');check((await a.send('order.deliver',{orderId:pending.id,lines:[{variantId,quantity:2}]})).status===200,'paid order delivered');
data=await a.send('refund.create',{orderId:ready.id,lines:[{variantId,quantity:1,restock:true}],method:'transfer',reference:'R-TEST',reason:'Cambio de talla'});check(data.status===200&&data.shop.orders.find(o=>o.id===ready.id).refunds[0].amount===10000,'refund is recorded for delivered items');check(data.shop.variants.find(v=>v.id===variantId).stock===1,'eligible returned garment re-enters stock');
const b=browser();await b.login('other@example.test');const other=await b.read();check(other.status===200&&other.shop.clients.length===0&&other.shop.orders.length===0,'second user cannot see first user data');
check((await b.send('order.deliver',{orderId:ready.id})).status===400,'second user cannot mutate first user orders');
const fresh=await a.read();check(fresh.shop.orders.length===2&&fresh.shop.orders.every(o=>o.status==='delivered'&&o.paidAt),'owner data remains correct');
const refresh=await fetch(fixture+'/__test-state').then(r=>r.json());check(refresh.refreshCount>0,'SSR refreshed expiring session');
r=await a.request('/auth/logout',{method:'POST',headers:{origin:'https://other.example'}});check(r.status===403,'cross-site logout denied');
r=await a.request('/auth/logout',{method:'POST',headers:{origin:base}});check(r.status===303&&r.headers.get('location')==='/login','logout succeeds');check((await a.read()).status===401,'API locked after logout');
r=await a.request('/',{headers:{RSC:'1'}});check(!(await r.text()).includes('Cliente Supabase local'),'RSC cannot leak private data after logout');
console.log(`${count} Supabase integration checks passed using a disposable local Auth fixture and real PostgreSQL.`);
