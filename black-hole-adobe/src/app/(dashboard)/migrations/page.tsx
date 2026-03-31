'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, X, RefreshCw, AlertCircle, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { MigrationWizard, type MigrationWizardSubmitData } from '@/components/migration/migration-wizard';
import { ProgressTracker } from '@/components/migration/progress-tracker';
import { PreFlightReport } from '@/components/migration/preflight-report';
import { EffortEstimate } from '@/components/assessment/effort-estimate';
import { MigrationStatus, MigrationType, type MigrationProject, type PaginatedResponse } from '@/types';

/** Statuses that indicate an assessment has been completed for the migration */
const ASSESSED_STATUSES = new Set<MigrationStatus>([
  MigrationStatus.ASSESSED,
  MigrationStatus.PLANNING,
  MigrationStatus.PLANNED,
  MigrationStatus.TRANSFORMING,
  MigrationStatus.EXECUTING,
  MigrationStatus.VALIDATING,
  MigrationStatus.COMPLETED,
]);

const migrationTypeLabels: Record<string, string> = {
  aem_onprem_to_cloud: 'AEM On-Prem to Cloud',
  aem_ams_to_cloud: 'AEM AMS to Cloud',
  wordpress_to_aem: 'WordPress to AEM',
  ga_to_cja: 'GA4 to CJA',
  campaign_classic_to_v8: 'Campaign to v8',
  shopify_to_commerce: 'Shopify to Commerce',
  dam_to_aem_assets: 'DAM to AEM Assets',
  aam_to_rtcdp: 'AAM to RTCDP',
};

// ── API Helpers ─────────────────────────────────────────────────────────

interface FetchMigrationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: MigrationStatus | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

async function fetchMigrations(params: FetchMigrationsParams = {}): Promise<PaginatedResponse<MigrationProject>> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 20));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(`/api/migrations?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch migrations: ${res.status}`);
  }
  return res.json();
}

