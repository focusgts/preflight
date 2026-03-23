'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CostEngine } from '@/lib/calculator/cost-engine';
import { InputSlider } from '@/components/calculator/input-slider';
import { SavingsSummary } from '@/components/calculator/savings-summary';
import { CostComparison } from '@/components/calculator/cost-comparison';
import { TimelineBar } from '@/components/calculator/timeline-bar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type {
  CalculatorInputs,
  CalcMigrationType,
  CompanySize,
  AEMVersion,
  ComplianceRequirement,
} from '@/types/calculator';

// ============================================================
// Constants
// ============================================================

const MIGRATION_TYPES: { value: CalcMigrationType; label: string; icon: string }[] = [
  { value: 'aem_onprem_to_cloud', label: 'AEM On-Prem to Cloud', icon: 'cloud' },
  { value: 'aem_ams_to_cloud', label: 'AEM Managed Services to Cloud', icon: 'server' },
  { value: 'wordpress_to_aem', label: 'WordPress to AEM', icon: 'globe' },
  { value: 'sitecore_to_aem', label: 'Sitecore to AEM', icon: 'swap' },
  { value: 'ga_to_cja', label: 'Google Analytics to CJA', icon: 'chart' },
  { value: 'campaign_std_to_v8', label: 'Campaign Standard to v8', icon: 'mail' },
  { value: 'custom', label: 'Other / Custom', icon: 'cog' },
];

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: 'mid_market', label: 'Mid-Market' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'large_enterprise', label: 'Large Enterprise' },
];

const AEM_VERSIONS: { value: AEMVersion; label: string }[] = [
  { value: '6.1', label: 'AEM 6.1' },
  { value: '6.2', label: 'AEM 6.2' },
  { value: '6.3', label: 'AEM 6.3' },
  { value: '6.4', label: 'AEM 6.4' },
  { value: '6.5', label: 'AEM 6.5' },
  { value: 'ams', label: 'Managed Services' },
];

const COMPLIANCE_OPTIONS: { value: ComplianceRequirement; label: string }[] = [
  { value: 'gdpr', label: 'GDPR' },
  { value: 'hipaa', label: 'HIPAA' },
  { value: 'pci_dss', label: 'PCI-DSS' },
  { value: 'sox', label: 'SOX' },
  { value: 'fedramp', label: 'FedRAMP' },
];

const ICON_MAP: Record<string, JSX.Element> = {
  cloud: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  ),
  server: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3" />
    </svg>
  ),
  globe: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
    </svg>
  ),
  swap: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  chart: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  mail: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  cog: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const engine = new CostEngine();

// ============================================================
// Default Inputs
// ============================================================

const DEFAULT_INPUTS: CalculatorInputs = {
  migrationType: 'aem_onprem_to_cloud',
  numberOfSites: 25,
  numberOfCustomComponents: 100,
  numberOfAssets: 50, // thousands
  assetSizeGB: 100,
  numberOfIntegrations: 10,
  complianceRequirements: [],
  currentAEMVersion: '6.5',
  companySize: 'enterprise',
};

// ============================================================
// Page Component
// ============================================================

