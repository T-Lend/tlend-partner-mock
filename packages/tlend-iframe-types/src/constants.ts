/**
 * TLend Partner Iframe Integration Protocol - Constants
 * Based on RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md v2.2.0
 */

// =============================================================================
// Protocol Version & Capabilities
// =============================================================================

/** Current protocol version */
export const TLEND_PROTOCOL_VERSION = '2.2.0'

/** Supported capabilities */
export const TLEND_CAPABILITIES = [
  'auth_delegation',
  'repay_delegation',
  'custom_styles',
  'custom_logo',
] as const

export type TLendCapability = (typeof TLEND_CAPABILITIES)[number]

// =============================================================================
// Error Codes
// =============================================================================

/** Authentication error codes */
export const AUTH_ERROR_CODES = {
  /** Invalid or expired TON Proof */
  INVALID_PROOF: 'INVALID_PROOF',
  /** Proof timestamp outside acceptable window */
  PROOF_EXPIRED: 'PROOF_EXPIRED',
  /** Partner ID not recognized */
  UNKNOWN_PARTNER: 'UNKNOWN_PARTNER',
  /** Server-side verification failed */
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  /** Internal server error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** User is blocked */
  USER_BLOCKED: 'USER_BLOCKED',
} as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

/** Repayment error codes */
export const REPAY_ERROR_CODES = {
  /** User cancelled the transaction */
  USER_CANCELLED: 'USER_CANCELLED',
  /** Transaction rejected by wallet */
  REJECTED: 'REJECTED',
  /** Insufficient funds for transaction */
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  /** Transaction timed out */
  TIMEOUT: 'TIMEOUT',
  /** Network error during transaction */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Unknown/unexpected error */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type RepayErrorCode = (typeof REPAY_ERROR_CODES)[keyof typeof REPAY_ERROR_CODES]

/** General error codes */
export const GENERAL_ERROR_CODES = {
  /** Message origin not in allowed list */
  INVALID_ORIGIN: 'INVALID_ORIGIN',
  /** Malformed message format */
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  /** Unsupported message type */
  UNSUPPORTED_MESSAGE: 'UNSUPPORTED_MESSAGE',
  /** Unsupported logo mode */
  UNSUPPORTED_LOGO_MODE: 'UNSUPPORTED_LOGO_MODE',
} as const

export type GeneralErrorCode = (typeof GENERAL_ERROR_CODES)[keyof typeof GENERAL_ERROR_CODES]

// =============================================================================
// Timeouts
// =============================================================================

/** Default timeout values in milliseconds */
export const TIMEOUTS = {
  /** Auth credentials processing timeout */
  AUTH_TIMEOUT: 30000,
  /** Repayment transaction timeout */
  REPAY_TIMEOUT: 60000,
  /** Message response timeout */
  MESSAGE_TIMEOUT: 10000,
} as const

// =============================================================================
// CSS Variables
// =============================================================================

/** Supported CSS variable names for styling */
export const CSS_VARIABLES = {
  // Colors
  '--tlend-primary': 'Primary brand color',
  '--tlend-primary-hover': 'Primary color on hover',
  '--tlend-secondary': 'Secondary brand color',
  '--tlend-background': 'Main background color',
  '--tlend-surface': 'Card/surface background',
  '--tlend-text': 'Primary text color',
  '--tlend-text-secondary': 'Secondary text color',
  '--tlend-border': 'Border color',
  '--tlend-success': 'Success state color',
  '--tlend-error': 'Error state color',
  '--tlend-warning': 'Warning state color',

  // Typography
  '--tlend-font-family': 'Font family',

  // Spacing & Sizing
  '--tlend-border-radius': 'Border radius',
  '--tlend-button-radius': 'Button border radius',
} as const

export type CSSVariableName = keyof typeof CSS_VARIABLES
