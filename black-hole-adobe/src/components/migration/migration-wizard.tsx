'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Rocket, Check, Upload, Plug, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { MigrationTypeCards } from './migration-type-cards';
import { FileUpload, type UploadedFile } from './file-upload';
import { LiveProgress } from './live-progress';
import { MigrationType } from '@/types';

// ── Steps ────────────────────────────────────────────────────────────────

const steps = [
  { id: 1, label: 'Select Type' },
  { id: 2, label: 'Connect Source' },
  { id: 3, label: 'Map Fields' },
  { id: 4, label: 'Configure' },
  { id: 5, label: 'Review' },
  { id: 6, label: 'Launch' },
];

// ── Field Mapping Types ──────────────────────────────────────────────────

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform: 'none' | 'uppercase' | 'lowercase' | 'trim' | 'date_iso';
}

const COMMON_TARGET_FIELDS = [
  'title',
  'description',
  'name',
  'email',
  'id',
  'url',
  'path',
  'status',
  'created_at',
  'updated_at',
  'category',
  'tags',
  'content',
  'author',
  'metadata',
];

// ── Component ────────────────────────────────────────────────────────────

export interface MigrationWizardSubmitData {
  name: string;
  migrationType: MigrationType;
  connectionType: 'api' | 'file_upload' | 'git' | 'package';
}

interface MigrationWizardProps {
  onSubmit?: (data: MigrationWizardSubmitData) => Promise<string | null>;
}

