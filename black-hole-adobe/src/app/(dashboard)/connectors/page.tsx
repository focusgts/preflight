'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
  AlertCircle,
  Loader2,
  CloudCog,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ConnectorConfig, ApiResponse, PaginatedResponse } from '@/types';

// ── Connector type catalogue ───────────────────────────────────────────

const connectorTypes = [
  { id: 'aem', name: 'Adobe Experience Manager', icon: Server, color: 'from-red-500 to-orange-500', description: 'Connect to AEM 6.x on-prem or Managed Services', apiType: 'aem' as const },
  { id: 'aem-cloud', name: 'AEM Cloud Service', icon: CloudCog, color: 'from-red-400 to-pink-500', description: 'Connect to AEM as a Cloud Service (AEMaaCS)', apiType: 'aem-cloud' as const },
  { id: 'analytics', name: 'Adobe Analytics', icon: BarChart3, color: 'from-blue-500 to-cyan-500', description: 'Import report suites, segments, and configurations', apiType: 'analytics' as const },
  { id: 'campaign', name: 'Adobe Campaign', icon: Mail, color: 'from-violet-500 to-purple-500', description: 'Connect to Campaign Standard, Classic, or v8', apiType: 'campaign' as const },
  { id: 'aep', name: 'Adobe Experience Platform', icon: Database, color: 'from-emerald-500 to-teal-500', description: 'Extract schemas, datasets, and segments from AEP', apiType: 'aep' as const },
  { id: 'commerce', name: 'Adobe Commerce', icon: ShoppingCart, color: 'from-amber-500 to-yellow-500', description: 'Connect to Magento, Shopify, or SFCC', apiType: 'commerce' as const },
  { id: 'wordpress', name: 'WordPress', icon: Globe, color: 'from-sky-500 to-blue-500', description: 'Import content from WordPress via REST API', apiType: 'wordpress' as const },
  { id: 'ga', name: 'Google Analytics', icon: BarChart3, color: 'from-green-500 to-emerald-500', description: 'Import GA4 or Universal Analytics configuration', apiType: 'google-analytics' as const },
  { id: 'file', name: 'File Upload', icon: FileUp, color: 'from-slate-400 to-slate-500', description: 'Upload CSV, JSON, or XML data files', apiType: 'custom' as const },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function getTypeInfo(typeId: string) {
  return connectorTypes.find((t) => t.id === typeId || t.apiType === typeId);
}

function statusBadgeVariant(status: ConnectorConfig['status']): 'success' | 'error' | 'default' | 'warning' {
  switch (status) {
    case 'connected': return 'success';
    case 'error': return 'error';
    case 'testing': return 'warning';
    default: return 'default';
  }
}

function formatLastTested(iso: string | null): string {
  if (!iso) return 'Never tested';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── AEM Connect Result type ────────────────────────────────────────────

interface AemConnectResult {
  connected: boolean;
  environment: string;
  inventory: { pages: number; assets: number; components: number; workflows: number };
  capabilities: string[];
  unavailable: string[];
  latencyMs: number;
}

// ── AEM Connector Form ─────────────────────────────────────────────────

function AemConnectorForm({
  connectorType,
  onSaved,
  onCancel,
}: {
  connectorType: typeof connectorTypes[number];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');
  const [authType, setAuthType] = useState<'bearer' | 'basic'>('bearer');
  const [accessToken, setAccessToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AemConnectResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canTest =
    authorUrl.trim().length > 0 &&
    (authType === 'bearer' ? accessToken.trim().length > 0 : username.trim().length > 0 && password.trim().length > 0);

  const canSave = name.trim().length > 0 && canTest;

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch('/api/connectors/aem/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: authorUrl.trim(),
          authType,
          ...(authType === 'bearer' ? { accessToken: accessToken.trim() } : { username: username.trim(), password }),
        }),
      });
      const json = (await res.json()) as ApiResponse<AemConnectResult>;
      if (!json.success || !json.data) {
        setTestError(json.error?.message ?? 'Connection test failed');
      } else {
        setTestResult(json.data);
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: connectorType.apiType,
          name: name.trim(),
          connectionDetails: {
            baseUrl: authorUrl.trim(),
            authType,
            ...(authType === 'bearer' ? { accessToken: accessToken.trim() } : { username: username.trim(), password }),
          },
          capabilities: testResult?.capabilities ?? [],
        }),
      });
      const json = (await res.json()) as ApiResponse<ConnectorConfig>;
      if (!json.success) {
        setSaveError(json.error?.message ?? 'Failed to save connector');
      } else {
        onSaved();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br', connectorType.color)}>
              <connectorType.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connect {connectorType.name}</h3>
              <p className="text-xs text-slate-400">{connectorType.description}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Connector Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ACME AEM Production"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Author URL */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Author URL</label>
          <input
            type="url"
            value={authorUrl}
            onChange={(e) => setAuthorUrl(e.target.value)}
            placeholder="https://author-pXXXXX-eYYYYY.adobeaemcloud.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Auth Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Authentication</label>
          <select
            value={authType}
            onChange={(e) => setAuthType(e.target.value as 'bearer' | 'basic')}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
          </select>
        </div>

        {/* Credentials */}
        {authType === 'bearer' ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Access Token</label>
            <textarea
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your Local Development Token here"
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
        )}

        {/* Test Connection Button */}
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTest}
            loading={testing}
            disabled={!canTest}
          >
            <Plug className="mr-1.5 h-4 w-4" />
            Test Connection
          </Button>
          {testError && (
            <span className="flex items-center gap-1.5 text-xs text-rose-400">
              <XCircle className="h-3.5 w-3.5" />
              {testError}
            </span>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Connected successfully</span>
              <Badge variant="info">{testResult.environment}</Badge>
              <span className="ml-auto text-xs text-slate-500">{testResult.latencyMs}ms</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {([
                ['Pages', testResult.inventory.pages],
                ['Assets', testResult.inventory.assets],
                ['Components', testResult.inventory.components],
                ['Workflows', testResult.inventory.workflows],
              ] as const).map(([label, count]) => (
                <div key={label} className="rounded-md bg-slate-800/60 px-3 py-2 text-center">
                  <p className="text-lg font-semibold text-white">{count.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Save */}
        {saveError && (
          <p className="flex items-center gap-1.5 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {saveError}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!canSave}>
            Save Connector
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Generic Connector Form ─────────────────────────────────────────────

function GenericConnectorForm({
  connectorType,
  onSaved,
  onCancel,
}: {
  connectorType: typeof connectorTypes[number];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: connectorType.apiType,
          name: name.trim(),
          connectionDetails: {
            url: url.trim() || undefined,
            apiKey: apiKey.trim() || undefined,
          },
        }),
      });
      const json = (await res.json()) as ApiResponse<ConnectorConfig>;
      if (!json.success) {
        setSaveError(json.error?.message ?? 'Failed to save connector');
      } else {
        onSaved();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br', connectorType.color)}>
              <connectorType.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connect {connectorType.name}</h3>
              <p className="text-xs text-slate-400">{connectorType.description}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Connector Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. My ${connectorType.name}`}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Endpoint URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">API Key / Token</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {saveError && (
          <p className="flex items-center gap-1.5 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {saveError}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!name.trim()}>
            Save Connector
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const [showAddNew, setShowAddNew] = useState(false);
  const [selectedType, setSelectedType] = useState<typeof connectorTypes[number] | null>(null);

  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/connectors');
      const json = (await res.json()) as PaginatedResponse<ConnectorConfig>;
      if (!json.success || !json.data) {
        setFetchError(json.error?.message ?? 'Failed to load connectors');
        setConnectors([]);
      } else {
        setConnectors(json.data);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Network error');
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  function handleTypeSelected(type: typeof connectorTypes[number]) {
    setSelectedType(type);
    setShowAddNew(false);
  }

  function handleFormSaved() {
    setSelectedType(null);
    fetchConnectors();
  }

  function handleFormCancel() {
    setSelectedType(null);
  }

  async function handleTestConnector(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/connectors/${id}/test`, { method: 'POST' });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (json.success) {
        // Refresh list so status updates are visible
        await fetchConnectors();
      }
    } catch {
      // Silently handled — user can retry
    } finally {
      setTestingId(null);
    }
  }

  // Determine if selected type is AEM
  const isAemType = selectedType?.id === 'aem' || selectedType?.id === 'aem-cloud';

  return (
    <div className="space-y-6">
      {/* Header */}
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
        <Button onClick={() => { setShowAddNew(!showAddNew); setSelectedType(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Connector
        </Button>
      </motion.div>

      {/* Connector Type Picker */}
      <AnimatePresence>
        {showAddNew && !selectedType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card header={<h3 className="text-base font-semibold text-white">Select Connector Type</h3>}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {connectorTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelected(type)}
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
      </AnimatePresence>

      {/* Connector Creation Form */}
      <AnimatePresence>
        {selectedType && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {isAemType ? (
              <AemConnectorForm
                connectorType={selectedType}
                onSaved={handleFormSaved}
                onCancel={handleFormCancel}
              />
            ) : (
              <GenericConnectorForm
                connectorType={selectedType}
                onSaved={handleFormSaved}
                onCancel={handleFormCancel}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {fetchError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-300">{fetchError}</p>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchConnectors}>
            Retry
          </Button>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-800 bg-slate-900/80"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && connectors.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16"
        >
          <Plug className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No connectors configured.</p>
          <p className="mt-1 text-xs text-slate-500">Add your first connector to get started.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setShowAddNew(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Connector
          </Button>
        </motion.div>
      )}

      {/* Connector list */}
      {!loading && connectors.length > 0 && (
        <div className="space-y-3">
          {connectors.map((connector, i) => {
            const typeInfo = getTypeInfo(connector.type);
            const isTesting = testingId === connector.id;
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
                        {typeInfo ? <typeInfo.icon className="h-5 w-5 text-white" /> : <Plug className="h-5 w-5 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{connector.name}</p>
                        <p className="text-xs text-slate-400">
                          {(connector.connectionDetails.baseUrl as string) ??
                            (connector.connectionDetails.url as string) ??
                            connector.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          {connector.status === 'connected' ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          ) : connector.status === 'error' ? (
                            <XCircle className="h-4 w-4 text-rose-400" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-slate-600" />
                          )}
                          <Badge variant={statusBadgeVariant(connector.status)}>
                            {connector.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatLastTested(connector.lastTestedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnector(connector.id)}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
