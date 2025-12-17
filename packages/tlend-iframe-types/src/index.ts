/**
 * @tlend/iframe-types
 *
 * TypeScript type definitions for TLend Partner Iframe Integration Protocol
 * Based on RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md v2.2.0
 *
 * @packageDocumentation
 */

// Messages - All message types for iframe communication
export type {
  // Base & Union Types
  MessageType,
  BaseMessage,
  IframeMessage,
  TLendToPartnerMessage,
  PartnerToTLendMessage,

  // TLend → Partner Messages
  TLendLoadedMessage,
  AuthCheckResponseMessage,
  AuthResultMessage,
  AuthRequestMessage,
  TLendReadyMessage,
  RepayRequestMessage,
  ErrorMessage,

  // Partner → TLend Messages
  StylesUpgradeMessage,
  SetLogoMessage,
  AuthCheckRequestMessage,
  AuthCredentialsMessage,
  DisconnectMessage,
  RepayResultMessage,

  // Supporting Types
  TonProof,
  TonAccount,
} from './messages'

// Lifecycle - States and configurations
export type {
  IframeLifecycleState,
  LogoMode,
  LogoConfig,
  DisconnectReason,
  AuthRequestReason,
  Amount,
  TransactionMessage,
  Transaction,
} from './lifecycle'

// Constants - Protocol version, capabilities, error codes
export {
  TLEND_PROTOCOL_VERSION,
  TLEND_CAPABILITIES,
  AUTH_ERROR_CODES,
  REPAY_ERROR_CODES,
  GENERAL_ERROR_CODES,
  TIMEOUTS,
  CSS_VARIABLES,
} from './constants'

export type {
  TLendCapability,
  AuthErrorCode,
  RepayErrorCode,
  GeneralErrorCode,
  CSSVariableName,
} from './constants'

// Utilities - Type guards, helpers, validators
export {
  isIframeMessage,
  isValidMessageType,
  isTLendToPartnerMessage,
  isPartnerToTLendMessage,
  createBaseMessage,
  generateRequestId,
  isValidTonAddress,
} from './utilities'

export type {
  AddressFormat,
  MessageHandler,
  Unsubscribe,
  MessageListenerOptions,
} from './utilities'
