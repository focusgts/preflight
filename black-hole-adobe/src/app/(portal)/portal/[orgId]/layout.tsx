'use client';

/**
 * Portal Layout
 *
 * Wraps the customer portal pages with branding header,
 * navigation between overview and migration detail views.
 */

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';
import { BRAND_LOGOS, BRAND_COPY } from '@/config/brand';

// ── Org Name Lookup ────────────────────────────────────────

function getOrgDisplayName(orgId: string): string {
  const names: Record<string, string> = {
    acme: 'ACME Corporation',
    globalretail: 'GlobalRetail Inc.',
  };
  return names[orgId] ?? `Organization ${orgId}`;
}

// ── Layout ─────────────────────────────────────────────────

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const orgId = params.orgId as string;
  const orgName = getOrgDisplayName(orgId);

  const isMigrationDetail = pathname.includes('/migration/');
  const portalBase = `/portal/${orgId}`;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Back Button (only on detail views) */}
            {isMigrationDetail && (
              <Link
                href={portalBase}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            )}

            {/* Logo */}
            <Link href={portalBase} className="flex items-center gap-3">
              <Image
                src={BRAND_LOGOS.navLogo}
                alt="Focus GTS"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-white">{BRAND_COPY.productName}</span>
            </Link>

            {/* Org Name */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-5 w-px bg-slate-700" />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-slate-400"
              >
                {orgName}
              </motion.span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Secure Migration Portal</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>Powered by {BRAND_COPY.productName} | {BRAND_COPY.companyName}</p>
        <p className="mt-1">
          Questions? Contact your migration team or email{' '}
          <a href={`mailto:${BRAND_COPY.supportEmail}`} className="text-[#CB8CFF] hover:text-[#9966F0]">
            {BRAND_COPY.supportEmail}
          </a>
        </p>
      </footer>
    </div>
  );
}
