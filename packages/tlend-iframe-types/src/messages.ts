/**
 * TLend Partner Iframe Integration Protocol - Message Types
 * Based on RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md v2.2.0
 */

// =============================================================================
// Message Type Identifiers
// =============================================================================

export type MessageType =
  | 'TLEND_LOADED'
  | 'STYLES_UPGRADE'
  | 'SET_LOGO'
  | 'AUTH_CHECK_REQUEST'
  | 'AUTH_CHECK_RESPONSE'
  | 'AUTH_CREDENTIALS'
  | 'AUTH_RESULT'
  | 'AUTH_REQUEST'
  | 'TLEND_READY'
  | 'DISCONNECT'
  | 'REPAY_REQUEST'
  | 'REPAY_RESULT'
  | 'ERROR'

// =============================================================================
// Base Message
// =============================================================================

export interface BaseMessage {
  type: MessageType
  requestId?: string
  timestamp: number
}

// =============================================================================
// TLend → Partner Messages
// =============================================================================

/**
 * Sent immediately when TLend iframe loads
 */
export interface TLendLoadedMessage extends BaseMessage {
  type: 'TLEND_LOADED'
  payload: {
    /** Protocol version (e.g., "2.2.0") */
    version: string
    /** Supported capabilities */
    capabilities: string[]
  }
}

/**
 * Response to AUTH_CHECK_REQUEST
 */
export interface AuthCheckResponseMessage extends BaseMessage {
  type: 'AUTH_CHECK_RESPONSE'
  requestId: string
  payload: {
    /** Whether user is currently authenticated in TLend */
    authenticated: boolean
    /** Current authenticated address (raw format 0:...) */
    address?: string
    /** Whether current address matches requested address */
    matchesRequested: boolean
  }
}

/**
 * Result of AUTH_CREDENTIALS processing
 */
export interface AuthResultMessage extends BaseMessage {
  type: 'AUTH_RESULT'
  requestId: string
  payload: {
    success: boolean
    /** Authenticated address on success (raw format 0:...) */
    address?: string
    error?: {
      code: string
      message: string
    }
  }
}

/**
 * Sent when TLend needs re-authentication (e.g., JWT expired)
 */
export interface AuthRequestMessage extends BaseMessage {
  type: 'AUTH_REQUEST'
  payload: {
    reason: 'jwt_expired' | 'session_invalid' | 'storage_unavailable'
    /** Current address that needs re-auth (raw format 0:...) */
    currentAddress?: string
  }
}

/**
 * Sent when TLend is fully authenticated and ready
 */
export interface TLendReadyMessage extends BaseMessage {
  type: 'TLEND_READY'
  payload: {
    /** Authenticated user address (raw format 0:...) */
    address: string
  }
}

/**
 * Request for partner to execute a repayment transaction
 */
export interface RepayRequestMessage extends BaseMessage {
  type: 'REPAY_REQUEST'
  requestId: string
  payload: {
    /** Internal lend ID */
    lendId: number
    /** NFT index for the loan */
    nftIndex: string
    /** Amount to repay */
    amount: {
      /** Amount in smallest units (e.g., "50000000" for 50 USDT) */
      value: string
      /** Decimal places (6 for USDT) */
      decimals: number
      /** Human-readable amount (e.g., "50.00") */
      formatted: string
      /** Currency symbol */
      currency: string
    }
    /** TON Connect compatible transaction */
    transaction: {
      validUntil: number
      messages: Array<{
        /** Destination address (EQ... format for TON Connect) */
        address: string
        /** TON amount in nanotons */
        amount: string
        /** Base64-encoded BOC payload */
        payload?: string
      }>
    }
    /** Additional context */
    metadata: {
      /** User's wallet address (raw format 0:...) */
      userAddress: string
      /** TLend contract address */
      tLendContractAddress: string
      /** USDT jetton master address */
      jettonMasterAddress: string
    }
  }
}

/**
 * Error message for any error condition
 */
