'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import {
  CheckCircle,
  Circle,
  Loader2,
  ArrowRight,
  Shield,
  Clock,
  TrendingUp,
  FileText,
  BookOpen,
  Zap,
  ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────
interface Phase {
  name: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  description: string;
  completedAt?: string;
}

interface MigrationSummary {
  organizationName: string;
  migrationType: string;
  migrationLabel: string;
  overallProgress: number;
  status: string;
  startedAt: string;
  estimatedCompletion: string;
  phases: Phase[];
  stats: { label: string; value: string; icon: React.ElementType }[];
  kbArticlesGenerated: number;
  itemsMigrated: number;
  totalItems: number;
  savings: { timeSaved: string; costSaved: string; traditionalTimeline: string; blackHoleTimeline: string };
}

// ── Mock Data (would come from API) ────────────────────────
function getMockData(orgId: string): MigrationSummary {
  return {
    organizationName: orgId === 'acme' ? 'ACME Corporation' : orgId === 'globalretail' ? 'GlobalRetail Inc.' : `Organization ${orgId}`,
    migrationType: 'AEM On-Prem to Cloud Service',
    migrationLabel: 'AEM 6.5 SP18 → AEM as a Cloud Service',
    overallProgress: 68,
    status: 'In Progress',
    startedAt: 'March 3, 2026',
    estimatedCompletion: 'April 14, 2026',
    phases: [
      { name: 'Assessment', status: 'completed', progress: 100, description: 'Environment scanned, readiness report generated', completedAt: 'Mar 5' },
      { name: 'Planning', status: 'completed', progress: 100, description: 'Migration plan approved, dependencies mapped', completedAt: 'Mar 7' },
      { name: 'Code Modernization', status: 'completed', progress: 100, description: '347 bundles analyzed, 262 auto-refactored', completedAt: 'Mar 18' },
      { name: 'Content Migration', status: 'active', progress: 72, description: 'Transferring 1.2M pages and 500K assets to cloud' },
      { name: 'Testing & Validation', status: 'pending', progress: 0, description: 'Visual regression, SEO, performance validation' },
      { name: 'Go Live', status: 'pending', progress: 0, description: 'DNS cutover, monitoring activation' },
    ],
    stats: [
      { label: 'Items Migrated', value: '856K / 1.2M', icon: FileText },
      { label: 'KB Articles Created', value: '89', icon: BookOpen },
      { label: 'Time Saved vs Traditional', value: '34 weeks', icon: Clock },
      { label: 'Issues Auto-Resolved', value: '262', icon: Zap },
    ],
    kbArticlesGenerated: 89,
    itemsMigrated: 856000,
    totalItems: 1200000,
    savings: {
      timeSaved: '34 weeks',
      costSaved: '$2.57M',
      traditionalTimeline: '48 weeks',
      blackHoleTimeline: '6 weeks',
    },
  };
}

