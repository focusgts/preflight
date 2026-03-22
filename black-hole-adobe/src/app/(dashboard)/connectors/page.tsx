'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plug,
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Server,
  BarChart3,
  Mail,
  Database,
  ShoppingCart,
  Globe,
  FileUp,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const connectorTypes = [
  { id: 'aem', name: 'Adobe Experience Manager', icon: Server, color: 'from-red-500 to-orange-500', description: 'Connect to AEM 6.x on-prem or Managed Services' },
  { id: 'analytics', name: 'Adobe Analytics', icon: BarChart3, color: 'from-blue-500 to-cyan-500', description: 'Import report suites, segments, and configurations' },
  { id: 'campaign', name: 'Adobe Campaign', icon: Mail, color: 'from-violet-500 to-purple-500', description: 'Connect to Campaign Standard, Classic, or v8' },
  { id: 'aep', name: 'Adobe Experience Platform', icon: Database, color: 'from-emerald-500 to-teal-500', description: 'Extract schemas, datasets, and segments from AEP' },
  { id: 'commerce', name: 'Adobe Commerce', icon: ShoppingCart, color: 'from-amber-500 to-yellow-500', description: 'Connect to Magento, Shopify, or SFCC' },
  { id: 'wordpress', name: 'WordPress', icon: Globe, color: 'from-sky-500 to-blue-500', description: 'Import content from WordPress via REST API' },
  { id: 'ga', name: 'Google Analytics', icon: BarChart3, color: 'from-green-500 to-emerald-500', description: 'Import GA4 or Universal Analytics configuration' },
  { id: 'file', name: 'File Upload', icon: FileUp, color: 'from-slate-400 to-slate-500', description: 'Upload CSV, JSON, or XML data files' },
];

const existingConnectors = [
  { id: '1', name: 'ACME AEM Production', type: 'aem', status: 'connected' as const, lastTested: '2 hours ago', url: 'https://author.acme.com' },
  { id: '2', name: 'ACME Analytics', type: 'analytics', status: 'connected' as const, lastTested: '1 hour ago', url: 'analytics.adobe.io' },
  { id: '3', name: 'ACME Campaign Classic', type: 'campaign', status: 'error' as const, lastTested: '3 hours ago', url: 'https://campaign.acme.com' },
  { id: '4', name: 'GlobalRetail WordPress', type: 'wordpress', status: 'connected' as const, lastTested: '30 minutes ago', url: 'https://globalretail.com/wp-json' },
];

export default function ConnectorsPage() {
  const [showAddNew, setShowAddNew] = useState(false);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Connectors</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage source and target system connections for migrations.
          </p>
        </div>
        <Button onClick={() => setShowAddNew(!showAddNew)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Connector
        </Button>
      </motion.div>

      {showAddNew && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <Card header={<h3 className="text-base font-semibold text-white">Select Connector Type</h3>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {connectorTypes.map((type) => (
                <button
                  key={type.id}
                  className="group flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 text-left transition-all hover:border-violet-500/50 hover:bg-slate-800"
                >
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br', type.color)}>
                    <type.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{type.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      <div className="space-y-3">
        {existingConnectors.map((connector, i) => {
          const typeInfo = connectorTypes.find((t) => t.id === connector.type);
          return (
            <motion.div
              key={connector.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br', typeInfo?.color ?? 'from-slate-500 to-slate-600')}>
                      {typeInfo && <typeInfo.icon className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{connector.name}</p>
                      <p className="text-xs text-slate-400">{connector.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        {connector.status === 'connected' ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400" />
                        )}
                        <Badge variant={connector.status === 'connected' ? 'success' : 'error'}>
                          {connector.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Tested {connector.lastTested}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
