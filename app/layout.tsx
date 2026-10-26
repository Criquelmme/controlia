import type { Metadata, Viewport } from 'next';
import './globals.css';
import './login.css';
export const metadata: Metadata = {
  title: 'Controlia Tiendas · Mi tienda',
  description: 'Controlia Tiendas: inventario, pedidos, entregas y cobros en un solo lugar.',
  appleWebApp: { capable: true, title: 'Controlia', statusBarStyle: 'default' },
  icons: { icon: '/favicon.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f5f1' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" /></head><body>{children}</body></html>;
}
