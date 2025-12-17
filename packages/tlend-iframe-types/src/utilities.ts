/**
 * TLend Partner Iframe Integration Protocol - Utility Types & Guards
 * Based on RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md v2.2.0
 */

import type { IframeMessage, MessageType, BaseMessage } from './messages'

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid iframe message
 */
export function isIframeMessage(value: unknown): value is IframeMessage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const msg = value as Record<string, unknown>

  return (
    typeof msg.type === 'string' &&
    typeof msg.timestamp === 'number' &&
    isValidMessageType(msg.type)
  )
}

/**
 * Check if a string is a valid message type
 */
export function isValidMessageType(type: string): type is MessageType {
  const validTypes: MessageType[] = [
    'TLEND_LOADED',
    'STYLES_UPGRADE',
    'SET_LOGO',
    'AUTH_CHECK_REQUEST',
    'AUTH_CHECK_RESPONSE',
    'AUTH_CREDENTIALS',
    'AUTH_RESULT',
    'AUTH_REQUEST',
    'TLEND_READY',
    'DISCONNECT',
    'REPAY_REQUEST',
    'REPAY_RESULT',
    'ERROR',
  ]
  return validTypes.includes(type as MessageType)
}

/**
 * Check if message is from TLend to Partner
 */
export function isTLendToPartnerMessage(msg: IframeMessage): boolean {
  const tlendTypes: MessageType[] = [
    'TLEND_LOADED',
    'AUTH_CHECK_RESPONSE',
    'AUTH_RESULT',
    'AUTH_REQUEST',
    'TLEND_READY',
    'REPAY_REQUEST',
    'ERROR',
  ]
  return tlendTypes.includes(msg.type)
}

/**
 * Check if message is from Partner to TLend
 */
export function isPartnerToTLendMessage(msg: IframeMessage): boolean {
  const partnerTypes: MessageType[] = [
    'STYLES_UPGRADE',
    'SET_LOGO',
    'AUTH_CHECK_REQUEST',
    'AUTH_CREDENTIALS',
    'DISCONNECT',
    'REPAY_RESULT',
  ]
  return partnerTypes.includes(msg.type)
}

// =============================================================================
// Message Helpers
// =============================================================================

/**
 * Create a base message with timestamp
 */
export function createBaseMessage<T extends MessageType>(type: T): BaseMessage & { type: T } {
  return {
    type,
    timestamp: Date.now(),
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(prefix: string = 'req'): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}`
}

// =============================================================================
// Address Utilities
// =============================================================================

/**
 * TON address formats used in the protocol
 *
 * - Raw format (0:...): Used in auth messages, internal storage
 * - User-friendly format (EQ.../UQ...): Used in TON Connect transactions
 */
export type AddressFormat = 'raw' | 'user-friendly'

/**
 * Validate a TON address format
 */
export function isValidTonAddress(address: string, format?: AddressFormat): boolean {
  if (!address || typeof address !== 'string') {
    return false
  }

  if (format === 'raw') {
    // Raw format: 0:hex (workchain:hash)
    return /^-?\d+:[a-fA-F0-9]{64}$/.test(address)
  }

  if (format === 'user-friendly') {
    // User-friendly format: starts with EQ or UQ (bounceable/non-bounceable)
    return /^[EU]Q[A-Za-z0-9_-]{46}$/.test(address)
  }

  // Either format
  return (
    /^-?\d+:[a-fA-F0-9]{64}$/.test(address) ||
    /^[EU]Q[A-Za-z0-9_-]{46}$/.test(address)
  )
}

// =============================================================================
// Event Emitter Types
// =============================================================================

/** Handler function for message events */
export type MessageHandler<T extends IframeMessage = IframeMessage> = (message: T) => void

/** Unsubscribe function returned by event subscriptions */
export type Unsubscribe = () => void

/** Message event listener options */
export interface MessageListenerOptions {
  /** Only handle messages from this origin */
  allowedOrigin?: string
  /** List of allowed origins (alternative to single origin) */
  allowedOrigins?: string[]
  /** Whether to validate message structure */
  validateMessage?: boolean
}
