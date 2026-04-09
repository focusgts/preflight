"use strict";
/**
 * File Discovery
 *
 * Walks the project directory tree to find scannable AEM files.
 * Honors .gitignore patterns and config include/exclude globs.
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
exports.discoverFiles = discoverFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Default file extensions the engine can analyze. */
const DEFAULT_EXTENSIONS = new Set([
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
]);
/**
 * Directories to always skip regardless of config.
 */
const ALWAYS_SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'target',
    'dist',
    '.next',
    '__pycache__',
]);
/**
 * Discover files to scan based on paths, config, and .gitignore.
 */
async function discoverFiles(scanPaths, config) {
    const allFiles = [];
    for (const scanPath of scanPaths) {
        const resolved = path.resolve(scanPath);
        const stat = fs.statSync(resolved, { throwIfNoEntry: false });
        if (!stat)
            continue;
        if (stat.isFile()) {
            if (isSupportedFile(resolved)) {
                allFiles.push(resolved);
            }
        }
        else if (stat.isDirectory()) {
            walkDirectory(resolved, allFiles, loadGitignorePatterns(resolved));
        }
    }
    // Apply config include/exclude filters
    return applyConfigFilters(allFiles, config);
}
/**
 * Recursively walk a directory and collect supported files.
 */
function walkDirectory(dir, results, gitignorePatterns) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (ALWAYS_SKIP_DIRS.has(entry.name))
                continue;
            if (isGitignored(fullPath, gitignorePatterns))
                continue;
            walkDirectory(fullPath, results, gitignorePatterns);
        }
        else if (entry.isFile()) {
            if (isGitignored(fullPath, gitignorePatterns))
                continue;
            if (isSupportedFile(fullPath)) {
                results.push(fullPath);
            }
        }
    }
}
/**
 * Check if a file path has a supported extension.
 */
function isSupportedFile(filePath) {
    const lower = filePath.toLowerCase();
    for (const ext of DEFAULT_EXTENSIONS) {
        if (lower.endsWith(ext))
            return true;
    }
    return false;
}
/**
 * Load .gitignore patterns from the project root.
 * Returns simple patterns for basic matching.
 */
function loadGitignorePatterns(rootDir) {
    const gitignorePath = path.join(rootDir, '.gitignore');
    try {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        return content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
    }
    catch {
        return [];
    }
}
/**
 * Basic gitignore pattern matching.
 * Handles simple patterns like "target/", "*.class", "build/".
 */
function isGitignored(filePath, patterns) {
    const basename = path.basename(filePath);
    for (const pattern of patterns) {
        // Directory pattern (ending with /)
        if (pattern.endsWith('/')) {
            const dirName = pattern.slice(0, -1);
            if (basename === dirName || filePath.includes(`/${dirName}/`)) {
                return true;
            }
            continue;
        }
        // Glob pattern with *
        if (pattern.startsWith('*')) {
            const suffix = pattern.slice(1);
            if (basename.endsWith(suffix))
                return true;
            continue;
        }
        // Exact match or path segment match
        if (basename === pattern || filePath.includes(`/${pattern}/`)) {
            return true;
        }
    }
    return false;
}
/**
 * Apply config include/exclude glob filters.
 */
function applyConfigFilters(files, config) {
    let result = files;
    if (config.include && config.include.length > 0) {
        result = result.filter((f) => matchesAnyGlob(f, config.include));
    }
    if (config.exclude && config.exclude.length > 0) {
        result = result.filter((f) => !matchesAnyGlob(f, config.exclude));
    }
    return result;
}
/**
 * Simple glob matching for config patterns.
 * Supports **, *, and literal path segments.
 */
function matchesAnyGlob(filePath, patterns) {
    for (const pattern of patterns) {
        if (matchGlob(filePath, pattern))
            return true;
    }
    return false;
}
function matchGlob(filePath, pattern) {
    // Convert glob to regex
    const regexStr = pattern
        .replace(/\*\*/g, '<<DOUBLESTAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<DOUBLESTAR>>/g, '.*')
        .replace(/\?/g, '[^/]');
    try {
        const regex = new RegExp(regexStr);
        return regex.test(filePath);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=file-discovery.js.map