'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Rocket, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { MigrationTypeCards } from './migration-type-cards';
import { MigrationType } from '@/types';

const steps = [
  { id: 1, label: 'Select Type' },
  { id: 2, label: 'Connect Source' },
  { id: 3, label: 'Configure' },
  { id: 4, label: 'Review' },
  { id: 5, label: 'Launch' },
];

export function MigrationWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState<MigrationType | null>(null);
  const [projectName, setProjectName] = useState('');

  function canProceed(): boolean {
    if (currentStep === 1) return selectedType !== null;
    if (currentStep === 2) return projectName.length > 0;
    return true;
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
          {currentStep === 1 && (
            <div>
              <h2 className="mb-2 text-xl font-semibold text-white">Select Migration Type</h2>
              <p className="mb-6 text-sm text-slate-400">
                Choose the type of migration you want to perform.
              </p>
              <MigrationTypeCards selected={selectedType} onSelect={setSelectedType} />
            </div>
          )}

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
                <Input
                  label="Source URL"
                  placeholder="https://author.example.com"
                  type="url"
                />
                <Select
                  label="Connection Type"
                  options={[
                    { value: 'api', label: 'API Connection' },
                    { value: 'git', label: 'Git Repository' },
                    { value: 'file_upload', label: 'File Upload' },
                    { value: 'package', label: 'Package Import' },
                  ]}
                />
                <Select
                  label="Authentication Method"
                  options={[
                    { value: 'oauth_s2s', label: 'OAuth Server-to-Server' },
                    { value: 'api_key', label: 'API Key' },
                    { value: 'basic', label: 'Basic Auth' },
                  ]}
                />
              </div>
            </Card>
          )}

          {currentStep === 3 && (
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

          {currentStep === 4 && (
            <Card padding="lg">
              <h2 className="mb-2 text-xl font-semibold text-white">Review Configuration</h2>
              <p className="mb-6 text-sm text-slate-400">
                Confirm your migration settings before launching.
              </p>
              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                <ReviewRow label="Project" value={projectName || 'New Migration'} />
                <ReviewRow label="Type" value={selectedType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Not selected'} />
                <ReviewRow label="Strategy" value="Full Migration" />
                <ReviewRow label="Target" value="Production" />
                <ReviewRow label="Estimated Duration" value="6-8 weeks" />
                <ReviewRow label="Estimated Cost" value="$45,000" />
              </div>
            </Card>
          )}

          {currentStep === 5 && (
            <Card padding="lg">
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
                <Button size="lg">
                  <Rocket className="h-4 w-4" />
                  Launch Migration
                </Button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {currentStep < 5 && (
          <Button
            onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
