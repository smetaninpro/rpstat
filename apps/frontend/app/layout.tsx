import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'RMRP Portal', description: 'Внутренний портал RMRP' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body>{children}</body></html>; }
