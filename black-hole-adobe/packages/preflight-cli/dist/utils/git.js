"use strict";
/**
 * Git Utilities
 *
 * Shell out to git for staged file detection and diff-since operations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStagedFiles = getStagedFiles;
exports.getChangedFilesSince = getChangedFilesSince;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
/** Default file extensions the engine can analyze. */
const SUPPORTED_EXTENSIONS = [
    '.java',
    '.jsp',
    '.jspx',
    '.xml',
    '.cfg.json',
    '.properties',
    '.yaml',
    '.yml',
    '.html',
    '.htl',
];
/**
 * Get the list of git-staged files, filtered to supported extensions.
 */
async function getStagedFiles(cwd) {
    try {
        const output = (0, child_process_1.execSync)('git diff --cached --name-only', {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return parseGitOutput(output, cwd);
    }
    catch {
        return [];
    }
}
/**
 * Get files changed since a git ref, filtered to supported extensions.
 */
async function getChangedFilesSince(ref, cwd) {
    try {
        const output = (0, child_process_1.execSync)(`git diff --name-only ${ref}...HEAD`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return parseGitOutput(output, cwd);
    }
    catch {
        return [];
    }
}
/**
 * Parse git output lines into absolute paths, filtering by supported extensions.
 */
function parseGitOutput(output, cwd) {
    return output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => isSupportedExtension(line))
        .map((line) => path.resolve(cwd, line));
}
function isSupportedExtension(filePath) {
    const lower = filePath.toLowerCase();
    return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
//# sourceMappingURL=git.js.map