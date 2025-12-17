# @tlend/iframe-types

TypeScript type definitions for the TLend Partner Iframe Integration Protocol.

This package provides type-safe interfaces for implementing the communication protocol between TLend (embedded iframe) and partner applications.

## Installation

```bash
npm install @tlend/iframe-types
# or
yarn add @tlend/iframe-types
# or
pnpm add @tlend/iframe-types
```

## Usage

### Importing Types

```typescript
import type {
  // Message types
  IframeMessage,
  TLendLoadedMessage,
  AuthCredentialsMessage,
  RepayRequestMessage,
  RepayResultMessage,

  // Lifecycle types
  IframeLifecycleState,
  LogoConfig,

  // Supporting types
  TonAccount,
  TonProof,
  Amount,
  Transaction,
} from '@tlend/iframe-types'

// Constants
import {
  TLEND_PROTOCOL_VERSION,
  TLEND_CAPABILITIES,
  AUTH_ERROR_CODES,
  REPAY_ERROR_CODES,
  TIMEOUTS,
} from '@tlend/iframe-types'

// Utilities
import {
  isIframeMessage,
  isValidMessageType,
  generateRequestId,
  isValidTonAddress,
} from '@tlend/iframe-types'
```

### Example: Partner Application

```typescript
import type {
  TLendLoadedMessage,
  RepayRequestMessage,
  AuthCredentialsMessage,
} from '@tlend/iframe-types'
import { isIframeMessage, generateRequestId } from '@tlend/iframe-types'

// Listen for messages from TLend iframe
window.addEventListener('message', (event) => {
  if (!isIframeMessage(event.data)) return

  const message = event.data

  switch (message.type) {
    case 'TLEND_LOADED':
      console.log('TLend version:', message.payload.version)
      console.log('Capabilities:', message.payload.capabilities)
      break

    case 'REPAY_REQUEST':
      // Handle repayment request
      handleRepayRequest(message as RepayRequestMessage)
      break
  }
})

// Send authentication credentials to TLend
function sendAuthCredentials(account: TonAccount, proof: TonProof) {
  const iframe = document.querySelector('iframe')
  const message: AuthCredentialsMessage = {
    type: 'AUTH_CREDENTIALS',
    requestId: generateRequestId('auth'),
    timestamp: Date.now(),
    payload: {
      account,
      proof,
      partnerId: 'your-partner-id',
    },
  }

  iframe?.contentWindow?.postMessage(message, 'https://app.tlend.co')
}
```

### Example: Using Type Guards

```typescript
import { isIframeMessage, isTLendToPartnerMessage } from '@tlend/iframe-types'

window.addEventListener('message', (event) => {
  // Validate message structure
  if (!isIframeMessage(event.data)) {
    console.warn('Invalid message format')
    return
  }

  // Check message direction
  if (isTLendToPartnerMessage(event.data)) {
    // Handle TLend → Partner messages
  }
})
```

## Message Types

### TLend → Partner

| Type | Description |
|------|-------------|
| `TLEND_LOADED` | Sent when iframe loads, contains version and capabilities |
| `AUTH_CHECK_RESPONSE` | Response to auth check request |
| `AUTH_RESULT` | Result of authentication attempt |
| `AUTH_REQUEST` | Request for re-authentication (e.g., JWT expired) |
| `TLEND_READY` | Sent when fully authenticated and ready |
| `REPAY_REQUEST` | Request to execute repayment transaction |
| `ERROR` | Error notification |

### Partner → TLend

| Type | Description |
|------|-------------|
| `STYLES_UPGRADE` | Apply custom CSS variables |
| `SET_LOGO` | Configure logo display mode |
| `AUTH_CHECK_REQUEST` | Check if user is authenticated |
| `AUTH_CREDENTIALS` | Provide TON Proof credentials |
| `DISCONNECT` | Notify of user disconnect |
| `REPAY_RESULT` | Result of repayment transaction |

## Constants

```typescript
import {
  TLEND_PROTOCOL_VERSION,  // '2.2.0'
  TLEND_CAPABILITIES,       // ['auth_delegation', 'repay_delegation', ...]
  AUTH_ERROR_CODES,         // { INVALID_PROOF, PROOF_EXPIRED, ... }
  REPAY_ERROR_CODES,        // { USER_CANCELLED, INSUFFICIENT_FUNDS, ... }
  TIMEOUTS,                 // { AUTH_TIMEOUT: 30000, REPAY_TIMEOUT: 60000, ... }
  CSS_VARIABLES,            // Supported CSS variable names
} from '@tlend/iframe-types'
```

## Address Formats

The protocol uses two address formats:

- **Raw format** (`0:abc123...`): Used in auth messages and internal storage
- **User-friendly format** (`EQ...` / `UQ...`): Used in TON Connect transactions

```typescript
import { isValidTonAddress } from '@tlend/iframe-types'

isValidTonAddress('0:abc...', 'raw')           // true/false
isValidTonAddress('EQAbc...', 'user-friendly') // true/false
isValidTonAddress('0:abc...')                  // accepts either format
```

## Documentation

For the complete protocol specification, see [RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md](../../RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md).

## License

MIT
