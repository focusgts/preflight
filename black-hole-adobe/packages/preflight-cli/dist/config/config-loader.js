"use strict";
/**
 * Config Loader
 *
 * Loads .preflightrc.json configuration, walking up from cwd to git root.
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
exports.loadConfig = loadConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CONFIG_FILENAME = '.preflightrc.json';
const VALID_KEYS = new Set([
    'include',
    'exclude',
    'failOn',
    'rules',
    'mode',
]);
const VALID_RULE_VALUES = new Set(['off', 'warn', 'error']);
/**
 * Load config from a specific path or by walking up the directory tree.
 * Returns an empty config if none found.
 */
function loadConfig(configPath) {
    if (configPath) {
        return loadFromPath(path.resolve(configPath));
    }
    return loadFromWalk(process.cwd());
}
/**
 * Load config from a specific file path.
 */
function loadFromPath(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return validateConfig(parsed);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown parse error';
        process.stderr.write(`Warning: Failed to parse ${filePath}: ${message}\n`);
        return {};
    }
}
/**
 * Walk up the directory tree looking for .preflightrc.json.
 * Stops at the filesystem root or a .git directory.
 */
function loadFromWalk(startDir) {
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;
    while (dir !== root) {
        const configFile = path.join(dir, CONFIG_FILENAME);
        if (fs.existsSync(configFile)) {
            return loadFromPath(configFile);
        }
        // Stop at git root
        if (fs.existsSync(path.join(dir, '.git'))) {
            break;
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return {};
}
/**
 * Validate and clean the config object.
 * Warns on unknown keys and invalid rule values.
 */
function validateConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        process.stderr.write('Warning: .preflightrc.json root must be a JSON object.\n');
        return {};
    }
    const obj = raw;
    const config = {};
    // Warn on unknown keys
    for (const key of Object.keys(obj)) {
        if (!VALID_KEYS.has(key)) {
            process.stderr.write(`Warning: Unknown key "${key}" in .preflightrc.json (ignored).\n`);
        }
    }
    // include
    if (obj.include !== undefined) {
        if (Array.isArray(obj.include) && obj.include.every((v) => typeof v === 'string')) {
            config.include = obj.include;
        }
        else {
            process.stderr.write('Warning: "include" must be an array of strings.\n');
        }
    }
    // exclude
    if (obj.exclude !== undefined) {
        if (Array.isArray(obj.exclude) && obj.exclude.every((v) => typeof v === 'string')) {
            config.exclude = obj.exclude;
        }
        else {
            process.stderr.write('Warning: "exclude" must be an array of strings.\n');
        }
    }
    // failOn
    if (obj.failOn !== undefined) {
        if (typeof obj.failOn === 'string') {
            config.failOn = obj.failOn;
        }
    }
    // mode
    if (obj.mode !== undefined) {
        if (obj.mode === 'local' || obj.mode === 'cloud') {
            config.mode = obj.mode;
        }
    }
    // rules
    if (obj.rules !== undefined) {
        if (obj.rules && typeof obj.rules === 'object' && !Array.isArray(obj.rules)) {
            const rules = {};
            for (const [ruleId, value] of Object.entries(obj.rules)) {
                if (typeof value === 'string' && VALID_RULE_VALUES.has(value)) {
                    rules[ruleId] = value;
                }
                else {
                    process.stderr.write(`Warning: Invalid value "${String(value)}" for rule "${ruleId}". Must be "off", "warn", or "error".\n`);
                }
            }
            config.rules = rules;
        }
        else {
            process.stderr.write('Warning: "rules" must be an object mapping rule IDs to "off"|"warn"|"error".\n');
        }
    }
    return config;
}
//# sourceMappingURL=config-loader.js.map