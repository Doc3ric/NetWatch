import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/contexts/SocketContext';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NetWatch',
  description: 'Home Network Monitoring',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex h-screen overflow-hidden bg-background text-text`} style={{ fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
        <SocketProvider>
          {/* Sidebar */}
          <Sidebar />
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6 bg-background">
              <div className="max-w-7xl mx-auto space-y-6">
                {children}
              </div>
            </main>
          </div>
        </SocketProvider>
      </body>
    </html>
  );
}