export interface ErrorMessage extends BaseMessage {
  type: 'ERROR'
  payload: {
    code: string
    message: string
    details?: Record<string, unknown>
    /** Whether the error is recoverable */
    recoverable: boolean
  }
}

// =============================================================================
// Partner → TLend Messages
// =============================================================================

/**
 * Apply custom CSS variables to TLend UI
 */
export interface StylesUpgradeMessage extends BaseMessage {
  type: 'STYLES_UPGRADE'
  payload: {
    /** CSS variable overrides */
    styles: Record<string, string>
    /** Optional theme hint */
    theme?: 'light' | 'dark'
  }
}

/**
 * Configure logo display mode
 */
export interface SetLogoMessage extends BaseMessage {
  type: 'SET_LOGO'
  payload: {
    /** Logo display mode */
    mode: 'tlend_only' | 'partner_only' | 'combined'
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
}

/**
 * Check if user is authenticated in TLend
 */
export interface AuthCheckRequestMessage extends BaseMessage {
  type: 'AUTH_CHECK_REQUEST'
  requestId: string
  payload: {
    /** Wallet address to check (raw format 0:...) */
    walletAddress: string
  }
}

/**
 * TON Proof for wallet authentication
 */
export interface TonProof {
  timestamp: number
  domain: {
    lengthBytes: number
    value: string
  }
  payload: string
  signature: string
}

/**
 * TON wallet account information
 */
export interface TonAccount {
  /** Wallet address (raw format 0:...) */
  address: string
  /** Chain ID (-239 for mainnet, -3 for testnet) */
  chain: string
  /** Wallet public key (hex) */
  publicKey: string
  /** Wallet type/version */
  walletStateInit?: string
}

/**
 * Provide authentication credentials to TLend
 */
export interface AuthCredentialsMessage extends BaseMessage {
  type: 'AUTH_CREDENTIALS'
  requestId: string
  payload: {
    /** TON Connect account */
    account: TonAccount
    /** TON Proof signature */
    proof: TonProof
    /** Partner identifier */
    partnerId: string
    /** Optional reference ID for tracking */
    referenceId?: string
  }
}

/**
 * Notify TLend of user disconnect
 */
export interface DisconnectMessage extends BaseMessage {
  type: 'DISCONNECT'
  payload: {
    reason?: 'user_initiated' | 'wallet_changed' | 'session_expired'
  }
}

/**
 * Result of repayment transaction execution
 */
export interface RepayResultMessage extends BaseMessage {
  type: 'REPAY_RESULT'
  requestId: string
  payload: {
    success: boolean
    /** Transaction hash on success */
    transactionHash?: string
    /** Explorer URL for the transaction */
    explorerUrl?: string
    error?: {
      code: string
      message: string
      /** Whether user explicitly cancelled */
      userCancelled?: boolean
    }
  }
}

// =============================================================================
// Union Type for All Messages
// =============================================================================

export type IframeMessage =
  | TLendLoadedMessage
  | StylesUpgradeMessage
  | SetLogoMessage
  | AuthCheckRequestMessage
  | AuthCheckResponseMessage
  | AuthCredentialsMessage
  | AuthResultMessage
  | AuthRequestMessage
  | TLendReadyMessage
  | DisconnectMessage
  | RepayRequestMessage
  | RepayResultMessage
  | ErrorMessage

// =============================================================================
// Message Direction Types
// =============================================================================

/** Messages sent from TLend to Partner */
export type TLendToPartnerMessage =
  | TLendLoadedMessage
  | AuthCheckResponseMessage
  | AuthResultMessage
  | AuthRequestMessage
  | TLendReadyMessage
  | RepayRequestMessage
  | ErrorMessage

/** Messages sent from Partner to TLend */
export type PartnerToTLendMessage =
  | StylesUpgradeMessage
  | SetLogoMessage
  | AuthCheckRequestMessage
  | AuthCredentialsMessage
  | DisconnectMessage
  | RepayResultMessage
