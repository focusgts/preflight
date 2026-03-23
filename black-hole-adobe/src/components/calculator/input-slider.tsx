'use client';

import { cn } from '@/lib/utils/cn';

interface InputSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  className?: string;
}

export function InputSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  className,
}: InputSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const displayValue = formatValue ? formatValue(value) : value.toLocaleString();

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="rounded-md bg-violet-500/10 px-2.5 py-0.5 text-sm font-semibold text-violet-300">
          {displayValue}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="calc-slider w-full cursor-pointer appearance-none bg-transparent"
        />
        {/* Gradient track fill */}
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
          style={{ width: `${percent}%` }}
        />
        {/* Track background */}
        <div className="pointer-events-none absolute left-0 top-1/2 -z-10 h-2 w-full -translate-y-1/2 rounded-full bg-slate-700" />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{formatValue ? formatValue(min) : min.toLocaleString()}</span>
        <span>{formatValue ? formatValue(max) : max.toLocaleString()}</span>
      </div>

      <style jsx>{`
        .calc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.2);
          cursor: pointer;
          position: relative;
          z-index: 10;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .calc-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 14px rgba(139, 92, 246, 0.7), 0 0 28px rgba(139, 92, 246, 0.3);
        }
        .calc-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
          cursor: pointer;
        }
        .calc-slider::-webkit-slider-runnable-track {
          height: 8px;
          background: transparent;
          border-radius: 4px;
        }
        .calc-slider::-moz-range-track {
          height: 8px;
          background: #334155;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
