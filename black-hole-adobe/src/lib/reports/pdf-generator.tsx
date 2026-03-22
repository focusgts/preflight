/**
 * PDF Report Generator
 *
 * Generates a premium, branded Migration Readiness Assessment PDF
 * using @react-pdf/renderer. This is the sales-closing document
 * handed to prospects after a free assessment.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { AssessmentResult, MigrationProject } from '@/types';
import { prepareReportData, formatCurrency } from './report-data';
import type { ReportData } from './report-data';
import {
  ScoreBar,
  ScoreGauge,
  SeverityDistribution,
  ComparisonChart,
  PhaseTimeline,
} from './charts';

// ============================================================
// Brand Colors
// ============================================================

const brand = {
  violet: '#7C3AED',
  violetDark: '#5B21B6',
  cyan: '#06B6D4',
  white: '#FFFFFF',
  offWhite: '#F8FAFC',
  dark: '#0F172A',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  rose: '#F43F5E',
  amber: '#F59E0B',
  emerald: '#10B981',
  blue: '#3B82F6',
};

// ============================================================
// Shared Styles
// ============================================================

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: brand.slate700,
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    backgroundColor: brand.white,
  },
  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: brand.dark,
    color: brand.white,
    padding: 0,
    position: 'relative',
  },
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverBrand: {
    fontSize: 12,
    fontFamily: 'Helvetica',
    letterSpacing: 4,
    color: brand.violet,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: brand.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: brand.slate400,
    textAlign: 'center',
    marginBottom: 40,
  },
  coverDivider: {
    width: 80,
    height: 3,
    backgroundColor: brand.violet,
    marginBottom: 40,
  },
  coverMeta: {
    alignItems: 'center',
  },
  coverOrg: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: brand.white,
    marginBottom: 6,
  },
  coverDate: {
    fontSize: 11,
    color: brand.slate400,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 60,
    right: 60,
    alignItems: 'center',
  },
  coverFooterText: {
    fontSize: 8,
    color: brand.slate500,
    textAlign: 'center',
  },
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: brand.violet,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: brand.slate900,
  },
  sectionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brand.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionNumberText: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: brand.white,
  },
  // Cards
  card: {
    backgroundColor: brand.offWhite,
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: brand.slate200,
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: brand.slate800,
    marginBottom: 8,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: brand.offWhite,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: brand.slate200,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 7,
    color: brand.slate500,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Body text
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: brand.slate600,
    marginBottom: 8,
  },
  // Page footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: brand.slate200,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: brand.slate400,
  },
  footerPage: {
    fontSize: 7,
    color: brand.slate500,
    fontFamily: 'Helvetica-Bold',
  },
  // Table styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: brand.slate800,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: brand.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: brand.slate100,
  },
  tableRowAlt: {
    backgroundColor: brand.offWhite,
  },
  tableCell: {
    fontSize: 8,
    color: brand.slate700,
  },
  // Severity badges
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  severityText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: brand.white,
    textTransform: 'uppercase',
  },
  // Highlight box
  highlightBox: {
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: brand.violet,
  },
  highlightTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: brand.violetDark,
    marginBottom: 4,
  },
  highlightText: {
    fontSize: 9,
    color: brand.slate700,
    lineHeight: 1.5,
  },
  // Savings callout
  savingsBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
  },
  savingsValue: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: brand.emerald,
  },
  savingsLabel: {
    fontSize: 9,
    color: brand.slate600,
    marginTop: 2,
  },
});

// ============================================================
// Helper Components
// ============================================================

function SectionHeader({
  number,
  title,
}: {
  number: number;
  title: string;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionNumber}>
        <Text style={s.sectionNumberText}>{number}</Text>
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function PageFooter({
  data,
  pageNumber,
}: {
  data: ReportData;
  pageNumber: string;
}) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        CONFIDENTIAL | {data.meta.organizationName}
      </Text>
      <Text style={s.footerText}>Focus GTS | Black Hole</Text>
      <Text style={s.footerPage}>Page {pageNumber}</Text>
    </View>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    critical: brand.rose,
    high: brand.amber,
    medium: brand.blue,
    low: brand.emerald,
    info: brand.slate400,
  };
  return (
    <View
      style={[
        s.severityBadge,
        { backgroundColor: colorMap[severity] ?? brand.slate400 },
      ]}
    >
      <Text style={s.severityText}>{severity}</Text>
    </View>
  );
}

// ============================================================
// Page Components
// ============================================================

function CoverPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverContent}>
        <Text style={s.coverBrand}>Focus GTS</Text>
        <Text style={s.coverTitle}>Migration Readiness</Text>
        <Text style={s.coverTitle}>Assessment</Text>
        <Text style={s.coverSubtitle}>{data.meta.migrationType}</Text>
        <View style={s.coverDivider} />
        <View style={s.coverMeta}>
          <Text style={s.coverOrg}>{data.meta.organizationName}</Text>
          <Text style={s.coverDate}>{data.meta.generatedDate}</Text>
        </View>
      </View>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>
          Powered by Black Hole | AI-Accelerated Adobe Migration Platform
        </Text>
        <Text style={[s.coverFooterText, { marginTop: 4 }]}>
          {data.meta.confidentialityNotice}
        </Text>
      </View>
    </Page>
  );
}

function ExecutiveSummaryPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={1} title="Executive Summary" />

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
        <View style={{ width: 140 }}>
          <ScoreGauge
            score={data.executive.overallScore}
            label="Overall Readiness"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.highlightBox}>
            <Text style={s.highlightTitle}>
              {data.executive.readinessLevel}
            </Text>
            <Text style={s.highlightText}>
              {data.executive.readinessDescription}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: brand.slate800 }]}>
            {data.executive.totalFindings}
          </Text>
          <Text style={s.statLabel}>Total Findings</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: brand.rose }]}>
            {data.executive.criticalFindings}
          </Text>
          <Text style={s.statLabel}>Critical Issues</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: brand.emerald }]}>
            {data.executive.autoFixableFindings}
          </Text>
          <Text style={s.statLabel}>Auto-Fixable</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[s.savingsBox, { flex: 1 }]}>
          <Text style={s.savingsValue}>
            {data.executive.estimatedSavingsPercent}%
          </Text>
          <Text style={s.savingsLabel}>Cost Savings vs Traditional</Text>
          <Text
            style={[s.savingsLabel, { fontFamily: 'Helvetica-Bold', color: brand.emerald }]}
          >
            {data.executive.estimatedSavings}
          </Text>
        </View>
        <View style={[s.savingsBox, { flex: 1 }]}>
          <Text style={s.savingsValue}>
            {data.executive.estimatedTimeSavingsPercent}%
          </Text>
          <Text style={s.savingsLabel}>Faster Delivery</Text>
          <Text
            style={[s.savingsLabel, { fontFamily: 'Helvetica-Bold', color: brand.emerald }]}
          >
            {data.executive.estimatedTimeSavings} saved
          </Text>
        </View>
      </View>

      <PageFooter data={data} pageNumber="2" />
    </Page>
  );
}

function ReadinessScoresPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={2} title="Readiness Scores" />

      <View style={s.card}>
        <Text style={s.cardTitle}>Category Breakdown</Text>
        <ScoreBar label="Code Compatibility" score={data.scores.codeCompatibility} />
        <ScoreBar label="Content Readiness" score={data.scores.contentReadiness} />
        <ScoreBar
          label="Integration Complexity"
          score={data.scores.integrationComplexity}
        />
        <ScoreBar
          label="Configuration Readiness"
          score={data.scores.configurationReadiness}
        />
        <ScoreBar label="Compliance" score={data.scores.compliance} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Finding Distribution</Text>
        <SeverityDistribution
          critical={data.findings.bySeverity.critical?.count ?? 0}
          high={data.findings.bySeverity.high?.count ?? 0}
          medium={data.findings.bySeverity.medium?.count ?? 0}
          low={data.findings.bySeverity.low?.count ?? 0}
        />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <Text style={{ fontSize: 8, color: brand.slate500 }}>
            Total effort: {data.findings.totalEstimatedHours} hours estimated
          </Text>
          <Text style={{ fontSize: 8, color: brand.emerald }}>
            {data.findings.autoFixableCount} findings can be auto-fixed
          </Text>
        </View>
      </View>

      <PageFooter data={data} pageNumber="3" />
    </Page>
  );
}

function RiskAssessmentPage({ data }: { data: ReportData }) {
  const risks = data.risks.risks.slice(0, 8);

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={3} title="Risk Assessment" />

      {risks.length === 0 ? (
        <View style={s.card}>
          <Text style={s.bodyText}>
            No significant risk factors were identified during the assessment.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: 60 }]}>Severity</Text>
            <Text style={[s.tableHeaderText, { flex: 1 }]}>Description</Text>
            <Text style={[s.tableHeaderText, { width: 55 }]}>Probability</Text>
            <Text style={[s.tableHeaderText, { width: 80 }]}>Impact</Text>
          </View>
          {risks.map((risk, i) => (
            <View
              key={risk.id}
              style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
              wrap={false}
            >
              <View style={{ width: 60 }}>
                <SeverityBadge severity={risk.severity} />
              </View>
              <Text style={[s.tableCell, { flex: 1, paddingRight: 8 }]}>
                {risk.description}
              </Text>
              <Text style={[s.tableCell, { width: 55, textAlign: 'center' }]}>
                {Math.round(risk.probability * 100)}%
              </Text>
              <Text style={[s.tableCell, { width: 80 }]}>{risk.impact}</Text>
            </View>
          ))}

          <View style={{ marginTop: 12 }}>
            <Text style={s.cardTitle}>Mitigation Strategies</Text>
            {risks.slice(0, 5).map((risk, i) => (
              <View
                key={risk.id}
                style={{ flexDirection: 'row', marginBottom: 6 }}
                wrap={false}
              >
                <Text style={{ fontSize: 8, color: brand.violet, width: 12 }}>
                  {i + 1}.
                </Text>
                <Text style={{ fontSize: 8, color: brand.slate600, flex: 1 }}>
                  {risk.mitigation}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <PageFooter data={data} pageNumber="4" />
    </Page>
  );
}

function FindingsPage({ data }: { data: ReportData }) {
  const topFindings = data.findings.topFindings.slice(0, 10);

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={4} title="Key Findings" />

      <View style={s.statsRow}>
        {Object.entries(data.findings.byCategory).map(([cat, count]) => (
          <View key={cat} style={s.statBox}>
            <Text style={[s.statValue, { fontSize: 18, color: brand.slate800 }]}>
              {count}
            </Text>
            <Text style={s.statLabel}>{cat}</Text>
          </View>
        ))}
      </View>

      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderText, { width: 55 }]}>Severity</Text>
        <Text style={[s.tableHeaderText, { flex: 1 }]}>Finding</Text>
        <Text style={[s.tableHeaderText, { width: 50 }]}>Hours</Text>
        <Text style={[s.tableHeaderText, { width: 50 }]}>Auto-Fix</Text>
      </View>
      {topFindings.map((finding, i) => (
        <View
          key={finding.id}
          style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
          wrap={false}
        >
          <View style={{ width: 55 }}>
            <SeverityBadge severity={finding.severity} />
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[s.tableCell, { fontFamily: 'Helvetica-Bold' }]}>
              {finding.title}
            </Text>
            <Text
              style={[s.tableCell, { fontSize: 7, color: brand.slate500, marginTop: 2 }]}
            >
              {finding.affectedPath}
            </Text>
          </View>
          <Text style={[s.tableCell, { width: 50, textAlign: 'center' }]}>
            {finding.estimatedHours}h
          </Text>
          <Text
            style={[
              s.tableCell,
              {
                width: 50,
                textAlign: 'center',
                color: finding.autoFixAvailable ? brand.emerald : brand.slate400,
              },
            ]}
          >
            {finding.autoFixAvailable ? 'Yes' : 'No'}
          </Text>
        </View>
      ))}

      {data.findings.total > 10 && (
        <Text style={[s.bodyText, { marginTop: 8, fontStyle: 'italic' }]}>
          Showing top 10 of {data.findings.total} findings. Full details
          available in the platform.
        </Text>
      )}

      <PageFooter data={data} pageNumber="5" />
    </Page>
  );
}

function TimelinePage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={5} title="Timeline Comparison" />

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[s.statBox, { flex: 1 }]}>
          <Text style={[s.statValue, { color: brand.slate400 }]}>
            {data.timeline.traditionalWeeks}
          </Text>
          <Text style={s.statLabel}>Traditional (Weeks)</Text>
        </View>
        <View style={[s.statBox, { flex: 1, borderColor: brand.violet }]}>
          <Text style={[s.statValue, { color: brand.violet }]}>
            {data.timeline.blackHoleWeeks}
          </Text>
          <Text style={s.statLabel}>With Black Hole (Weeks)</Text>
        </View>
        <View
          style={[s.statBox, { flex: 1, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
        >
          <Text style={[s.statValue, { color: brand.emerald }]}>
            {data.timeline.savingsPercent}%
          </Text>
          <Text style={s.statLabel}>Faster</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Phase-by-Phase Breakdown</Text>
        <PhaseTimeline phases={data.timeline.phases} />
      </View>

      <PageFooter data={data} pageNumber="6" />
    </Page>
  );
}

function CostPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={6} title="Cost Comparison" />

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[s.statBox, { flex: 1 }]}>
          <Text style={[s.statValue, { fontSize: 18, color: brand.slate400 }]}>
            {data.cost.traditionalCostFormatted}
          </Text>
          <Text style={s.statLabel}>Traditional Approach</Text>
        </View>
        <View style={[s.statBox, { flex: 1, borderColor: brand.violet }]}>
          <Text style={[s.statValue, { fontSize: 18, color: brand.violet }]}>
            {data.cost.blackHoleCostFormatted}
          </Text>
          <Text style={s.statLabel}>With Black Hole</Text>
        </View>
      </View>

      <View style={[s.savingsBox, { flexDirection: 'row', gap: 24 }]}>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.savingsValue}>{data.cost.savingsFormatted}</Text>
          <Text style={s.savingsLabel}>Total Savings</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.savingsValue}>{data.cost.savingsPercent}%</Text>
          <Text style={s.savingsLabel}>Cost Reduction</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Black Hole Cost Breakdown</Text>
        <ComparisonChart
          items={[
            {
              label: 'Total Project Cost',
              traditional: data.cost.traditionalCost,
              blackHole: data.cost.blackHoleCost,
            },
          ]}
          formatValue={(v) => formatCurrency(v, data.cost.currency)}
        />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: brand.slate500, marginBottom: 2 }}>
              Platform Fee
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: brand.slate800 }}>
              {data.cost.platformFeeFormatted}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: brand.slate500, marginBottom: 2 }}>
              SI / Implementation Cost
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: brand.slate800 }}>
              {data.cost.siCostFormatted}
            </Text>
          </View>
        </View>
      </View>

      <PageFooter data={data} pageNumber="7" />
    </Page>
  );
}

function RecommendationsPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={7} title="Recommendations" />

      {data.recommendations.map((rec, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            marginBottom: 10,
            paddingBottom: 10,
            borderBottomWidth: i < data.recommendations.length - 1 ? 1 : 0,
            borderBottomColor: brand.slate100,
          }}
          wrap={false}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: brand.violet,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Helvetica-Bold',
                color: brand.white,
              }}
            >
              {i + 1}
            </Text>
          </View>
          <Text style={[s.bodyText, { flex: 1, marginBottom: 0 }]}>{rec}</Text>
        </View>
      ))}

      <PageFooter data={data} pageNumber="8" />
    </Page>
  );
}

function NextStepsPage({ data }: { data: ReportData }) {
  const steps = [
    {
      title: 'Review This Report',
      description:
        'Share this assessment with your technical and business stakeholders. ' +
        'We are available to walk through the findings in a joint session.',
    },
    {
      title: 'Remediation Planning',
      description:
        'For any critical or high-severity findings, our team can help build a ' +
        'prioritized remediation roadmap before migration begins.',
    },
    {
      title: 'Pilot Migration',
      description:
        'Start with a targeted pilot to validate the approach. Black Hole can ' +
        'migrate a subset of your environment in days, not months.',
    },
    {
      title: 'Full Migration Execution',
      description:
        'With the pilot validated, scale to your full environment with ' +
        'AI-accelerated transformation, automated testing, and zero-downtime cutover.',
    },
  ];

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader number={8} title="Next Steps" />

      {steps.map((step, i) => (
        <View key={i} style={[s.card, { marginBottom: 14 }]} wrap={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: brand.violet,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Helvetica-Bold',
                  color: brand.white,
                }}
              >
                {i + 1}
              </Text>
            </View>
            <Text style={[s.cardTitle, { marginBottom: 0 }]}>{step.title}</Text>
          </View>
          <Text style={[s.bodyText, { marginBottom: 0, marginLeft: 38 }]}>
            {step.description}
          </Text>
        </View>
      ))}

      <View style={[s.highlightBox, { marginTop: 20 }]}>
        <Text style={s.highlightTitle}>Ready to Begin?</Text>
        <Text style={s.highlightText}>
          Contact the Focus GTS team to schedule a detailed review of this
          assessment and begin planning your migration. Our experts are
          standing by to accelerate your journey to Adobe Cloud.
        </Text>
        <Text
          style={[
            s.highlightText,
            { marginTop: 8, fontFamily: 'Helvetica-Bold', color: brand.violet },
          ]}
        >
          hello@focusgts.com | focusgts.com/black-hole
        </Text>
      </View>

      <View
        style={{
          marginTop: 24,
          padding: 12,
          borderRadius: 4,
          backgroundColor: brand.slate100,
        }}
      >
        <Text style={{ fontSize: 7, color: brand.slate500, lineHeight: 1.4 }}>
          {data.meta.confidentialityNotice}
        </Text>
      </View>

      <PageFooter data={data} pageNumber="9" />
    </Page>
  );
}

// ============================================================
// Document Assembly
// ============================================================

function AssessmentReport({ data }: { data: ReportData }) {
  return (
    <Document
      title={`Migration Readiness Assessment - ${data.meta.organizationName}`}
      author="Focus GTS | Black Hole"
      subject="Migration Readiness Assessment Report"
      creator="Black Hole for Adobe Marketing Cloud"
    >
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <ReadinessScoresPage data={data} />
      <RiskAssessmentPage data={data} />
      <FindingsPage data={data} />
      <TimelinePage data={data} />
      <CostPage data={data} />
      <RecommendationsPage data={data} />
      <NextStepsPage data={data} />
    </Document>
  );
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate a PDF buffer from assessment and migration data.
 * Returns a Buffer (Node.js) suitable for streaming as a response.
 */
export async function generateAssessmentPDF(
  assessment: AssessmentResult,
  migration?: MigrationProject | null,
): Promise<Buffer> {
  const data = prepareReportData(assessment, migration);
  const buffer = await renderToBuffer(
    <AssessmentReport data={data} />,
  );
  return Buffer.from(buffer);
}
