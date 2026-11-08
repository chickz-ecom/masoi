import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const body = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});
const display = Cormorant_Garamond({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Ma Sói Online', template: '%s · Ma Sói Online' },
  description: 'Chơi Ma Sói trực tuyến cùng bạn bè — quản trò tự động hoặc có quản trò.',
  applicationName: 'Ma Sói Online',
};

export const viewport: Viewport = {
  themeColor: '#06070d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
