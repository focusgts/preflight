'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  Radio,
  AlertCircle,
  Send,
} from 'lucide-react';
import type { MigrationProject, MigrationPhase, AssessmentFinding } from '@/types';
import { MigrationStatus } from '@/types';

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
  kbArticles: { title: string; platform: string; source: string }[];
  latestMigrationId: string | null;
}

// ── Helpers ────────────────────────────────────────────────

/** Map a MigrationType enum value to a human-readable label */
function migrationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    aem_onprem_to_cloud: 'AEM On-Prem to Cloud Service',
    aem_ams_to_cloud: 'AEM AMS to Cloud Service',
    aem_version_upgrade: 'AEM Version Upgrade',
    aem_to_eds: 'AEM to Edge Delivery Services',
    wordpress_to_aem: 'WordPress to AEM',
    sitecore_to_aem: 'Sitecore to AEM',
    drupal_to_aem: 'Drupal to AEM',
    ga_to_adobe_analytics: 'GA to Adobe Analytics',
    ga_to_cja: 'GA to Customer Journey Analytics',
    campaign_std_to_v8: 'Campaign Standard to V8',
    custom: 'Custom Migration',
  };
  return labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive a short migration label from source/target info */
function deriveMigrationLabel(m: MigrationProject): string {
  const source = m.sourceEnvironment;
  const version = source.version ? ` ${source.version}` : '';
  const platform = source.platform.replace(/_/g, ' ').toUpperCase();
  return `${platform}${version} Migration`;
}

/** Map MigrationStatus to a portal-friendly display status */
function displayStatus(status: MigrationStatus): string {
  const map: Record<string, string> = {
    [MigrationStatus.DRAFT]: 'Draft',
    [MigrationStatus.ASSESSING]: 'Assessing',
    [MigrationStatus.ASSESSED]: 'Assessed',
    [MigrationStatus.PLANNING]: 'Planning',
    [MigrationStatus.PLANNED]: 'Planned',
    [MigrationStatus.TRANSFORMING]: 'In Progress',
    [MigrationStatus.EXECUTING]: 'In Progress',
    [MigrationStatus.VALIDATING]: 'Validating',
    [MigrationStatus.COMPLETED]: 'Completed',
    [MigrationStatus.FAILED]: 'Failed',
    [MigrationStatus.CANCELLED]: 'Cancelled',
  };
  return map[status] ?? status;
}

/** Convert a phase from the migration data into a portal Phase */
function toPortalPhase(phase: MigrationPhase): Phase {
  let status: Phase['status'] = 'pending';
  if (phase.status === MigrationStatus.COMPLETED) {
    status = 'completed';
  } else if (
    phase.status === MigrationStatus.EXECUTING ||
    phase.status === MigrationStatus.TRANSFORMING ||
    phase.status === MigrationStatus.VALIDATING
  ) {
    status = 'active';
  } else if (phase.progress > 0) {
    status = 'active';
  }

  const completedAt = phase.completedAt
    ? new Date(phase.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : undefined;

  return {
    name: phase.name,
    status,
    progress: phase.progress,
    description: describePhase(phase),
    completedAt,
  };
}

/** Generate a short description for a phase based on its items */
function describePhase(phase: MigrationPhase): string {
  const totalItems = phase.items.length;
  const completedItems = phase.items.filter((i) => i.status === 'completed').length;
  const autoFixed = phase.items.filter((i) => i.autoFixed).length;

  if (totalItems === 0) {
    return phase.name;
  }

  if (phase.status === MigrationStatus.COMPLETED) {
    const suffix = autoFixed > 0 ? `, ${autoFixed} auto-fixed` : '';
    return `${completedItems} items processed${suffix}`;
  }

  return `${completedItems} / ${totalItems} items processed`;
}

/** Format a number with K/M suffixes */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/** Format currency */
function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

/** Build knowledge base articles from assessment findings */
function buildKBArticles(
  migrations: MigrationProject[],
): { title: string; platform: string; source: string }[] {
  const articles: { title: string; platform: string; source: string }[] = [];

  for (const m of migrations) {
    if (!m.assessment) continue;

    // Group findings by category
    const categoryGroups = new Map<string, AssessmentFinding[]>();
    for (const finding of m.assessment.findings) {
      const existing = categoryGroups.get(finding.category) ?? [];
      existing.push(finding);
      categoryGroups.set(finding.category, existing);
    }

    // Create an article per category group
    for (const [category, findings] of categoryGroups) {
      articles.push({
        title: `${category} — Analysis & Recommendations`,
        platform: migrationTypeLabel(m.migrationType),
        source: `${findings.length} finding${findings.length !== 1 ? 's' : ''} analyzed`,
      });
    }

    // Add articles from recommendations
    for (const rec of m.assessment.recommendations.slice(0, 3)) {
      articles.push({
        title: rec,
        platform: migrationTypeLabel(m.migrationType),
        source: 'Assessment recommendation',
      });
    }
  }

  // Deduplicate by title and limit to 10
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  }).slice(0, 10);
}

