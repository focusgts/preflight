/**
 * SSRF Protection — URL Validator (ADR-047)
 *
 * Validates scan target URLs to prevent Server-Side Request Forgery.
 * Blocks internal/private IP ranges, link-local addresses, cloud
 * metadata endpoints, non-HTTP(S) schemes, and suspicious hostnames.
 */

// ============================================================
// Types
// ============================================================

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ============================================================
// IP Range Helpers
// ============================================================

/**
 * Convert a dotted-quad IPv4 address to a 32-bit unsigned integer.
 * Returns null if the string is not a valid IPv4 address.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = (result << 8) | octet;
  }

  // Convert to unsigned 32-bit
  return result >>> 0;
}

// ============================================================
// Blocked Ranges
// ============================================================

/**
 * IPv4 ranges that MUST be blocked (RFC 1918, loopback, link-local, etc.).
 */
const BLOCKED_IPV4_RANGES: Array<{ start: number; end: number; label: string }> = [
  { start: ipToNumber('0.0.0.0')!, end: ipToNumber('0.255.255.255')!, label: 'unspecified (0.0.0.0/8)' },
  { start: ipToNumber('10.0.0.0')!, end: ipToNumber('10.255.255.255')!, label: 'private class A (10.0.0.0/8)' },
  { start: ipToNumber('127.0.0.0')!, end: ipToNumber('127.255.255.255')!, label: 'loopback (127.0.0.0/8)' },
  { start: ipToNumber('169.254.0.0')!, end: ipToNumber('169.254.255.255')!, label: 'link-local / cloud metadata (169.254.0.0/16)' },
  { start: ipToNumber('172.16.0.0')!, end: ipToNumber('172.31.255.255')!, label: 'private class B (172.16.0.0/12)' },
  { start: ipToNumber('192.168.0.0')!, end: ipToNumber('192.168.255.255')!, label: 'private class C (192.168.0.0/16)' },
];

/**
 * IPv6 prefixes that MUST be blocked.
 */
const BLOCKED_IPV6_PREFIXES = ['::1', 'fc00:', 'fd', 'fe80:'];

/**
 * Hostnames that MUST be blocked regardless of DNS resolution.
 */
const BLOCKED_HOSTNAMES = ['localhost'];
const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.localhost', '.internal'];

/**
 * Allowed ports. Requests to ports outside this set are blocked.
 * Includes standard HTTP/S ports and common AEM ports.
 */
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443, 4502, 4503]);

// ============================================================
// Public API
// ============================================================

/**
 * Check whether an IPv4 address falls within any blocked range.
 */
export function isInternalIp(ip: string): boolean {
  // IPv6 checks
  const normalizedIp = ip.toLowerCase().trim();
  if (normalizedIp === '::1') return true;
  for (const prefix of BLOCKED_IPV6_PREFIXES) {
    if (normalizedIp.startsWith(prefix)) return true;
  }

  // IPv4 check
  const num = ipToNumber(normalizedIp);
  if (num === null) return false;

  for (const range of BLOCKED_IPV4_RANGES) {
    if (num >= range.start && num <= range.end) return true;
  }

  return false;
}

/**
 * Check whether a hostname is blocked (localhost, *.local, etc.).
 */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();

  if (BLOCKED_HOSTNAMES.includes(lower)) return true;

  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (lower.endsWith(suffix)) return true;
  }

  // Hostname that is a raw IP address — check ranges
  if (isInternalIp(lower)) return true;

  return false;
}

/**
 * Validate a URL before using it as a scan target.
 *
 * Returns `{ valid: true }` if the URL is safe to scan, or
 * `{ valid: false, reason: '...' }` explaining why it was rejected.
 */
export function validateScanTarget(url: string): ValidationResult {
  // Must be a non-empty string
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is required.' };
  }

  const trimmed = url.trim();

  // Normalise bare domains: add https:// if no scheme present
  let normalized = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  // Parse the URL
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, reason: 'URL is not a valid URL.' };
  }

  // Scheme must be http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Scheme "${parsed.protocol.replace(':', '')}" is not allowed. Only http and https are permitted.`,
    };
  }

  // Must have a hostname
  if (!parsed.hostname) {
    return { valid: false, reason: 'URL must include a valid hostname.' };
  }

  // Block dangerous hostnames
  if (isBlockedHostname(parsed.hostname)) {
    return {
      valid: false,
      reason: 'Cannot scan internal or private network addresses.',
    };
  }

  // Port check — if explicitly specified, it must be in the allow-list
  if (parsed.port) {
    const portNum = Number(parsed.port);
    if (!ALLOWED_PORTS.has(portNum)) {
      return {
        valid: false,
        reason: `Port ${portNum} is not allowed. Permitted ports: ${[...ALLOWED_PORTS].join(', ')}.`,
      };
    }
  }

  // Hostname must contain at least one dot (rejects bare "localhost"-style names
  // that somehow bypassed the blocklist)
  if (!parsed.hostname.includes('.') && !isIpAddress(parsed.hostname)) {
    return {
      valid: false,
      reason: 'Hostname must be a fully qualified domain name.',
    };
  }

  // If hostname is a raw IP, check ranges
  if (isIpAddress(parsed.hostname) && isInternalIp(parsed.hostname)) {
    return {
      valid: false,
      reason: 'Cannot scan internal or private network addresses.',
    };
  }

  return { valid: true };
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Quick check whether a string looks like an IPv4 address.
 */
function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}
