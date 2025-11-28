import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'zk-Intents - Walletless ZK Rollup',
  description: 'Production-grade zero-knowledge rollup on Polygon with walletless UX',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
