'use client';

import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  header?: ReactNode;
  gradient?: boolean;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  header,
  gradient = false,
  hover = false,
  padding = 'md',
  className,
  ...props
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm',
        hover && 'transition-all duration-200 hover:border-slate-700 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-violet-500/5',
        gradient && 'border-transparent bg-gradient-to-b from-slate-800 to-slate-900 p-[1px]',
        className
      )}
      {...props}
    >
      {gradient ? (
        <div className={cn('rounded-[11px] bg-slate-900/95 h-full', paddingMap[padding])}>
          {header && (
            <div className="mb-4 border-b border-slate-800 pb-4">
              {header}
            </div>
          )}
          {children}
        </div>
      ) : (
        <div className={cn(paddingMap[padding])}>
          {header && (
            <div className="mb-4 border-b border-slate-800 pb-4">
              {header}
            </div>
          )}
          {children}
        </div>
      )}
    </motion.div>
  );
}
