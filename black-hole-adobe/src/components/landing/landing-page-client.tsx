'use client';

import { Hero } from '@/components/landing/hero';
import { StatsSection } from '@/components/landing/stats-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { ComparisonTable } from '@/components/landing/comparison-table';
import { HowItWorks } from '@/components/landing/how-it-works';
import { CTAForm } from '@/components/landing/cta-form';
import { Footer } from '@/components/landing/footer';
import { PublicHeader } from '@/components/landing/public-header';

function TrustSection() {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Trusted Technology
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <span className="text-xs text-slate-500">Claude AI</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <span className="text-xs text-slate-500">Adobe Partner</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-xs text-slate-500">RuVector Engine</span>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-sm text-slate-400">
            Built by <span className="font-semibold text-white">Focus GTS</span> &mdash; enterprise digital
            transformation specialists with 15+ years of Adobe ecosystem experience. We&apos;ve
            migrated hundreds of enterprise sites and know where traditional approaches fail.
          </p>
        </div>
      </div>
    </section>
  );
}

export function LandingPageClient() {
  return (
    <div className="min-h-screen bg-slate-950">
      <PublicHeader />
      <main>
        <Hero />
        <StatsSection />
        <FeaturesGrid />
        <ComparisonTable />
        <HowItWorks />
        <TrustSection />
        <CTAForm />
      </main>
      <Footer />
    </div>
  );
}