export function MigrationWizard({ onSubmit }: MigrationWizardProps = {}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState<MigrationType | null>(null);
  const [projectName, setProjectName] = useState('');
  const [connectionType, setConnectionType] = useState<'api' | 'file_upload' | 'git' | 'package'>('api');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [activeMigrationId, setActiveMigrationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive source columns from uploaded files
  const sourceColumns: string[] = uploadedFiles.length > 0 && uploadedFiles[0].preview.length > 0
    ? uploadedFiles[0].preview[0]
    : [];

  function canProceed(): boolean {
    if (currentStep === 1) return selectedType !== null;
    if (currentStep === 2) {
      if (connectionType === 'file_upload') {
        return projectName.length > 0 && uploadedFiles.length > 0;
      }
      return projectName.length > 0;
    }
    if (currentStep === 3) {
      // Field mapping step: at least one mapping required if we have source columns
      if (sourceColumns.length > 0) {
        return fieldMappings.length > 0 && fieldMappings.every((m) => m.targetField.length > 0);
      }
      return true;
    }
    return true;
  }

  function handleFilesUploaded(files: UploadedFile[]) {
    setUploadedFiles((prev) => [...prev, ...files]);

    // Auto-generate field mappings from the first file's headers
    if (fieldMappings.length === 0 && files.length > 0 && files[0].preview.length > 0) {
      const headers = files[0].preview[0];
      const autoMappings = headers.map((header) => ({
        sourceField: header,
        targetField: suggestTargetField(header),
        transform: 'none' as const,
      }));
      setFieldMappings(autoMappings);
    }
  }

  function handleFileRemoved(fileId: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  function updateFieldMapping(index: number, updates: Partial<FieldMapping>) {
    setFieldMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Step Indicator */}
      <div className="mb-8 flex items-center justify-center gap-1">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300',
                  currentStep > step.id
                    ? 'bg-emerald-500 text-white'
                    : currentStep === step.id
                    ? 'bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-slate-800 text-slate-500'
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  currentStep === step.id ? 'text-white' : 'text-slate-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mx-3 h-px w-8 sm:w-12',
                  currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-800'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {/* Step 1: Select Migration Type */}
          {currentStep === 1 && (
            <div>
              <h2 className="mb-2 text-xl font-semibold text-white">Select Migration Type</h2>
              <p className="mb-6 text-sm text-slate-400">
                Choose the type of migration you want to perform.
              </p>
              <MigrationTypeCards selected={selectedType} onSelect={setSelectedType} />
            </div>
          )}

          {/* Step 2: Connect Source */}
          {currentStep === 2 && (
            <Card padding="lg">
              <h2 className="mb-2 text-xl font-semibold text-white">Connect Source</h2>
              <p className="mb-6 text-sm text-slate-400">
                Configure the connection to your source environment.
              </p>
              <div className="space-y-4">
                <Input
                  label="Project Name"
                  placeholder="e.g., Acme Corp AEM Migration"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />

                {/* Connection Type Selector */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Connection Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CONNECTION_TYPES.map((ct) => (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => setConnectionType(ct.value as typeof connectionType)}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-xs font-medium transition-all cursor-pointer',
                          connectionType === ct.value
                            ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                            : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600',
                        )}
                      >
                        <ct.icon className="h-4 w-4" />
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Upload (when file_upload is selected) */}
                {connectionType === 'file_upload' && (
                  <div className="mt-2">
                    <FileUpload
                      onFilesUploaded={handleFilesUploaded}
                      onFileRemoved={handleFileRemoved}
                    />
                  </div>
                )}

                {/* API Connection Form (when api is selected) */}
                {connectionType === 'api' && (
                  <>
                    <Input
                      label="Source URL"
                      placeholder="https://author.example.com"
                      type="url"
                    />
                    <Select
                      label="Authentication Method"
                      options={[
                        { value: 'oauth_s2s', label: 'OAuth Server-to-Server' },
                        { value: 'api_key', label: 'API Key' },
                        { value: 'basic', label: 'Basic Auth' },
                      ]}
                    />
                  </>
                )}

                {/* Git Connection Form */}
                {connectionType === 'git' && (
                  <>
                    <Input
                      label="Repository URL"
                      placeholder="https://github.com/org/repo.git"
                      type="url"
                    />
                    <Input
                      label="Branch"
                      placeholder="main"
                    />
                  </>
                )}

                {/* Package Import */}
                {connectionType === 'package' && (
                  <FileUpload
                    onFilesUploaded={handleFilesUploaded}
                    onFileRemoved={handleFileRemoved}
                    accept={['.zip', '.tar.gz', '.json', '.xml']}
                  />
                )}
              </div>
            </Card>
          )}

          {/* Step 3: Map Fields */}
          {currentStep === 3 && (
            <Card padding="lg">
              <h2 className="mb-2 text-xl font-semibold text-white">Map Fields</h2>
              <p className="mb-6 text-sm text-slate-400">
                {sourceColumns.length > 0
                  ? 'Map your source data columns to target fields. We auto-suggested mappings based on column names.'
                  : 'Field mapping will be configured automatically based on your source schema.'}
              </p>

              {sourceColumns.length > 0 ? (
                <div className="space-y-3">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 text-xs font-medium text-slate-400">
                    <span>Source Field</span>
                    <span />
                    <span>Target Field</span>
                    <span>Transform</span>
                  </div>

                  {/* Mapping rows */}
                  {fieldMappings.map((mapping, idx) => (
                    <motion.div
                      key={mapping.sourceField}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3"
                    >
                      {/* Source field (read-only) */}
                      <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
                        {mapping.sourceField}
                      </div>

                      {/* Arrow */}
                      <ArrowRightLeft className="h-4 w-4 text-slate-600" />

                      {/* Target field */}
                      <select
                        value={mapping.targetField}
                        onChange={(e) =>
                          updateFieldMapping(idx, { targetField: e.target.value })
                        }
                        className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      >
                        <option value="">-- Skip --</option>
                        {COMMON_TARGET_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                        <option value={mapping.sourceField}>
                          {mapping.sourceField} (keep original)
                        </option>
                      </select>

                      {/* Transform */}
                      <select
                        value={mapping.transform}
                        onChange={(e) =>
                          updateFieldMapping(idx, {
                            transform: e.target.value as FieldMapping['transform'],
                          })
                        }
                        className="w-24 cursor-pointer rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-2 text-xs text-white transition-colors focus:border-violet-500 focus:outline-none"
                      >
                        <option value="none">None</option>
                        <option value="uppercase">UPPER</option>
                        <option value="lowercase">lower</option>
                        <option value="trim">Trim</option>
                        <option value="date_iso">ISO Date</option>
                      </select>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-800/30 py-10 text-center">
                  <ArrowRightLeft className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                  <p className="text-sm text-slate-500">
                    No source columns detected. Field mapping will be generated
                    automatically after the assessment phase.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Step 4: Configure */}
          {currentStep === 4 && (
            <Card padding="lg">
              <h2 className="mb-2 text-xl font-semibold text-white">Configure Migration</h2>
              <p className="mb-6 text-sm text-slate-400">
                Fine-tune migration settings and options.
              </p>
              <div className="space-y-4">
                <Select
                  label="Target Environment"
                  options={[
                    { value: 'prod', label: 'Production' },
                    { value: 'stage', label: 'Stage' },
                    { value: 'dev', label: 'Development' },
                  ]}
                />
                <Select
                  label="Migration Strategy"
                  options={[
                    { value: 'full', label: 'Full Migration' },
                    { value: 'incremental', label: 'Incremental' },
                    { value: 'delta', label: 'Delta Sync' },
                  ]}
                />
                <Textarea
                  label="Notes"
                  placeholder="Any additional notes or requirements..."
                />
              </div>
            </Card>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <Card padding="lg">
              <h2 className="mb-2 text-xl font-semibold text-white">Review Configuration</h2>
              <p className="mb-6 text-sm text-slate-400">
                Confirm your migration settings before launching.
              </p>
              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                <ReviewRow label="Project" value={projectName || 'New Migration'} />
                <ReviewRow
                  label="Type"
                  value={selectedType?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Not selected'}
                />
                <ReviewRow label="Connection" value={connectionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
                {uploadedFiles.length > 0 && (
                  <ReviewRow
                    label="Files"
                    value={`${uploadedFiles.length} file(s) - ${uploadedFiles.reduce((sum, f) => sum + f.rowCount, 0).toLocaleString()} total rows`}
                  />
                )}
                {fieldMappings.filter((m) => m.targetField).length > 0 && (
                  <ReviewRow
                    label="Field Mappings"
                    value={`${fieldMappings.filter((m) => m.targetField).length} mapped`}
                  />
                )}
                <ReviewRow label="Strategy" value="Full Migration" />
                <ReviewRow label="Target" value="Production" />
                <ReviewRow label="Estimated Duration" value="6-8 weeks" />
                <ReviewRow label="Estimated Cost" value="$45,000" />
              </div>
            </Card>
          )}

          {/* Step 6: Launch */}
          {currentStep === 6 && (
            <Card padding="lg">
              {activeMigrationId ? (
                <LiveProgress migrationId={activeMigrationId} />
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400"
                  >
                    <Rocket className="h-10 w-10 text-white" />
                  </motion.div>
                  <h2 className="mb-2 text-2xl font-bold text-white">Ready to Launch</h2>
                  <p className="mb-8 max-w-md text-sm text-slate-400">
                    Your migration is configured and ready. Black Hole will begin the assessment
                    phase automatically and notify you of progress.
                  </p>
                  <Button
                    size="lg"
                    disabled={isSubmitting}
                    onClick={async () => {
                      if (onSubmit && selectedType) {
                        setIsSubmitting(true);
                        try {
                          const id = await onSubmit({
                            name: projectName || 'New Migration',
                            migrationType: selectedType,
                            connectionType,
                          });
                          if (id) {
                            setActiveMigrationId(id);
                          }
                        } finally {
                          setIsSubmitting(false);
                        }
                      } else {
                        setActiveMigrationId(`mig-${Date.now().toString(36)}`);
                      }
                    }}
                  >
                    <Rocket className="h-4 w-4" />
                    {isSubmitting ? 'Creating...' : 'Launch Migration'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1 || activeMigrationId !== null}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {currentStep < 6 && (
          <Button
            onClick={() => setCurrentStep(Math.min(6, currentStep + 1))}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Sub-Components ───────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────

const CONNECTION_TYPES = [
  { value: 'api', label: 'API', icon: Plug },
  { value: 'file_upload', label: 'File Upload', icon: Upload },
  { value: 'git', label: 'Git Repo', icon: GitIcon },
  { value: 'package', label: 'Package', icon: PackageIcon },
] as const;

function GitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6m0 6v6" />
      <path d="M5.636 5.636l4.243 4.243m4.242 4.242l4.243 4.243" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// ── Auto-Suggest ─────────────────────────────────────────────────────────

function suggestTargetField(sourceField: string): string {
  const lower = sourceField.toLowerCase().replace(/[\s_-]+/g, '_');

  const mapping: Record<string, string> = {
    title: 'title',
    name: 'name',
    full_name: 'name',
    description: 'description',
    desc: 'description',
    email: 'email',
    email_address: 'email',
    id: 'id',
    identifier: 'id',
    url: 'url',
    link: 'url',
    href: 'url',
    path: 'path',
    file_path: 'path',
    status: 'status',
    state: 'status',
    created: 'created_at',
    created_at: 'created_at',
    created_date: 'created_at',
    updated: 'updated_at',
    updated_at: 'updated_at',
    modified: 'updated_at',
    modified_at: 'updated_at',
    category: 'category',
    type: 'category',
    tags: 'tags',
    labels: 'tags',
    content: 'content',
    body: 'content',
    author: 'author',
    creator: 'author',
    metadata: 'metadata',
    meta: 'metadata',
  };

  return mapping[lower] ?? '';
}
