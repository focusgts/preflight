/**
 * Multi-Factor Authentication (TOTP-based)
 *
 * Implements RFC 6238 TOTP using HMAC-SHA1 without external libraries.
 * Compatible with Google Authenticator, Authy, and similar authenticator apps.
 */

import { createHmac, randomBytes } from 'node:crypto';

// -----------------------------------------------------------------------
// TOTP Configuration
// -----------------------------------------------------------------------

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const TOTP_WINDOW = 1; // +/- 1 period tolerance
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_LENGTH = 8;
const SECRET_LENGTH = 20; // 160 bits, standard for TOTP

const ISSUER = 'BlackHole';

// -----------------------------------------------------------------------
// MFA State Types
// -----------------------------------------------------------------------

interface MFAState {
  userId: string;
  secret: string; // base32-encoded
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodes: string[];
  usedRecoveryCodes: string[];
}

// -----------------------------------------------------------------------
// Base32 Encoding (RFC 4648)
// -----------------------------------------------------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// -----------------------------------------------------------------------
// TOTP Core (RFC 6238 / RFC 4226)
// -----------------------------------------------------------------------

function generateTOTPCode(secret: string, timeCounter: number): string {
  const secretBuffer = base32Decode(secret);

  // Convert counter to 8-byte big-endian buffer
  const counterBuffer = Buffer.alloc(8);
  let counter = timeCounter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  // HMAC-SHA1
  const hmac = createHmac(TOTP_ALGORITHM, secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

function getTimeCounter(timestamp?: number): number {
  const time = timestamp ?? Math.floor(Date.now() / 1000);
  return Math.floor(time / TOTP_PERIOD);
}

// -----------------------------------------------------------------------
// Recovery Code Generation
// -----------------------------------------------------------------------

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = randomBytes(RECOVERY_CODE_LENGTH);
    const code = bytes
      .toString('hex')
      .substring(0, RECOVERY_CODE_LENGTH)
      .toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

// -----------------------------------------------------------------------
// MFAManager
// -----------------------------------------------------------------------

export class MFAManager {
  private states = new Map<string, MFAState>();

  /**
   * Generate a TOTP secret for a user.
   * Does not enable MFA until verifyToken succeeds via enableMFA.
   */
  generateSecret(userId: string): { secret: string; recoveryCodes: string[] } {
    const secretBuffer = randomBytes(SECRET_LENGTH);
    const secret = base32Encode(secretBuffer);
    const recoveryCodes = generateRecoveryCodes();

    this.states.set(userId, {
      userId,
      secret,
      enabled: false,
      enabledAt: null,
      recoveryCodes,
      usedRecoveryCodes: [],
    });

    return { secret, recoveryCodes };
  }

  /**
   * Generate an otpauth:// URL for QR code scanning.
   */
  generateQRCodeURL(secret: string, email: string): string {
    const encodedIssuer = encodeURIComponent(ISSUER);
    const encodedEmail = encodeURIComponent(email);
    return (
      `otpauth://totp/${encodedIssuer}:${encodedEmail}` +
      `?secret=${secret}&issuer=${encodedIssuer}` +
      `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`
    );
  }

  /**
   * Verify a 6-digit TOTP token.
   * Allows +/- 1 time window to account for clock drift.
   */
  verifyToken(userId: string, token: string): boolean {
    const state = this.states.get(userId);
    if (!state) return false;

    // Try recovery code first
    if (this.tryRecoveryCode(userId, token)) {
      return true;
    }

    const currentCounter = getTimeCounter();

    // Check within tolerance window
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const expected = generateTOTPCode(state.secret, currentCounter + i);
      if (timingSafeEqual(token, expected)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Enable MFA after first successful verification.
   * Returns true if MFA was enabled, false if token is invalid.
   */
  enableMFA(userId: string, token: string): boolean {
    const state = this.states.get(userId);
    if (!state) return false;
    if (state.enabled) return true;

    // Verify the token before enabling
    const currentCounter = getTimeCounter();
    let valid = false;
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const expected = generateTOTPCode(state.secret, currentCounter + i);
      if (timingSafeEqual(token, expected)) {
        valid = true;
        break;
      }
    }

    if (!valid) return false;

    state.enabled = true;
    state.enabledAt = new Date().toISOString();
    return true;
  }

  /**
   * Disable MFA for a user. Requires a valid current token.
   */
  disableMFA(userId: string, token: string): boolean {
    if (!this.verifyToken(userId, token)) return false;

    const state = this.states.get(userId);
    if (!state) return false;

    this.states.delete(userId);
    return true;
  }

  /**
   * Check if a user has MFA enabled.
   */
  isMFAEnabled(userId: string): boolean {
    const state = this.states.get(userId);
    return state?.enabled ?? false;
  }

  /**
   * Get the secret for a user (used during setup).
   */
  getSecret(userId: string): string | null {
    return this.states.get(userId)?.secret ?? null;
  }

  /**
   * Get remaining recovery codes for a user.
   */
  getRecoveryCodes(userId: string): string[] {
    const state = this.states.get(userId);
    if (!state) return [];
    return state.recoveryCodes.filter(
      (code) => !state.usedRecoveryCodes.includes(code),
    );
  }

  /**
   * Try to use a recovery code. Each code is single-use.
   */
  private tryRecoveryCode(userId: string, code: string): boolean {
    const state = this.states.get(userId);
    if (!state || !state.enabled) return false;

    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    const matchIndex = state.recoveryCodes.findIndex(
      (rc) => rc === normalizedCode && !state.usedRecoveryCodes.includes(rc),
    );

    if (matchIndex === -1) return false;

    state.usedRecoveryCodes.push(state.recoveryCodes[matchIndex]);
    return true;
  }

  /**
   * Generate a TOTP code for testing purposes.
   * Not exposed in production API routes.
   */
  _generateCodeForTesting(userId: string, timestamp?: number): string | null {
    const state = this.states.get(userId);
    if (!state) return null;
    const counter = getTimeCounter(timestamp);
    return generateTOTPCode(state.secret, counter);
  }
}

// -----------------------------------------------------------------------
// Timing-safe string comparison
// -----------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// -----------------------------------------------------------------------
// Singleton
// -----------------------------------------------------------------------

let _mfaInstance: MFAManager | null = null;

export function getMFAManager(): MFAManager {
  if (!_mfaInstance) {
    _mfaInstance = new MFAManager();
  }
  return _mfaInstance;
}

// Re-export for testing
export { generateTOTPCode, getTimeCounter, base32Encode, base32Decode };
