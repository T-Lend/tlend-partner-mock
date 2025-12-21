/**
 * TLend Partner Iframe Integration Protocol - Lifecycle Types
 * Based on RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md v2.2.0
 */

// =============================================================================
// Lifecycle States
// =============================================================================

/**
 * TLend iframe lifecycle states
 *
 * State transitions:
 * LOADING → PENDING_AUTH → READY
 *                ↓           ↓
 *              ERROR ←───────┘
 */
export type IframeLifecycleState = 'LOADING' | 'PENDING_AUTH' | 'READY' | 'ERROR'

// =============================================================================
// Logo Configuration
// =============================================================================

/** Logo display modes */
export type LogoMode = 'tlend_only' | 'partner_only' | 'combined'

/** Logo configuration */
export interface LogoConfig {
  /** Display mode */
  mode: LogoMode
  /** Partner logo URL (for partner_only mode) */
  partnerLogoUrl?: string
  /** Partner name (for alt text) */
  partnerName?: string
  /** Combined logo URL (for combined mode) */
  combinedLogoUrl?: string
  /** Logo width (CSS value, e.g., "120px", "auto") */
  width?: string
  /** Logo height (CSS value, e.g., "32px", "auto") */
  height?: string
}

// =============================================================================
// Disconnect Reasons
// =============================================================================

/** Reasons for disconnection */
export type DisconnectReason = 'user_initiated' | 'wallet_changed' | 'session_expired'

// =============================================================================
// Auth Request Reasons
// =============================================================================

/** Reasons for auth re-request */
export type AuthRequestReason = 'jwt_expired' | 'session_invalid' | 'storage_unavailable'

// =============================================================================
// Amount Type
// =============================================================================

/** Standardized amount representation */
export interface Amount {
  /** Amount in smallest units (e.g., "50000000" for 50 USDT) */
  value: string
  /** Decimal places (6 for USDT) */
  decimals: number
  /** Human-readable amount (e.g., "50.00") */
  formatted: string
  /** Currency symbol */
  currency: string
}

// =============================================================================
// Transaction Type
// =============================================================================

/** TON Connect compatible transaction message */
export interface TransactionMessage {
  /** Destination address (EQ... format for TON Connect) */
  address: string
  /** TON amount in nanotons */
  amount: string
  /** Base64-encoded BOC payload */
  payload?: string
}

/** TON Connect compatible transaction */
export interface Transaction {
  /** Unix timestamp when transaction becomes invalid */
  validUntil: number
  /** Transaction messages */
  messages: TransactionMessage[]
}
