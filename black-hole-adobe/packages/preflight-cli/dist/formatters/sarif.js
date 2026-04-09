"use strict";
/**
 * SARIF 2.1.0 Output Formatter
 *
 * Produces Static Analysis Results Interchange Format output
 * compatible with GitHub Code Scanning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSarif = formatSarif;
function severityToSarifLevel(severity) {
    switch (severity) {
        case 'blocker':
            return 'error';
        case 'critical':
            return 'error';
        case 'major':
            return 'warning';
        case 'minor':
            return 'note';
        default:
            return 'warning';
    }
}
function formatSarif(report) {
    // Collect unique rule IDs for the rules array
    const ruleMap = new Map();
    for (const finding of report.findings) {
        if (!ruleMap.has(finding.ruleId)) {
            ruleMap.set(finding.ruleId, finding);
        }
    }
    const rules = Array.from(ruleMap.values()).map((f) => ({
        id: f.ruleId,
        name: f.ruleName,
        shortDescription: { text: f.message },
        defaultConfiguration: {
            level: severityToSarifLevel(f.severity),
        },
    }));
    const results = report.findings.map((f) => {
        const result = {
            ruleId: f.ruleId,
            level: severityToSarifLevel(f.severity),
            message: { text: f.message },
            locations: [
                {
                    physicalLocation: {
                        artifactLocation: { uri: f.filePath },
                        ...(f.line ? { region: { startLine: f.line } } : {}),
                    },
                },
            ],
        };
        if (f.remediation) {
            result.fixes = [{ description: { text: f.remediation } }];
        }
        return result;
    });
    const sarif = {
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: '@blackhole/preflight',
                        version: '0.1.0',
                        informationUri: 'https://blackhole.focusgts.com/preflight',
                        rules,
                    },
                },
                results,
            },
        ],
    };
    return JSON.stringify(sarif, null, 2) + '\n';
}
//# sourceMappingURL=sarif.js.map