'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Key,
  Bell,
  Shield,
  Palette,
  Globe,
} from 'lucide-react';

const sections = [
  {
    id: 'profile',
    icon: User,
    title: 'Organization Profile',
    description: 'Manage your organization details and branding.',
    fields: [
      { label: 'Organization Name', value: 'ACME Corporation', type: 'text' as const },
      { label: 'Admin Email', value: 'admin@acme.com', type: 'email' as const },
      { label: 'Industry', value: 'Financial Services', type: 'text' as const },
    ],
  },
  {
    id: 'credentials',
    icon: Key,
    title: 'Adobe Credentials',
    description: 'Configure OAuth Server-to-Server credentials for Adobe API access.',
    fields: [
      { label: 'IMS Organization ID', value: '1234567890ABCDEF@AdobeOrg', type: 'text' as const },
      { label: 'Client ID', value: '••••••••••••••••', type: 'password' as const },
      { label: 'Client Secret', value: '••••••••••••••••', type: 'password' as const },
    ],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Configure alerts for migration progress and issues.',
    fields: [
      { label: 'Email Notifications', value: 'Enabled', type: 'text' as const },
      { label: 'Slack Webhook URL', value: 'https://hooks.slack.com/...', type: 'text' as const },
    ],
  },
  {
    id: 'compliance',
    icon: Shield,
    title: 'Compliance Settings',
    description: 'Configure compliance frameworks and data residency.',
    fields: [
      { label: 'Active Frameworks', value: 'GDPR, CCPA, SOX', type: 'text' as const },
      { label: 'Data Residency Region', value: 'US-West (Azure)', type: 'text' as const },
      { label: 'PII Auto-Detection', value: 'Enabled', type: 'text' as const },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure your Black Hole platform and integrations.
        </p>
      </motion.div>

      <div className="space-y-4">
        {sections.map((section, i) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              header={
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                    <section.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{section.title}</h3>
                    <p className="text-xs text-slate-400">{section.description}</p>
                  </div>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((field) => (
                  <Input
                    key={field.label}
                    label={field.label}
                    type={field.type}
                    defaultValue={field.value}
                  />
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm">Save Changes</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
