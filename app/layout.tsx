import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Faction Wars',
  description: 'A game of diplomacy, deception, and calculated aggression.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0D0F1A] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
