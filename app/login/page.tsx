import { redirect } from 'next/navigation';
import { LockKeyhole, ArrowRight, ShieldCheck } from 'lucide-react';
import { chatGPTSignInPath } from '../chatgpt-auth';
import { getSessionUser } from '../../lib/auth';
import { backend, supabaseConfig } from '../../lib/runtime-config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ingresar · Hilo', robots: { index: false, follow: false } };
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (user) redirect('/');
  const provider = await backend(), configured = provider === 'sites' || Boolean(await supabaseConfig());
  const query = await searchParams;
  const errors: Record<string, string> = { credenciales: 'Correo o contraseña incorrectos.', limite: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.', configuracion: 'El acceso todavía no está configurado. Contacta con administración.', conexion: 'No pudimos conectar. Intenta nuevamente.' };
  const message = typeof query.error === 'string' ? errors[query.error] : undefined;
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <span className="brand-mark" aria-hidden="true">h<span>·</span></span><div className="eyebrow">HILO · ACCESO PRIVADO</div>
    <h1 id="login-title">Tu tienda empieza<br />con un acceso seguro.</h1><p>Inicia sesión para acceder a tu espacio privado.</p>
    {message && <div className="form-error" role="alert">{message}</div>}
    {!configured ? <div className="form-error">El acceso todavía no está configurado. Contacta con administración.</div> : provider === 'sites' ? <a className="btn primary login-button" href={chatGPTSignInPath('/')} target="_top"><LockKeyhole size={17} /> Iniciar sesión con ChatGPT <ArrowRight size={16} /></a> : <form action="/auth/login" method="post" className="login-form">
      <label className="field"><span>Correo electrónico</span><input name="email" type="email" autoComplete="username" maxLength={320} required placeholder="tu@correo.cl" /></label>
      <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" maxLength={1024} required /></label>
      <button className="btn primary login-button" type="submit"><LockKeyhole size={17} /> Iniciar sesión <ArrowRight size={16} /></button>
    </form>}
    <div className="login-privacy"><ShieldCheck size={16} /><span>Los datos de tu tienda solo están disponibles después de iniciar sesión.</span></div>
  </section><p className="login-caption">Hilo · Tu tienda, en orden.</p></main>;
}
