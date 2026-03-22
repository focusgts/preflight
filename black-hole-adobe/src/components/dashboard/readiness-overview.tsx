'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/score-ring';

interface ReadinessItem {
  product: string;
  score: number;
}

interface ReadinessOverviewProps {
  scores: ReadinessItem[];
}

export function ReadinessOverview({ scores }: ReadinessOverviewProps) {
  return (
    <Card
      header={
        <div>
          <h3 className="text-base font-semibold text-white">Readiness by Product</h3>
          <p className="text-sm text-slate-400">Migration readiness scores across Adobe products</p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {scores.map((item, i) => (
          <motion.div
            key={item.product}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="flex flex-col items-center"
          >
            <ScoreRing score={item.score} size={90} strokeWidth={6} />
            <p className="mt-2 text-center text-xs font-medium text-slate-300">
              {item.product}
            </p>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