/** Build a MigrationSummary from real migration data */
function buildSummary(orgId: string, migrations: MigrationProject[]): MigrationSummary {
  // Sort by updatedAt desc to get the most recent
  const sorted = [...migrations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const primary = sorted[0];

  // Build phases from the primary migration
  const phases: Phase[] =
    primary.phases.length > 0
      ? primary.phases.map(toPortalPhase)
      : [
          { name: 'Assessment', status: 'pending' as const, progress: 0, description: 'Environment scanning' },
          { name: 'Planning', status: 'pending' as const, progress: 0, description: 'Migration plan generation' },
          { name: 'Execution', status: 'pending' as const, progress: 0, description: 'Content and code migration' },
          { name: 'Validation', status: 'pending' as const, progress: 0, description: 'Testing and verification' },
          { name: 'Go Live', status: 'pending' as const, progress: 0, description: 'DNS cutover and monitoring' },
        ];

  // Compute aggregate stats across all migrations for this org
  let totalItems = 0;
  let completedItems = 0;
  let autoFixedCount = 0;

  for (const m of migrations) {
    for (const phase of m.phases) {
      totalItems += phase.items.length;
      completedItems += phase.items.filter((i) => i.status === 'completed').length;
      autoFixedCount += phase.items.filter((i) => i.autoFixed).length;
    }
  }

  // KB articles from assessments
  const kbArticles = buildKBArticles(migrations);

  // Timeline and savings
  const estimatedWeeks = primary.estimatedDurationWeeks || 6;
  // Traditional estimate: either from assessment data or rough 4x multiplier
  const traditionalWeeks =
    primary.assessment?.traditionalEstimate?.durationWeeks ?? estimatedWeeks * 4;
  const weeksSaved = traditionalWeeks - estimatedWeeks;

  // Cost savings
  const bhCost = primary.estimatedCost || 0;
  const traditionalCost = primary.assessment?.traditionalEstimate?.cost ?? bhCost * 3;
  const costSaved = traditionalCost - bhCost;

  // Dates
  const startedAt = new Date(primary.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  let estimatedCompletion = 'TBD';
  if (primary.targetCompletionDate) {
    estimatedCompletion = new Date(primary.targetCompletionDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } else if (estimatedWeeks > 0) {
    const completionDate = new Date(primary.createdAt);
    completionDate.setDate(completionDate.getDate() + estimatedWeeks * 7);
    estimatedCompletion = completionDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return {
    organizationName: primary.organizationName,
    migrationType: migrationTypeLabel(primary.migrationType),
    migrationLabel: deriveMigrationLabel(primary),
    overallProgress: primary.progress,
    status: displayStatus(primary.status),
    startedAt,
    estimatedCompletion,
    phases,
    stats: [
      {
        label: 'Items Migrated',
        value: totalItems > 0 ? `${formatCount(completedItems)} / ${formatCount(totalItems)}` : '0',
        icon: FileText,
      },
      { label: 'KB Articles Created', value: String(kbArticles.length), icon: BookOpen },
      {
        label: 'Time Saved vs Traditional',
        value: weeksSaved > 0 ? `${weeksSaved} weeks` : 'Calculating...',
        icon: Clock,
      },
      { label: 'Issues Auto-Resolved', value: String(autoFixedCount), icon: Zap },
    ],
    kbArticlesGenerated: kbArticles.length,
    itemsMigrated: completedItems,
    totalItems,
    savings: {
      timeSaved: weeksSaved > 0 ? `${weeksSaved} weeks` : 'Calculating...',
      costSaved: costSaved > 0 ? formatCurrency(costSaved) : 'Calculating...',
      traditionalTimeline: `${traditionalWeeks} weeks`,
      blackHoleTimeline: `${estimatedWeeks} weeks`,
    },
    kbArticles,
    latestMigrationId: primary.id,
  };
}

// ── API types ─────────────────────────────────────────────

interface PaginatedResponse {
  success: boolean;
  data: MigrationProject[];
  pagination: { totalItems: number };
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

function EmptyState({ orgId }: { orgId: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="rounded-full bg-slate-800 p-4">
        <AlertCircle className="h-10 w-10 text-slate-500" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-white">No Migrations Found</h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        No migrations are in progress for this organization. Contact your account manager to get started.
      </p>
      <p className="mt-1 text-xs text-slate-500">Organization ID: {orgId}</p>
    </motion.div>
  );
}

function RequestAccessForm({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="rounded-full bg-emerald-500/10 p-4">
          <CheckCircle className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-white">Access Requested</h2>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          We have received your request. Your account manager will reach out shortly with portal access details.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="rounded-full bg-slate-800 p-4">
        <Shield className="h-10 w-10 text-violet-400" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-white">Request Portal Access</h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Enter your work email to request access to the migration portal for organization <span className="font-medium text-slate-300">{orgId}</span>.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
        className="mt-6 flex w-full max-w-sm gap-2"
      >
        <input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          <Send className="h-4 w-4" />
          Request
        </button>
      </form>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      <p className="mt-4 text-sm text-slate-400">Loading migration data...</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function CustomerPortalPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState<'progress' | 'savings' | 'knowledge'>('progress');
  const [data, setData] = useState<MigrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [noMigrations, setNoMigrations] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        // Fetch migrations for this org — use search to match orgId or orgName
        const res = await fetch(
          `/api/portal/${encodeURIComponent(orgId)}/migrations`,
        );
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }

        const json: PaginatedResponse = await res.json();
        if (cancelled) return;

        if (!json.success || json.data.length === 0) {
          // Check if the user has a portal auth cookie
          const hasCookie = document.cookie.includes('bh_portal_token');
          setHasAuth(hasCookie);
          setNoMigrations(true);
          setLoading(false);
          return;
        }

        const summary = buildSummary(orgId, json.data);
        setData(summary);
        setHasAuth(true);
      } catch (err) {
        console.error('[Portal] Failed to load migration data:', err);
        setNoMigrations(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return <LoadingState />;
  }

  if (noMigrations) {
    // If no migrations and no auth, show request access form
    // If no migrations but has auth (cookie), show empty state
    return hasAuth ? <EmptyState orgId={orgId} /> : <RequestAccessForm orgId={orgId} />;
  }

  if (!data) {
    return <EmptyState orgId={orgId} />;
  }

  return (
    <div>
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

        {/* Live Dashboard Link */}
        {data.latestMigrationId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4"
          >
            <Link
              href={`/portal/${orgId}/migration/${data.latestMigrationId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 transition-all hover:bg-violet-500/20 hover:border-violet-500/50 hover:text-white"
            >
              <Radio className="h-4 w-4" />
              View Live Migration Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}

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
              {data.kbArticles.length > 0 ? (
                data.kbArticles.map((article, i) => (
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
                ))
              ) : (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-8 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">
                    Knowledge base articles will be generated as your migration progresses.
                  </p>
                </div>
              )}
              {data.kbArticlesGenerated > 0 && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  {data.kbArticlesGenerated} articles generated — full library available after migration
                </p>
              )}
            </div>
          )}
        </motion.div>

    </div>
  );
}
