/**
 * React-PDF Chart Components
 *
 * Custom chart components built entirely with @react-pdf/renderer
 * primitives (View, Text). These render as styled rectangles since
 * React-PDF does not support SVG chart libraries like recharts.
 */

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

// ============================================================
// Shared Styles
// ============================================================

const colors = {
  violet: '#7C3AED',
  cyan: '#06B6D4',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F43F5E',
  blue: '#3B82F6',
  slate: {
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
};

function scoreColor(score: number): string {
  if (score >= 80) return colors.emerald;
  if (score >= 60) return colors.blue;
  if (score >= 40) return colors.amber;
  return colors.rose;
}

// ============================================================
// ScoreBar
// ============================================================

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore?: number;
}

const scoreBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    width: 160,
    fontSize: 9,
    color: '#334155',
    fontFamily: 'Helvetica',
  },
  track: {
    flex: 1,
    height: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: 16,
    borderRadius: 4,
  },
  scoreText: {
    width: 36,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    color: '#1E293B',
  },
});

export function ScoreBar({ label, score, maxScore = 100 }: ScoreBarProps) {
  const widthPercent = Math.min((score / maxScore) * 100, 100);
  const barColor = scoreColor(score);

  return (
    <View style={scoreBarStyles.row}>
      <Text style={scoreBarStyles.label}>{label}</Text>
      <View style={scoreBarStyles.track}>
        <View
          style={[
            scoreBarStyles.fill,
            { width: `${widthPercent}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={scoreBarStyles.scoreText}>{Math.round(score)}</Text>
    </View>
  );
}

// ============================================================
// ComparisonChart
// ============================================================

interface ComparisonChartProps {
  items: Array<{
    label: string;
    traditional: number;
    blackHole: number;
  }>;
  unit?: string;
  formatValue?: (val: number) => string;
}

const compStyles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  itemRow: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 8,
    color: '#475569',
    fontFamily: 'Helvetica',
  },
  barContainer: {
    marginBottom: 3,
  },
  barLabel: {
    fontSize: 7,
    color: '#94A3B8',
    fontFamily: 'Helvetica',
    marginBottom: 2,
  },
  track: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  traditionalBar: {
    height: 12,
    backgroundColor: '#94A3B8',
    borderRadius: 3,
  },
  blackHoleBar: {
    height: 12,
    borderRadius: 3,
  },
  valueText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
});

export function ComparisonChart({
  items,
  unit = '',
  formatValue,
}: ComparisonChartProps) {
  const maxVal = Math.max(
    ...items.flatMap((i) => [i.traditional, i.blackHole]),
    1,
  );
  const fmt = formatValue ?? ((v: number) => `${v}${unit}`);

  return (
    <View style={compStyles.container}>
      {items.map((item, idx) => (
        <View key={idx} style={compStyles.itemRow}>
          <View style={compStyles.labelRow}>
            <Text style={compStyles.label}>{item.label}</Text>
          </View>
          <View style={compStyles.barContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={compStyles.barLabel}>Traditional</Text>
              <Text style={compStyles.valueText}>{fmt(item.traditional)}</Text>
            </View>
            <View style={compStyles.track}>
              <View
                style={[
                  compStyles.traditionalBar,
                  { width: `${(item.traditional / maxVal) * 100}%` },
                ]}
              />
            </View>
          </View>
          <View style={[compStyles.barContainer, { marginTop: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={compStyles.barLabel}>Black Hole</Text>
              <Text style={[compStyles.valueText, { color: colors.violet }]}>
                {fmt(item.blackHole)}
              </Text>
            </View>
            <View style={compStyles.track}>
              <View
                style={[
                  compStyles.blackHoleBar,
                  {
                    width: `${(item.blackHole / maxVal) * 100}%`,
                    backgroundColor: colors.violet,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// SeverityDistribution
// ============================================================

interface SeverityDistributionProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const sevStyles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  barRow: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    color: '#475569',
    fontFamily: 'Helvetica',
  },
});

export function SeverityDistribution({
  critical,
  high,
  medium,
  low,
}: SeverityDistributionProps) {
  const total = critical + high + medium + low;
  if (total === 0) {
    return (
      <View style={sevStyles.container}>
        <Text style={{ fontSize: 9, color: colors.slate[500] }}>
          No findings detected
        </Text>
      </View>
    );
  }

  const segments = [
    { count: critical, color: colors.rose, label: 'Critical' },
    { count: high, color: colors.amber, label: 'High' },
    { count: medium, color: colors.blue, label: 'Medium' },
    { count: low, color: colors.emerald, label: 'Low' },
  ].filter((s) => s.count > 0);

  return (
    <View style={sevStyles.container}>
      <View style={sevStyles.barRow}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={{
              width: `${(seg.count / total) * 100}%`,
              height: 24,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </View>
      <View style={sevStyles.legendRow}>
        {segments.map((seg, i) => (
          <View key={i} style={sevStyles.legendItem}>
            <View
              style={[sevStyles.legendDot, { backgroundColor: seg.color }]}
            />
            <Text style={sevStyles.legendText}>
              {seg.label}: {seg.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// PhaseTimeline
// ============================================================

interface PhaseTimelineProps {
  phases: Array<{
    name: string;
    traditionalWeeks: number;
    blackHoleWeeks: number;
  }>;
}

const phaseStyles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 28,
  },
  phaseName: {
    width: 130,
    fontSize: 8,
    color: '#334155',
    fontFamily: 'Helvetica',
  },
  barsColumn: {
    flex: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  miniLabel: {
    width: 55,
    fontSize: 6,
    color: '#94A3B8',
    fontFamily: 'Helvetica',
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  traditionalFill: {
    height: 8,
    backgroundColor: '#94A3B8',
    borderRadius: 2,
  },
  blackHoleFill: {
    height: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  weeksText: {
    width: 40,
    fontSize: 7,
    fontFamily: 'Helvetica',
    textAlign: 'right',
    color: '#475569',
  },
});

export function PhaseTimeline({ phases }: PhaseTimelineProps) {
  const maxWeeks = Math.max(
    ...phases.map((p) => Math.max(p.traditionalWeeks, p.blackHoleWeeks)),
    1,
  );

  return (
    <View style={phaseStyles.container}>
      {phases.map((phase, idx) => (
        <View key={idx} style={phaseStyles.row}>
          <Text style={phaseStyles.phaseName}>{phase.name}</Text>
          <View style={phaseStyles.barsColumn}>
            <View style={phaseStyles.barRow}>
              <Text style={phaseStyles.miniLabel}>Traditional</Text>
              <View style={phaseStyles.track}>
                <View
                  style={[
                    phaseStyles.traditionalFill,
                    {
                      width: `${(phase.traditionalWeeks / maxWeeks) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={phaseStyles.weeksText}>
                {phase.traditionalWeeks.toFixed(1)}w
              </Text>
            </View>
            <View style={phaseStyles.barRow}>
              <Text style={phaseStyles.miniLabel}>Black Hole</Text>
              <View style={phaseStyles.track}>
                <View
                  style={[
                    phaseStyles.blackHoleFill,
                    {
                      width: `${(phase.blackHoleWeeks / maxWeeks) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[phaseStyles.weeksText, { color: colors.violet }]}>
                {phase.blackHoleWeeks.toFixed(1)}w
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// ScoreGauge — large overall score display
// ============================================================

interface ScoreGaugeProps {
  score: number;
  label: string;
}

const gaugeStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
  },
  scoreUnit: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Helvetica',
    marginTop: -2,
  },
  label: {
    fontSize: 10,
    color: '#475569',
    fontFamily: 'Helvetica',
    marginTop: 8,
  },
});

export function ScoreGauge({ score, label }: ScoreGaugeProps) {
  const color = scoreColor(score);

  return (
    <View style={gaugeStyles.container}>
      <View
        style={[
          gaugeStyles.scoreCircle,
          { borderColor: color },
        ]}
      >
        <Text style={[gaugeStyles.scoreText, { color }]}>
          {Math.round(score)}
        </Text>
        <Text style={gaugeStyles.scoreUnit}>/100</Text>
      </View>
      <Text style={gaugeStyles.label}>{label}</Text>
    </View>
  );
}