async function createMigration(data: MigrationWizardSubmitData): Promise<MigrationProject> {
  const body = {
    name: data.name,
    organizationId: 'org-default',
    organizationName: 'My Organization',
    migrationType: data.migrationType,
    productsInScope: [getDefaultProduct(data.migrationType)],
    complianceRequirements: [],
    sourceEnvironment: {
      platform: getSourcePlatform(data.migrationType),
      version: '1.0',
      url: null,
      connectionType: data.connectionType,
      metadata: {},
    },
    targetEnvironment: {
      platform: getTargetPlatform(data.migrationType),
      organizationId: 'org-default',
      programId: null,
      environmentId: null,
      url: null,
      metadata: {},
    },
    targetCompletionDate: null,
  };

  const res = await fetch('/api/migrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message ?? `Failed to create migration: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

function getDefaultProduct(type: MigrationType): string {
  const map: Partial<Record<MigrationType, string>> = {
    [MigrationType.AEM_ONPREM_TO_CLOUD]: 'aem-sites',
    [MigrationType.AEM_AMS_TO_CLOUD]: 'aem-sites',
    [MigrationType.WORDPRESS_TO_AEM]: 'aem-eds',
    [MigrationType.GA_TO_CJA]: 'cja',
    [MigrationType.CAMPAIGN_CLASSIC_TO_V8]: 'campaign',
    [MigrationType.SHOPIFY_TO_COMMERCE]: 'commerce',
    [MigrationType.DAM_TO_AEM_ASSETS]: 'aem-assets',
    [MigrationType.AAM_TO_RTCDP]: 'rtcdp',
  };
  return map[type] ?? 'aem-sites';
}

function getSourcePlatform(type: MigrationType): string {
  const map: Partial<Record<MigrationType, string>> = {
    [MigrationType.AEM_ONPREM_TO_CLOUD]: 'aem_6x',
    [MigrationType.AEM_AMS_TO_CLOUD]: 'aem_ams',
    [MigrationType.WORDPRESS_TO_AEM]: 'wordpress',
    [MigrationType.GA_TO_CJA]: 'ga4',
    [MigrationType.CAMPAIGN_CLASSIC_TO_V8]: 'campaign_classic',
    [MigrationType.SHOPIFY_TO_COMMERCE]: 'shopify',
    [MigrationType.DAM_TO_AEM_ASSETS]: 'external_dam',
    [MigrationType.AAM_TO_RTCDP]: 'aam',
  };
  return map[type] ?? 'unknown';
}

function getTargetPlatform(type: MigrationType): string {
  const map: Partial<Record<MigrationType, string>> = {
    [MigrationType.AEM_ONPREM_TO_CLOUD]: 'aem_cloud',
    [MigrationType.AEM_AMS_TO_CLOUD]: 'aem_cloud',
    [MigrationType.WORDPRESS_TO_AEM]: 'aem_eds',
    [MigrationType.GA_TO_CJA]: 'cja',
    [MigrationType.CAMPAIGN_CLASSIC_TO_V8]: 'campaign_v8',
    [MigrationType.SHOPIFY_TO_COMMERCE]: 'adobe_commerce',
    [MigrationType.DAM_TO_AEM_ASSETS]: 'aem_assets_cloud',
    [MigrationType.AAM_TO_RTCDP]: 'rtcdp',
  };
  return map[type] ?? 'unknown';
}

// ── Skeleton Row ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-4">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────────────────

export default function MigrationsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MigrationStatus | null>(null);
  const [selectedMigration, setSelectedMigration] = useState<MigrationProject | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data state
  const [migrations, setMigrations] = useState<MigrationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch migrations
  const loadMigrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMigrations({
        search: debouncedSearch || undefined,
        status: statusFilter,
        pageSize: 100,
      });
      setMigrations(response.data ?? []);
      setTotalItems(response.pagination?.totalItems ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setMigrations([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadMigrations();
  }, [loadMigrations]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Handle wizard submit
  async function handleWizardSubmit(data: MigrationWizardSubmitData): Promise<string | null> {
    try {
      const project = await createMigration(data);
      setWizardOpen(false);
      setSuccessMessage(`Migration "${project.name}" created successfully.`);
      loadMigrations();
      return project.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create migration');
      return null;
    }
  }

  const columns: Column<MigrationProject & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Migration',
      sortable: true,
      render: (item) => (
        <button
          onClick={() => setSelectedMigration(item as unknown as MigrationProject)}
          className="text-left group"
        >
          <p className="font-medium text-white group-hover:text-violet-400 transition-colors">
            {item.name as string}
          </p>
          <p className="text-xs text-slate-500">{item.organizationName as string}</p>
        </button>
      ),
    },
    {
      key: 'migrationType',
      header: 'Type',
      sortable: true,
      className: 'w-44',
      render: (item) => (
        <span className="text-sm text-slate-300">
          {migrationTypeLabels[item.migrationType as string] ?? String(item.migrationType)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-32',
      render: (item) => <StatusBadge status={item.status as MigrationStatus} />,
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      className: 'w-40',
      render: (item) => (
        <ProgressBar
          value={item.progress as number}
          showPercentage
          size="sm"
          active={(item.status as MigrationStatus) === MigrationStatus.EXECUTING || (item.status as MigrationStatus) === MigrationStatus.TRANSFORMING}
        />
      ),
    },
    {
      key: 'estimatedCost',
      header: 'Est. Cost',
      sortable: true,
      className: 'w-28',
      render: (item) => (
        <span className="font-mono text-sm text-slate-300">
          ${((item.estimatedCost as number) / 1000).toFixed(0)}k
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      className: 'w-32',
      render: (item) => (
        <span className="text-sm text-slate-400">
          {new Date(item.updatedAt as string).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-sm text-emerald-300">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-emerald-400 hover:text-emerald-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Migrations</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage and monitor all migration projects.
            {!loading && totalItems > 0 && (
              <span className="ml-1 text-slate-500">({totalItems} total)</span>
            )}
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          New Migration
        </Button>
      </motion.div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search migrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter(e.target.value ? (e.target.value as MigrationStatus) : null)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {Object.values(MigrationStatus).map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-red-500/20 bg-red-500/5 py-12">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-red-300">Failed to load migrations</p>
            <p className="mt-1 text-xs text-red-400/70">{error}</p>
          </div>
          <Button variant="ghost" onClick={loadMigrations}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : migrations.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/50 py-16">
          <FolderOpen className="h-12 w-12 text-slate-600" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">No migrations yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {debouncedSearch || statusFilter
                ? 'No migrations match your search or filters. Try adjusting your criteria.'
                : 'Create your first migration to get started.'}
            </p>
          </div>
          {!debouncedSearch && !statusFilter && (
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Migration
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={migrations as (MigrationProject & Record<string, unknown>)[]}
          rowKey={(item) => item.id as string}
          pageSize={10}
          emptyMessage="No migrations found"
        />
      )}

      {/* New Migration Wizard */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Create New Migration"
        size="xl"
      >
        <MigrationWizard onSubmit={handleWizardSubmit} />
      </Modal>

      {/* Migration Detail Side Panel */}
      {selectedMigration && selectedMigration.phases.length > 0 && (
        <Modal
          open={!!selectedMigration}
          onClose={() => setSelectedMigration(null)}
          title={selectedMigration.name}
          size="lg"
        >
          <div className="space-y-6">
            <ProgressTracker
              phases={selectedMigration.phases}
              overallProgress={selectedMigration.progress}
              estimatedTimeRemaining="~2 weeks"
            />
            {ASSESSED_STATUSES.has(selectedMigration.status) && (
              <EffortEstimate migrationId={selectedMigration.id} />
            )}
            {ASSESSED_STATUSES.has(selectedMigration.status) && (
              <PreFlightReport migrationId={selectedMigration.id} />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
