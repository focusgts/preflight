"use strict";
/**
 * JSON Output Formatter
 *
 * Outputs the raw PreFlightReport as formatted JSON.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatJson = formatJson;
function formatJson(report) {
    return JSON.stringify(report, null, 2) + '\n';
}
//# sourceMappingURL=json.js.map