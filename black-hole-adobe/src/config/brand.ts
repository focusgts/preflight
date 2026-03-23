/**
 * Focus GTS Brand Configuration
 *
 * Colors, typography, and brand assets derived from the official
 * Focus Brand Guidelines (prepared by Digital Silk, 2024).
 *
 * IMPORTANT: Do not modify these values without consulting the
 * brand guidelines PDF. Adherence is mandatory, not optional.
 */

// ── Primary Color Palette ──────────────────────────────────
export const BRAND_COLORS = {
  // Primary palette (from brand guidelines section 2.1)
  wheat: {
    hex: '#F2DCB3',
    rgb: '242, 200, 179',
    usage: 'Warm accent, backgrounds, gradient component',
  },
  paleViolet: {
    hex: '#CB8CFF',
    rgb: '203, 140, 255',
    usage: 'Logo gradient, accent highlights, CTAs',
  },
  lavenderIndigo: {
    hex: '#9966F0',
    rgb: '153, 102, 240',
    usage: 'Logo gradient, primary purple, interactive elements',
  },
  majorelleBlue: {
    hex: '#7647DD',
    rgb: '118, 71, 221',
    usage: 'Deep purple accent, hover states',
  },
  coolBlack: {
    hex: '#06265F',
    rgb: '6, 38, 95',
    usage: 'Primary text color, headings, dark backgrounds',
  },
} as const;

// ── Gradients (from brand guidelines section 2.2) ──────────
export const BRAND_GRADIENTS = {
  // Logo cube gradient (top-left to bottom-right)
  logoGradient: 'linear-gradient(135deg, #7647DD 0%, #CB8CFF 40%, #F2DCB3 100%)',

  // Primary brand gradient
  primary: 'linear-gradient(135deg, #7647DD 0%, #9966F0 50%, #CB8CFF 100%)',

  // Dark background gradient (from brand guidelines visual identity pages)
  darkBackground: 'linear-gradient(135deg, #06265F 0%, #0D1B3E 50%, #06265F 100%)',

  // Warm gradient
  warm: 'linear-gradient(135deg, #CB8CFF 0%, #F2DCB3 100%)',

  // Cool gradient
  cool: 'linear-gradient(135deg, #06265F 0%, #7647DD 100%)',
} as const;

// ── Typography (from brand guidelines section 3.0) ─────────
export const BRAND_TYPOGRAPHY = {
  primary: {
    family: 'Gabarito',
    usage: 'Headlines, titles, display text',
    weights: ['400', '500', '600', '700'],
  },
  secondary: {
    family: 'Raleway',
    usage: 'Body text, descriptions, UI elements',
    weights: ['300', '400', '500', '600', '700'],
  },
  system: {
    family: 'Verdana, Geneva, sans-serif',
    usage: 'Fallback, system UI, form inputs',
  },
} as const;

// ── Logo Assets ────────────────────────────────────────────
export const BRAND_LOGOS = {
  focusLogoSVG: '/brand/focus-logo.svg',
  focusLogoPNG: '/brand/focus-logo.png',
  navigatorLogo: '/brand/navigator-logo.png',
  navigatorLogoFull: '/brand/navigator-logo-full.png',
  navLogo: '/brand/nav-logo.png',
} as const;

// ── Brand Copy ─────────────────────────────────────────────
export const BRAND_COPY = {
  companyName: 'Focus GTS',
  companyFullName: 'Focus Global Talent Solutions',
  productName: 'Black Hole',
  productFullName: 'Black Hole for Adobe Marketing Cloud',
  navigatorName: 'Navigator',
  tagline: 'Your Adobe Migration. Weeks, Not Months.',
  subtitle: 'AI-powered migration platform for Adobe Marketing Cloud',
  website: 'www.focusgts.com',
  supportEmail: 'support@focusgts.com',
  copyright: `© ${new Date().getFullYear()} Focus Global Talent Solutions. All rights reserved.`,
} as const;

// ── Tailwind CSS class mappings ────────────────────────────
// Use these in className attributes for brand consistency
export const BRAND_CLASSES = {
  // Text colors
  textPrimary: 'text-[#06265F]', // Cool Black — for light backgrounds
  textWhite: 'text-white', // For dark backgrounds
  textPurple: 'text-[#9966F0]', // Lavender Indigo — accent text
  textSubtag: 'text-[#CB8CFF]', // Pale Violet — "Global Talent Solutions" subtag

  // Background colors
  bgDark: 'bg-[#06265F]', // Cool Black
  bgPurple: 'bg-[#9966F0]', // Lavender Indigo
  bgDeepPurple: 'bg-[#7647DD]', // Majorelle Blue

  // Gradient classes (use with bg-gradient-to-r/br)
  gradientPrimary: 'from-[#7647DD] via-[#9966F0] to-[#CB8CFF]',
  gradientWarm: 'from-[#CB8CFF] to-[#F2DCB3]',
  gradientLogo: 'from-[#7647DD] via-[#CB8CFF] to-[#F2DCB3]',
  gradientDark: 'from-[#06265F] to-[#0D1B3E]',

  // Border colors
  borderPurple: 'border-[#9966F0]',
  borderLight: 'border-[#CB8CFF]/30',
} as const;
