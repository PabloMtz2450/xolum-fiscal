import './globals.css';

export const metadata = {
  title: 'XOLUM Fiscal',
  description: 'Control fiscal conectado a la operación real de tu empresa.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
