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

interface FormState {
  name: string;
  email: string;
  company: string;
  aemVersion: string;
  numSites: number;
}

export function CTAForm() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    company: '',
    aemVersion: '',
    numSites: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function update(field: keyof FormState, value: string | number) {
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
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          aemVersion: form.aemVersion,
          numSites: form.numSites,
          source: 'landing-cta',
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
      <section id="cta-form" className="px-4 py-24">
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mb-2 text-2xl font-bold text-white">Assessment Started!</h3>
          <p className="text-slate-400">
            Check your email at <span className="text-white">{form.email}</span> for confirmation.
            You&apos;ll receive your full readiness report within 24 hours.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="cta-form" className="px-4 py-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Get Your <span className="text-gradient">Free Assessment</span>
          </h2>
          <p className="text-lg text-slate-400">
            No credit card required. Full readiness report in 24 hours.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur-sm"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Name *"
              placeholder="Jane Smith"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
            <Input
              label="Email *"
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
            <Select
              label="AEM Version"
              options={aemVersionOptions}
              value={form.aemVersion}
              onChange={(e) => update('aemVersion', e.target.value)}
            />
          </div>

          {/* Sites slider */}
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Number of Sites: <span className="text-white">{form.numSites}</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={form.numSites}
              onChange={(e) => update('numSites', Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100+</span>
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
            Start Free Assessment
          </Button>

          <p className="mt-3 text-center text-xs text-slate-500">
            No credit card required. Results in 24 hours.
          </p>
        </form>
      </div>
    </section>
  );
}