// ── Components ─────────────────────────────────────────────
function PhaseTimeline({ phases }: { phases: Phase[] }) {
  return (
    <div className="space-y-0">
      {phases.map((phase, i) => (
        <motion.div
          key={phase.name}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.08 }}
          className="relative flex gap-4"
        >
          {/* Connector Line */}
          {i < phases.length - 1 && (
            <div className="absolute left-[15px] top-[36px] h-[calc(100%-20px)] w-px bg-slate-700" />
          )}

          {/* Status Icon */}
          <div className="relative z-10 mt-1 shrink-0">
            {phase.status === 'completed' ? (
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            ) : phase.status === 'active' ? (
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-violet-400/20" />
              </div>
            ) : (
              <Circle className="h-8 w-8 text-slate-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-base font-semibold ${phase.status === 'pending' ? 'text-slate-500' : 'text-white'}`}>
                  {phase.name}
                </h3>
                <p className="mt-0.5 text-sm text-slate-400">{phase.description}</p>
              </div>
              {phase.completedAt && (
                <span className="text-xs text-slate-500">{phase.completedAt}</span>
              )}
            </div>

            {phase.status === 'active' && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-medium text-violet-400">{phase.progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${phase.progress}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SavingsComparison({ savings }: { savings: MigrationSummary['savings'] }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
      <h3 className="text-base font-semibold text-white">Your Migration Savings</h3>
      <p className="mt-1 text-sm text-slate-400">Black Hole vs. traditional system integrator engagement</p>

      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Traditional */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Traditional SI</p>
          <p className="mt-2 text-3xl font-bold text-slate-400 line-through decoration-rose-500/60">{savings.traditionalTimeline}</p>
          <p className="mt-1 text-sm text-slate-500">Estimated timeline</p>
        </div>

        {/* Black Hole */}
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-400">With Black Hole</p>
          <p className="mt-2 text-3xl font-bold text-white">{savings.blackHoleTimeline}</p>
          <p className="mt-1 text-sm text-slate-400">Actual timeline</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
          <Clock className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-emerald-400">{savings.timeSaved}</p>
            <p className="text-xs text-slate-400">Time saved</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-emerald-400">{savings.costSaved}</p>
            <p className="text-xs text-slate-400">Cost saved</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function CustomerPortalPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const data = getMockData(orgId);
  const [activeTab, setActiveTab] = useState<'progress' | 'savings' | 'knowledge'>('progress');

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">
              <div className="h-3 w-3 rounded-full bg-slate-950" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 opacity-30 blur-md" />
            </div>
            <span className="text-lg font-bold text-white">Black Hole</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>Secure Migration Portal</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Org Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-slate-400">{data.organizationName}</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{data.migrationLabel}</h1>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              <span className="text-violet-400 font-medium">{data.status}</span>
            </span>
            <span className="text-slate-500">Started {data.startedAt}</span>
            <span className="text-slate-500">Est. completion {data.estimatedCompletion}</span>
          </div>
        </motion.div>

        {/* Overall Progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Overall Progress</span>
            <span className="text-lg font-bold text-white">{data.overallProgress}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.overallProgress}%` }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400"
            />
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {data.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
              <stat.icon className="h-5 w-5 text-violet-400" />
              <p className="mt-2 text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 border-b border-slate-800">
          {(['progress', 'savings', 'knowledge'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'progress' ? 'Migration Progress' : tab === 'savings' ? 'Savings & ROI' : 'Knowledge Base'}
              {activeTab === tab && (
                <motion.div
                  layoutId="portal-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-400"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          {activeTab === 'progress' && (
            <PhaseTimeline phases={data.phases} />
          )}

          {activeTab === 'savings' && (
            <SavingsComparison savings={data.savings} />
          )}

          {activeTab === 'knowledge' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Black Hole automatically generates knowledge base articles from your migration data.
                These will be available in your support portal after migration completes.
              </p>
              {[
                { title: 'AEM Publishing Errors — Root Cause & Resolution', platform: 'AEM Sites', source: '23 historical tickets' },
                { title: 'Dynamic Media Scene7 Configuration for Cloud Service', platform: 'AEM Assets', source: 'Migration analysis' },
                { title: 'Dispatcher Cache Invalidation — Cloud Service Patterns', platform: 'AEM Cloud', source: 'Config conversion' },
                { title: 'OAuth Server-to-Server Migration from JWT', platform: 'Adobe IMS', source: 'Auth migration' },
                { title: 'Content Fragment Model Best Practices', platform: 'AEM Sites', source: '12 content fragments analyzed' },
              ].map((article, i) => (
                <motion.div
                  key={article.title}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 hover:border-violet-500/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{article.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{article.platform} — Generated from {article.source}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </motion.div>
              ))}
              <p className="mt-4 text-center text-sm text-slate-500">
                {data.kbArticlesGenerated} articles generated — full library available after migration
              </p>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          <p>Powered by Black Hole Migration Platform</p>
          <p className="mt-1">Questions? Contact your migration team or email support@blackhole.io</p>
        </div>
      </main>
    </div>
  );
}
