import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'УФСБ RMRP Portal', description: 'Внутренний портал УФСБ RMRP' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body>{children}</body></html>; }
