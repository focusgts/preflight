'use client';

import { motion } from 'framer-motion';
import {
  Globe,
  BarChart3,
  Mail,
  Database,
  ShoppingCart,
  Image,
  Target,
  Users,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { MigrationType } from '@/types';

interface MigrationTypeOption {
  type: MigrationType;
  title: string;
  description: string;
  icon: React.ElementType;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedWeeks: string;
  category: string;
}

const migrationTypes: MigrationTypeOption[] = [
  {
    type: MigrationType.AEM_ONPREM_TO_CLOUD,
    title: 'AEM On-Prem to Cloud',
    description: 'Migrate AEM 6.x on-premise instances to AEM as a Cloud Service.',
    icon: Globe,
    complexity: 'High',
    estimatedWeeks: '6-12 weeks',
    category: 'Content Management',
  },
  {
    type: MigrationType.WORDPRESS_TO_AEM,
    title: 'WordPress to AEM',
    description: 'Migrate WordPress sites to AEM Sites or Edge Delivery Services.',
    icon: Globe,
    complexity: 'Medium',
    estimatedWeeks: '4-8 weeks',
    category: 'Content Management',
  },
  {
    type: MigrationType.GA_TO_CJA,
    title: 'GA4 to Customer Journey Analytics',
    description: 'Migrate Google Analytics properties to Adobe CJA with full data mapping.',
    icon: BarChart3,
    complexity: 'Medium',
    estimatedWeeks: '3-5 weeks',
    category: 'Analytics',
  },
  {
    type: MigrationType.CAMPAIGN_CLASSIC_TO_V8,
    title: 'Campaign Classic to v8',
    description: 'Upgrade Campaign Classic to v8 with Snowflake FDA architecture.',
    icon: Mail,
    complexity: 'High',
    estimatedWeeks: '5-10 weeks',
    category: 'Marketing Automation',
  },
  {
    type: MigrationType.AAM_TO_RTCDP,
    title: 'AAM to Real-Time CDP',
    description: 'Migrate Audience Manager segments and traits to Real-Time CDP.',
    icon: Users,
    complexity: 'Medium',
    estimatedWeeks: '3-6 weeks',
    category: 'Data Platform',
  },
  {
    type: MigrationType.SHOPIFY_TO_COMMERCE,
    title: 'Shopify to Adobe Commerce',
    description: 'Migrate Shopify stores to Adobe Commerce with full catalog transfer.',
    icon: ShoppingCart,
    complexity: 'High',
    estimatedWeeks: '8-14 weeks',
    category: 'Commerce',
  },
  {
    type: MigrationType.DAM_TO_AEM_ASSETS,
    title: 'DAM to AEM Assets',
    description: 'Consolidate external DAM platforms into AEM Assets Cloud Service.',
    icon: Image,
    complexity: 'Medium',
    estimatedWeeks: '4-8 weeks',
    category: 'Digital Assets',
  },
  {
    type: MigrationType.OPTIMIZELY_TO_TARGET,
    title: 'Optimizely to Adobe Target',
    description: 'Migrate A/B tests and personalization from Optimizely to Adobe Target.',
    icon: Target,
    complexity: 'Low',
    estimatedWeeks: '2-4 weeks',
    category: 'Personalization',
  },
  {
    type: MigrationType.HUBSPOT_TO_MARKETO,
    title: 'HubSpot to Marketo Engage',
    description: 'Migrate marketing automation workflows from HubSpot to Marketo.',
    icon: Database,
    complexity: 'Medium',
    estimatedWeeks: '4-7 weeks',
    category: 'Marketing Automation',
  },
];

const complexityVariant: Record<string, 'success' | 'warning' | 'error'> = {
  Low: 'success',
  Medium: 'warning',
  High: 'error',
};

interface MigrationTypeCardsProps {
  selected: MigrationType | null;
  onSelect: (type: MigrationType) => void;
}

export function MigrationTypeCards({ selected, onSelect }: MigrationTypeCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {migrationTypes.map((mt, i) => {
        const isSelected = selected === mt.type;
        return (
          <motion.button
            key={mt.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(mt.type)}
            className={cn(
              'group relative rounded-xl border p-5 text-left transition-all duration-200',
              isSelected
                ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/60'
            )}
          >
            {isSelected && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <div className={cn(
              'mb-3 inline-flex rounded-lg p-2.5',
              isSelected ? 'bg-violet-500/20' : 'bg-slate-800'
            )}>
              <mt.icon className={cn(
                'h-5 w-5',
                isSelected ? 'text-violet-400' : 'text-slate-400'
              )} />
            </div>
            <p className="text-xs font-medium text-slate-500">{mt.category}</p>
            <h4 className="mt-1 text-sm font-semibold text-white">{mt.title}</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{mt.description}</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant={complexityVariant[mt.complexity]}>{mt.complexity}</Badge>
              <span className="text-xs text-slate-500">{mt.estimatedWeeks}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