export default function CalculatorPage() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);

  const update = useCallback(
    <K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleCompliance = useCallback((req: ComplianceRequirement) => {
    setInputs((prev) => {
      const has = prev.complianceRequirements.includes(req);
      return {
        ...prev,
        complianceRequirements: has
          ? prev.complianceRequirements.filter((r) => r !== req)
          : [...prev.complianceRequirements, req],
      };
    });
  }, []);

  const result = useMemo(() => engine.calculate(inputs), [inputs]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const slug = inputs.migrationType.replace(/_/g, '-');
    return `${window.location.origin}/calculator/${slug}/${inputs.numberOfSites}-sites/${inputs.numberOfCustomComponents}-components`;
  }, [inputs.migrationType, inputs.numberOfSites, inputs.numberOfCustomComponents]);

  const handleShare = useCallback(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [shareUrl]);

  const formatAssets = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}M`;
    return `${v}K`;
  };

  const formatStorage = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}TB`;
    return `${v}GB`;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
              Free Migration Calculator
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              How much will your Adobe migration{' '}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                really
              </span>{' '}
              cost?
            </h1>
            <p className="mt-2 text-slate-400">
              Compare traditional SI pricing vs Black Hole&apos;s AI-accelerated approach.
              No sign-up required.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* ============ INPUT PANEL (left) ============ */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 space-y-6">
              {/* Migration type cards */}
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Migration Type
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  {MIGRATION_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => update('migrationType', type.value)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                        inputs.migrationType === type.value
                          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                          : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                      )}
                    >
                      {ICON_MAP[type.icon]}
                      <span className="text-xs font-medium leading-tight">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-5">
                <InputSlider
                  label="Number of Sites"
                  value={inputs.numberOfSites}
                  min={1}
                  max={500}
                  onChange={(v) => update('numberOfSites', v)}
                />
                <InputSlider
                  label="Custom Components"
                  value={inputs.numberOfCustomComponents}
                  min={0}
                  max={500}
                  onChange={(v) => update('numberOfCustomComponents', v)}
                />
                <InputSlider
                  label="DAM Assets"
                  value={inputs.numberOfAssets}
                  min={1}
                  max={1000}
                  formatValue={formatAssets}
                  onChange={(v) => update('numberOfAssets', v)}
                />
                <InputSlider
                  label="Asset Storage"
                  value={inputs.assetSizeGB}
                  min={1}
                  max={100000}
                  step={100}
                  formatValue={formatStorage}
                  onChange={(v) => update('assetSizeGB', v)}
                />
                <InputSlider
                  label="Integrations"
                  value={inputs.numberOfIntegrations}
                  min={0}
                  max={50}
                  onChange={(v) => update('numberOfIntegrations', v)}
                />
              </div>

              {/* Company size */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Company Size
                </h3>
                <div className="flex gap-2">
                  {COMPANY_SIZES.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => update('companySize', size.value)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                        inputs.companySize === size.value
                          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AEM version */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Current AEM Version
                </h3>
                <div className="flex flex-wrap gap-2">
                  {AEM_VERSIONS.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => update('currentAEMVersion', v.value)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                        inputs.currentAEMVersion === v.value
                          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compliance */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Compliance Requirements
                </h3>
                <div className="flex flex-wrap gap-2">
                  {COMPLIANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleCompliance(opt.value)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                        inputs.complianceRequirements.includes(opt.value)
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ============ RESULTS PANEL (right) ============ */}
          <div className="space-y-8 lg:col-span-3">
            {/* Savings headline */}
            <SavingsSummary
              costSaved={result.savings.costSaved}
              weeksSaved={result.savings.timeSavedWeeks}
              riskReductionPercent={result.savings.riskReductionPercent}
            />

            {/* Cost comparison */}
            <CostComparison
              traditional={result.traditional}
              blackHole={result.blackHole}
              timeline={result.timeline}
              risk={result.risk}
            />

            {/* Timeline */}
            <TimelineBar timeline={result.timeline} />

            {/* ROI projection */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
            >
              <h3 className="mb-3 text-lg font-semibold text-white">ROI Projection</h3>
              <p className="text-slate-300">
                At{' '}
                <span className="font-bold text-cyan-400">
                  ${result.roi.dailyDelayedRevenue.toLocaleString()}/day
                </span>{' '}
                in delayed value, your faster migration generates{' '}
                <span className="font-bold text-emerald-400">
                  ${result.roi.additionalRevenue.toLocaleString()}
                </span>{' '}
                in additional revenue.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Black Hole pays for itself in{' '}
                <span className="font-semibold text-violet-400">
                  {result.roi.paybackPeriodDays} days
                </span>.
              </p>
            </motion.div>

            {/* Risk comparison */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
            >
              <h3 className="mb-3 text-lg font-semibold text-white">Risk Comparison</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-rose-500/5 p-4">
                  <p className="text-sm text-slate-400">Traditional SI</p>
                  <p className="mt-1 text-2xl font-bold text-rose-400">
                    {result.risk.traditionalOverrunPercent}%
                  </p>
                  <p className="text-sm text-slate-500">chance of schedule overrun</p>
                </div>
                <div className="rounded-lg bg-emerald-500/5 p-4">
                  <p className="text-sm text-slate-400">Black Hole</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-400">
                    {result.risk.blackHoleOverrunPercent}%
                  </p>
                  <p className="text-sm text-slate-500">chance of schedule overrun</p>
                </div>
              </div>
            </motion.div>

            {/* CTA section */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 to-slate-900 p-8 text-center"
            >
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                Ready to save{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                  ${Math.round(result.savings.costSaved / 1000)}K
                </span>
                ?
              </h3>
              <p className="mt-2 text-slate-400">
                Get a precise, no-obligation assessment of your migration.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button size="lg" variant="primary">
                  Get Your Free Assessment
                </Button>
                <Button size="lg" variant="secondary" onClick={handleShare}>
                  Share Results
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                No credit card required. Results are an estimate based on industry benchmarks.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
