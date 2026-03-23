'use client';

import { PublicHeader } from '@/components/landing/public-header';
import { Footer } from '@/components/landing/footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <PublicHeader />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
