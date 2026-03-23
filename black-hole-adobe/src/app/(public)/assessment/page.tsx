'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';

const aemVersionOptions = [
  { value: '', label: 'Select AEM Version' },
  { value: '6.5', label: 'AEM 6.5' },
  { value: '6.4', label: 'AEM 6.4' },
  { value: '6.3', label: 'AEM 6.3 or older' },
  { value: 'ams', label: 'AEM as Managed Service' },
  { value: 'cloud', label: 'AEM Cloud Service (upgrade)' },
  { value: 'other', label: 'Other / Not Sure' },
];

const companySizeOptions = [
  { value: '', label: 'Select Company Size' },
  { value: '1-50', label: '1-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1,000 employees' },
  { value: '1001-5000', label: '1,001-5,000 employees' },
  { value: '5000+', label: '5,000+ employees' },
];

const reportFeatures = [
  '9-page readiness report (PDF)',
  'Code compatibility score',
  'Content health analysis',
  'Integration dependency map',
  'Risk factor identification',
  'Timeline & cost comparison',
  'Actionable recommendations',
];

interface FormState {
  name: string;
  email: string;
  company: string;
  phone: string;
  aemVersion: string;
  numSites: string;
  companySize: string;
  gdpr: boolean;
  hipaa: boolean;
  pci: boolean;
  fedramp: boolean;
}

export default function AssessmentPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    company: '',
    phone: '',
    aemVersion: '',
    numSites: '',
    companySize: '',
    gdpr: false,
    hipaa: false,
    pci: false,
    fedramp: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function update(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.company) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const compliance = [];
      if (form.gdpr) compliance.push('GDPR');
      if (form.hipaa) compliance.push('HIPAA');
      if (form.pci) compliance.push('PCI-DSS');
      if (form.fedramp) compliance.push('FedRAMP');

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          phone: form.phone || null,
          aemVersion: form.aemVersion,
          numSites: form.numSites ? Number(form.numSites) : null,
          companySize: form.companySize,
          compliance,
          source: 'assessment-page',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Something went wrong');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24">
        <div className="max-w-lg rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Assessment Started!</h2>
          <p className="text-slate-400">
            We&apos;ve started analyzing your environment. Check your email at{' '}
            <span className="text-white">{form.email}</span> for confirmation.
            Your full 9-page readiness report will be delivered within 24 hours.
          </p>
          <a href="/" className="mt-6 inline-block text-sm text-violet-400 hover:text-violet-300">
            Back to homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-28">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            Get Your Free{' '}
            <span className="text-gradient">AEM Migration Assessment</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Our AI analyzes your entire AEM environment and delivers a comprehensive
            readiness report in 24 hours. No commitments, no credit card.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-5">
          {/* Left - What you get */}
          <div className="lg:col-span-2">
            <h3 className="mb-6 text-xl font-semibold text-white">
              What You&apos;ll Receive
            </h3>
            <ul className="space-y-4">
              {reportFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20">
                    <svg className="h-3 w-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Sample report preview */}
            <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-3 flex items-center gap-2">
                <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="text-sm font-medium text-white">Sample Report Preview</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Overall Readiness</span>
                  <span className="text-emerald-400">78/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Code Compatibility</span>
                  <span className="text-amber-400">62/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Content Health</span>
                  <span className="text-emerald-400">91/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-[91%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                </div>
              </div>
            </div>

            {/* Social proof */}
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-slate-700 text-[10px] text-slate-300">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span className="text-sm text-violet-300">
                <strong>47 assessments</strong> completed this month
              </span>
            </div>
          </div>

          {/* Right - Form */}
          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur-sm"
            >
              <h3 className="mb-6 text-xl font-semibold text-white">Start Your Assessment</h3>

              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Full Name *"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
                <Input
                  label="Work Email *"
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
                <Input
                  label="Company *"
                  placeholder="Acme Corp"
                  value={form.company}
                  onChange={(e) => update('company', e.target.value)}
                />
                <Input
                  label="Phone (Optional)"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
                <Select
                  label="AEM Version"
                  options={aemVersionOptions}
                  value={form.aemVersion}
                  onChange={(e) => update('aemVersion', e.target.value)}
                />
                <Input
                  label="Number of Sites"
                  type="number"
                  placeholder="e.g. 12"
                  min={1}
                  value={form.numSites}
                  onChange={(e) => update('numSites', e.target.value)}
                />
                <div className="sm:col-span-2">
                  <Select
                    label="Company Size"
                    options={companySizeOptions}
                    value={form.companySize}
                    onChange={(e) => update('companySize', e.target.value)}
                  />
                </div>
              </div>

              {/* Compliance */}
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Compliance Requirements
                </label>
                <div className="flex flex-wrap gap-4">
                  {(['gdpr', 'hipaa', 'pci', 'fedramp'] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => update(key, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500"
                      />
                      {key === 'pci' ? 'PCI-DSS' : key === 'fedramp' ? 'FedRAMP' : key.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-400">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                loading={submitting}
                className="mt-6 w-full text-base"
              >
                Start Assessment
              </Button>

              <p className="mt-3 text-center text-xs text-slate-500">
                No credit card required. Results delivered within 24 hours.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
