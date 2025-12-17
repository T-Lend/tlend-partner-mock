# RFC-001: TLend Partner Iframe Integration Protocol

**Status:** Draft
**Version:** 2.0.0
**Date:** 2025-12-17
**Authors:** TLend Team

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Motivation](#2-motivation)
3. [Overview](#3-overview)
4. [Integration Architecture](#4-integration-architecture)
5. [Message Protocol Specification](#5-message-protocol-specification)
6. [Track 1: UI/UX Customization](#6-track-1-uiux-customization)
7. [Track 2: Authentication Flow](#7-track-2-authentication-flow)
8. [Track 3: Repayment Flow](#8-track-3-repayment-flow)
9. [Session Lifecycle Management](#9-session-lifecycle-management)
10. [Security Considerations](#10-security-considerations)
11. [Error Handling](#11-error-handling)
12. [Partner Onboarding](#12-partner-onboarding)
13. [Implementation Checklist](#13-implementation-checklist)
14. [Appendix](#14-appendix)

---

## 1. Abstract

This document specifies the technical protocol for integrating TLend's lending platform within partner applications via an iframe. The integration enables partner users to access TLend services seamlessly while maintaining security, proper authentication, and consistent user experience across both platforms.

The integration consists of three main tracks:
1. **UI/UX Customization** - Dynamic styling and branding adjustments
2. **Authentication Flow** - Delegated wallet authentication via Partner
3. **Repayment Flow** - Transaction delegation for loan repayments

This protocol is designed as a **whitelabel solution** that any partner can implement.

---

## 2. Motivation

Partners (DeFi protocols, wallets, aggregators) may seek to integrate TLend's lending services directly within their platforms. This integration provides:

- **Enhanced User Experience**: Users access TLend without leaving the partner application
- **Unified Authentication**: Single wallet connection shared between platforms
- **Streamlined Transactions**: Repayments handled through Partner's infrastructure
- **Consistent Branding**: TLend UI adapts to Partner's design language

---

## 3. Overview

### 3.1 Integration Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     Partner Application                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Parent Window                        │  │
│  │  - TON Connect UI (wallet management)                     │  │
│  │  - User authentication state                              │  │
│  │  - Transaction signing capability                         │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              TLend Iframe                           │  │  │
│  │  │  - Loan management UI                               │  │  │
│  │  │  - Hides own TON Connect UI                         │  │  │
│  │  │  - Delegates auth to parent                         │  │  │
│  │  │  - Requests transactions via postMessage            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Communication Model

All communication between Partner (parent) and TLend (iframe) uses the `window.postMessage()` API with structured JSON messages.

```typescript
interface IframeMessage {
  type: string;           // Message type identifier
  payload?: object;       // Message-specific data
  requestId?: string;     // For request-response correlation
  timestamp: number;      // Unix timestamp in milliseconds
}
```

### 3.3 Environment Detection

TLend detects iframe embedding via:

```typescript
const isEmbedded = window.parent !== window;
const partnerId = new URLSearchParams(window.location.search).get('partner');
```

---

## 4. Integration Architecture

### 4.1 Lifecycle States

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   LOADING    │ ──► │   PENDING    │ ──► │    READY     │
│              │     │    AUTH      │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    ▼                    │
       │            ┌──────────────┐             │
       └──────────► │    ERROR     │ ◄───────────┘
                    └──────────────┘
```

| State          | Description                                        |
|----------------|----------------------------------------------------|
| `LOADING`      | TLend iframe is loading, not yet initialized       |
| `PENDING_AUTH` | TLend loaded, awaiting authentication from Partner |
| `READY`        | TLend authenticated and fully operational          |
| `ERROR`        | An error occurred; iframe should not be displayed  |

### 4.2 Origin Validation

Both parties MUST validate message origins:

**TLend (iframe) validates:**
```typescript
// Allowed origins are configured per partner during onboarding
const ALLOWED_ORIGINS = getAllowedOriginsForPartner(partnerId);

window.addEventListener('message', (event) => {
  if (!ALLOWED_ORIGINS.includes(event.origin)) {
    console.warn('Rejected message from unauthorized origin:', event.origin);
    return;
  }
  // Process message...
});
```

**Partner (parent) validates:**
```typescript
const TLEND_ORIGIN = 'https://tlend.co';

window.addEventListener('message', (event) => {
  if (event.origin !== TLEND_ORIGIN) {
    return;
  }
  // Process message...
});
```

---

## 5. Message Protocol Specification

### 5.1 Message Types Overview

| Direction       | Type                  | Purpose                                |
|-----------------|-----------------------|----------------------------------------|
| TLend → Partner | `TLEND_LOADED`        | Initial load notification              |
| Partner → TLend | `STYLES_UPGRADE`      | Apply custom styling (colors, theme)   |
| Partner → TLend | `SET_LOGO`            | Configure logo display                 |
| Partner → TLend | `AUTH_CHECK_REQUEST`  | Query authentication status            |
| TLend → Partner | `AUTH_CHECK_RESPONSE` | Report authentication status           |
| Partner → TLend | `AUTH_CREDENTIALS`    | Provide TON proof credentials          |
| TLend → Partner | `AUTH_RESULT`         | Report authentication result           |
| TLend → Partner | `AUTH_REQUEST`        | Request fresh credentials (JWT expired)|
| TLend → Partner | `TLEND_READY`         | SPA fully loaded and authenticated     |
| Partner → TLend | `DISCONNECT`          | User disconnected wallet in Partner    |
| TLend → Partner | `REPAY_REQUEST`       | Request repayment transaction          |
| Partner → TLend | `REPAY_RESULT`        | Report transaction result              |
| TLend → Partner | `ERROR`               | Report error condition                 |

### 5.2 Message Schemas

All messages conform to a base schema with type-specific payloads:

```typescript
// Base message structure
interface BaseMessage {
  type: string;
  requestId?: string;
  timestamp: number;
}
```

---

## 6. Track 1: UI/UX Customization

### 6.1 Overview

When displayed in Partner's iframe, TLend applies visual customizations:
- Custom CSS variables for colors and styling
- Partner-specific logo configuration
- Hidden native TON Connect UI elements

### 6.2 Sequence Diagram

```
┌─────────┐                           ┌───────┐
│ Partner │                           │ TLend │
└────┬────┘                           └───┬───┘
     │                                    │
     │      <iframe loads TLend>          │
     │                                    │
     │◄────── TLEND_LOADED ───────────────│
     │                                    │
     │─────── STYLES_UPGRADE ────────────►│
     │                                    │
     │─────── SET_LOGO ──────────────────►│
     │                                    │
     │        (TLend applies styles)      │
     │                                    │
```

### 6.3 Message: TLEND_LOADED

Sent by TLend immediately when the iframe script initializes.

```typescript
interface TLendLoadedMessage {
  type: 'TLEND_LOADED';
  timestamp: number;
  payload: {
    version: string;        // TLend app version
    capabilities: string[]; // Supported features
  };
}
```

**Capabilities:**
- `auth_delegation` - Supports delegated authentication
- `repay_delegation` - Supports delegated repayment transactions
- `custom_styles` - Supports custom CSS variables
- `custom_logo` - Supports custom logo configuration

**Example:**
```json
{
  "type": "TLEND_LOADED",
  "timestamp": 1734278400000,
  "payload": {
    "version": "2.1.0",
    "capabilities": ["auth_delegation", "repay_delegation", "custom_styles", "custom_logo"]
  }
}
```

### 6.4 Message: STYLES_UPGRADE

Sent by Partner to apply custom CSS variables. **Does not include logo configuration** (use SET_LOGO for that).

```typescript
interface StylesUpgradeMessage {
  type: 'STYLES_UPGRADE';
  timestamp: number;
  payload: {
    styles: Record<string, string>;  // CSS variable name → value
    theme?: 'light' | 'dark';        // Optional theme hint
  };
}
```

**Example:**
```json
{
  "type": "STYLES_UPGRADE",
  "timestamp": 1734278400000,
  "payload": {
    "styles": {
      "--primary-color": "#6366f1",
      "--background-color": "#0f0f23",
      "--text-color": "#ffffff",
      "--border-radius": "12px",
      "--button-bg": "#6366f1",
      "--button-text": "#ffffff",
      "--card-bg": "#1a1a2e",
      "--success-color": "#10b981",
      "--error-color": "#ef4444"
    },
    "theme": "dark"
  }
}
```

### 6.5 Message: SET_LOGO

Sent by Partner to configure logo display. Separate from STYLES_UPGRADE for flexibility.

```typescript
interface SetLogoMessage {
  type: 'SET_LOGO';
  timestamp: number;
  payload: {
    mode: 'tlend_only' | 'partner_only' | 'combined';
    partnerLogoUrl?: string;    // URL to partner's logo (required for combined/partner_only)
    partnerName?: string;       // Partner display name
    combinedLogoUrl?: string;   // Pre-made combined logo URL (optional)
  };
}
```

**Logo Modes:**
- `tlend_only` - Show only TLend logo (default)
- `partner_only` - Show only Partner logo
- `combined` - Show combined "TLend x Partner" logo

**Example:**
```json
{
  "type": "SET_LOGO",
  "timestamp": 1734278400000,
  "payload": {
    "mode": "combined",
    "partnerName": "Partner Finance",
    "partnerLogoUrl": "https://partner.com/logo.svg"
  }
}
```

### 6.6 TLend Implementation

```typescript
// styles-handler.ts
function handleStylesUpgrade(message: StylesUpgradeMessage): void {
  const { styles, theme } = message.payload;
  const root = document.documentElement;

  // Apply CSS variables
  Object.entries(styles).forEach(([key, value]) => {
    const cssVarName = key.startsWith('--') ? key : `--${key}`;
    root.style.setProperty(cssVarName, value);
  });

  // Apply theme class
  if (theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
  }
}

function handleSetLogo(message: SetLogoMessage): void {
  const { mode, partnerLogoUrl, partnerName, combinedLogoUrl } = message.payload;

  // Update logo component based on mode
  logoStore.setLogoMode(mode, { partnerLogoUrl, partnerName, combinedLogoUrl });
}
```

### 6.7 Supported CSS Variables

| Variable             | Description             | Example   |
|----------------------|-------------------------|-----------|
| `--primary-color`    | Primary brand color     | `#6366f1` |
| `--secondary-color`  | Secondary accent color  | `#8b5cf6` |
| `--background-color` | Main background         | `#0f0f23` |
| `--surface-color`    | Card/surface background | `#1a1a2e` |
| `--text-color`       | Primary text color      | `#ffffff` |
| `--text-secondary`   | Secondary text color    | `#a0a0a0` |
| `--border-color`     | Border color            | `#2d2d44` |
| `--border-radius`    | Global border radius    | `12px`    |
| `--button-bg`        | Button background       | `#6366f1` |
| `--button-text`      | Button text color       | `#ffffff` |
| `--success-color`    | Success state color     | `#10b981` |
| `--error-color`      | Error state color       | `#ef4444` |
| `--warning-color`    | Warning state color     | `#f59e0b` |

---

## 7. Track 2: Authentication Flow

### 7.1 Overview

TLend normally uses TON Connect UI for wallet authentication. In the Partner iframe context:
1. TLend's TON Connect UI is hidden
2. Authentication is delegated to Partner's parent window
3. Partner provides signed TON Proof credentials
4. TLend verifies and manages session internally

**Important:**
- TLend manages JWT tokens internally via localStorage
- Partner does NOT need to store or track JWT tokens
- Partner is the **authoritative source** for wallet state

### 7.2 Authentication Sequence

```
┌─────────┐                           ┌───────┐                    ┌─────────────┐
│ Partner │                           │ TLend │                    │ TLend       │
│ Parent  │                           │Iframe │                    │ Backend     │
└────┬────┘                           └───┬───┘                    └──────┬──────┘
     │                                    │                               │
     │ User clicks "Open TLend"           │                               │
     │                                    │                               │
     │      <iframe loads TLend>          │                               │
     │                                    │                               │
     │◄────── TLEND_LOADED ───────────────│                               │
     │                                    │                               │
     │─────── STYLES_UPGRADE ────────────►│                               │
     │                                    │                               │
     │─────── AUTH_CHECK_REQUEST ────────►│                               │
     │                                    │                               │
     │◄────── AUTH_CHECK_RESPONSE ────────│                               │
     │        (authenticated: false       │                               │
     │         OR matchesRequested: false)│                               │
     │                                    │                               │
     │─────── AUTH_CREDENTIALS ──────────►│                               │
     │                                    │                               │
     │                                    │──── POST /api/auth/verify ───►│
     │                                    │                               │
     │                                    │◄───── { accessToken } ────────│
     │                                    │                               │
     │                                    │    (TLend stores JWT          │
     │                                    │     in localStorage)          │
     │                                    │                               │
     │◄──────── AUTH_RESULT ──────────────│                               │
     │          (success: true)           │                               │
     │                                    │                               │
     │◄──────── TLEND_READY ──────────────│                               │
     │                                    │                               │
```

### 7.3 Message: AUTH_CHECK_REQUEST

Sent by Partner to query TLend's authentication status.

```typescript
interface AuthCheckRequestMessage {
  type: 'AUTH_CHECK_REQUEST';
  requestId: string;
  timestamp: number;
  payload: {
    walletAddress: string;  // The address Partner expects to be authenticated
  };
}
```

**Example:**
```json
{
  "type": "AUTH_CHECK_REQUEST",
  "requestId": "auth-check-001",
  "timestamp": 1734278400000,
  "payload": {
    "walletAddress": "0:d31ab96ff5a5b6715bd02e5fa7a905d1b4cc1b2f5a8498e74d64e1c090dcfa1b"
  }
}
```

### 7.4 Message: AUTH_CHECK_RESPONSE

Sent by TLend in response to AUTH_CHECK_REQUEST.

```typescript
interface AuthCheckResponseMessage {
  type: 'AUTH_CHECK_RESPONSE';
  requestId: string;
  timestamp: number;
  payload: {
    authenticated: boolean;
    address?: string;          // Current authenticated address (if any)
    matchesRequested: boolean; // Whether current auth matches requested address
  };
}
```

**Behavior when `matchesRequested: false`:**

Partner is the **authoritative source** for wallet state. When TLend reports `matchesRequested: false`:
- Partner MUST send fresh `AUTH_CREDENTIALS`
- No attempt to reuse existing TLend session
- This ensures wallet state is always synchronized

**Example (Not Authenticated):**
```json
{
  "type": "AUTH_CHECK_RESPONSE",
  "requestId": "auth-check-001",
  "timestamp": 1734278401000,
  "payload": {
    "authenticated": false,
    "matchesRequested": false
  }
}
```

**Example (Authenticated, Same Address):**
```json
{
  "type": "AUTH_CHECK_RESPONSE",
  "requestId": "auth-check-001",
  "timestamp": 1734278401000,
  "payload": {
    "authenticated": true,
    "address": "0:d31ab96ff5a5b6715bd02e5fa7a905d1b4cc1b2f5a8498e74d64e1c090dcfa1b",
    "matchesRequested": true
  }
}
```

**Example (Authenticated, Different Address - requires re-auth):**
```json
{
  "type": "AUTH_CHECK_RESPONSE",
  "requestId": "auth-check-001",
  "timestamp": 1734278401000,
  "payload": {
    "authenticated": true,
    "address": "0:different_address_here",
    "matchesRequested": false
  }
}
```

### 7.5 Message: AUTH_CREDENTIALS

Sent by Partner to provide TON Proof credentials for authentication.

```typescript
interface AuthCredentialsMessage {
  type: 'AUTH_CREDENTIALS';
  requestId: string;
  timestamp: number;
  payload: {
    account: {
      address: string;         // Raw TON address (e.g., "0:abc...")
      chain: string;           // Chain ID (e.g., "-239" for mainnet)
      publicKey: string;       // Hex-encoded public key
      walletStateInit: string; // Base64-encoded wallet state init
    };
    proof: {
      timestamp: number;       // Proof creation timestamp (Unix seconds)
      domain: {
        lengthBytes: number;   // Length of domain value in bytes
        value: string;         // Domain that signed the proof
      };
      payload: string;         // Challenge payload (see Section 12.2)
      signature: string;       // Base64-encoded signature
    };
    partnerId: string;         // Partner identifier (assigned during onboarding)
    referenceId?: string;      // Optional reference/tracking ID
  };
}
```

**Example:**
```json
{
  "type": "AUTH_CREDENTIALS",
  "requestId": "auth-cred-001",
  "timestamp": 1734278402000,
  "payload": {
    "account": {
      "address": "0:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260",
      "chain": "-239",
      "publicKey": "1438b5b41c638d01a71ee0d1413da6b6c5e9358da39fb412eb25195afdf83723",
      "walletStateInit": "te6cckECFgEAAwQA..."
    },
    "proof": {
      "timestamp": 1734278400,
      "domain": {
        "lengthBytes": 15,
        "value": "partner.finance"
      },
      "payload": "67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
      "signature": "IBhb3QNN/+LVVreSFx18gA6q+A/nKNl//EGa1I1rwr8vUSWVldmY6VX9kJVZqAG6zn1zKqELe7ToiPIBlvjzBQ=="
    },
    "partnerId": "partner_xyz",
    "referenceId": "user-session-12345"
  }
}
```

### 7.6 Message: AUTH_RESULT

Sent by TLend to report the authentication outcome.

```typescript
interface AuthResultMessage {
  type: 'AUTH_RESULT';
  requestId: string;
  timestamp: number;
  payload: {
    success: boolean;
    address?: string;       // Authenticated address on success
    error?: {
      code: string;         // Error code (see Error Codes section)
      message: string;      // Human-readable error message
    };
  };
}
```

**Note:** No `expiresAt` field - Partner does not need JWT expiration info. TLend manages tokens internally.

**Example (Success):**
```json
{
  "type": "AUTH_RESULT",
  "requestId": "auth-cred-001",
  "timestamp": 1734278403000,
  "payload": {
    "success": true,
    "address": "0:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260"
  }
}
```

**Example (Failure):**
```json
{
  "type": "AUTH_RESULT",
  "requestId": "auth-cred-001",
  "timestamp": 1734278403000,
  "payload": {
    "success": false,
    "error": {
      "code": "INVALID_SIGNATURE",
      "message": "TON proof signature verification failed"
    }
  }
}
```

### 7.7 Message: TLEND_READY

Sent by TLend when fully loaded, authenticated, and ready for display.

```typescript
interface TLendReadyMessage {
  type: 'TLEND_READY';
  timestamp: number;
  payload: {
    address: string;  // Authenticated wallet address
  };
}
```

**Example:**
```json
{
  "type": "TLEND_READY",
  "timestamp": 1734278410000,
  "payload": {
    "address": "0:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260"
  }
}
```

### 7.8 LocalStorage Considerations

**TLend stores JWT in localStorage** for session persistence. Browser behavior varies:

| Scenario                    | localStorage Access |
|-----------------------------|---------------------|
| Same-site cookies enabled   | Yes                 |
| Third-party cookies blocked | No                  |
| Safari with ITP             | No (after 7 days)   |
| Chrome with Privacy Sandbox | Varies              |

**Recommendation:**
- TLend attempts to use localStorage but doesn't rely on it
- Partner always sends `AUTH_CHECK_REQUEST` on iframe load
- If localStorage unavailable or expired, TLend requests fresh credentials
- This ensures authentication works regardless of browser restrictions

---

## 8. Track 3: Repayment Flow

### 8.1 Overview

When a user initiates a loan repayment within TLend's iframe:
1. TLend calculates the repayment transaction parameters
2. TLend sends transaction details to Partner
3. Partner constructs and prompts the user to sign the transaction
4. Partner broadcasts the transaction to the TON network
5. Partner reports the transaction result back to TLend

### 8.2 Repayment Sequence

```
┌─────────┐                           ┌───────┐                    ┌─────────────┐
│ Partner │                           │ TLend │                    │ TON Network │
│ Parent  │                           │Iframe │                    │             │
└────┬────┘                           └───┬───┘                    └──────┬──────┘
     │                                    │                               │
     │    User clicks "Repay" in TLend    │                               │
     │                                    │                               │
     │◄────── REPAY_REQUEST ──────────────│                               │
     │                                    │                               │
     │    (Partner shows confirmation)    │                               │
     │                                    │                               │
     │    (User signs in TON Connect)     │                               │
     │                                    │                               │
     │────────────────────────────────────┼──────────────────────────────►│
     │                                    │        (Transaction sent)     │
     │                                    │                               │
     │◄───────────────────────────────────┼───────────────────────────────│
     │           (Transaction confirmed)  │                               │
     │                                    │                               │
     │─────── REPAY_RESULT ──────────────►│                               │
     │                                    │                               │
     │                                    │    (TLend updates UI)         │
     │                                    │                               │
```

### 8.3 Message: REPAY_REQUEST

Sent by TLend when a user initiates a repayment.

```typescript
interface RepayRequestMessage {
  type: 'REPAY_REQUEST';
  requestId: string;
  timestamp: number;
  payload: {
    lendId: number;                // TLend loan ID
    nftIndex: string;              // NFT index (string to handle large numbers)
    amount: {
      value: string;               // Amount in smallest units (e.g., "1000000" for 1 USDT)
      decimals: number;            // Token decimals (6 for USDT)
      formatted: string;           // Human-readable amount (e.g., "1.00")
      currency: string;            // Token symbol (e.g., "USDT")
    };
    transaction: {
      // Pre-built transaction for Partner to sign and send
      validUntil: number;          // Unix timestamp when transaction expires
      messages: Array<{
        address: string;           // Destination address (user's Jetton wallet)
        amount: string;            // TON amount for gas (in nanotons)
        payload: string;           // Base64-encoded BOC payload
      }>;
    };
    metadata: {
      userAddress: string;          // User's wallet address
      tLendContractAddress: string; // TLend contract address
      jettonMasterAddress: string;  // USDT jetton master address
    };
  };
}
```

**Example:**
```json
{
  "type": "REPAY_REQUEST",
  "requestId": "repay-001",
  "timestamp": 1734278500000,
  "payload": {
    "lendId": 12345,
    "nftIndex": "42",
    "amount": {
      "value": "50000000",
      "decimals": 6,
      "formatted": "50.00",
      "currency": "USDT"
    },
    "transaction": {
      "validUntil": 1734278560,
      "messages": [
        {
          "address": "EQBx7JH9...",
          "amount": "60000000",
          "payload": "te6cckEBAQEA..."
        }
      ]
    },
    "metadata": {
      "userAddress": "0:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260",
      "tLendContractAddress": "EQC...",
      "jettonMasterAddress": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
    }
  }
}
```

### 8.4 Message: REPAY_RESULT

Sent by Partner to report the repayment transaction outcome.

```typescript
interface RepayResultMessage {
  type: 'REPAY_RESULT';
  requestId: string;
  timestamp: number;
  payload: {
    success: boolean;
    transactionHash?: string;     // BOC hash of the sent transaction
    explorerUrl?: string;         // Link to transaction in explorer
    error?: {
      code: string;               // Error code
      message: string;            // Human-readable error message
      userCancelled?: boolean;    // True if user rejected the transaction
    };
  };
}
```

**Example (Success):**
```json
{
  "type": "REPAY_RESULT",
  "requestId": "repay-001",
  "timestamp": 1734278520000,
  "payload": {
    "success": true,
    "transactionHash": "abc123def456...",
    "explorerUrl": "https://tonscan.org/tx/abc123def456..."
  }
}
```

**Example (User Cancelled):**
```json
{
  "type": "REPAY_RESULT",
  "requestId": "repay-001",
  "timestamp": 1734278520000,
  "payload": {
    "success": false,
    "error": {
      "code": "USER_REJECTED",
      "message": "Transaction was rejected by user",
      "userCancelled": true
    }
  }
}
```

---

## 9. Session Lifecycle Management

### 9.1 Overview

TLend and Partner must keep their session states synchronized. This section covers:
- Handling wallet disconnection in Partner
- Handling JWT expiration in TLend
- Re-authentication flows

### 9.2 Message: DISCONNECT

Sent by Partner when the user disconnects their wallet.

```typescript
interface DisconnectMessage {
  type: 'DISCONNECT';
  timestamp: number;
  payload: {
    reason?: string;  // Optional reason: 'user_initiated' | 'wallet_changed' | 'session_expired'
  };
}
```

**TLend Behavior on DISCONNECT:**
1. Clear localStorage (JWT, user data)
2. Reset UI to unauthenticated state
3. Wait for new `AUTH_CREDENTIALS` if user reconnects

**Example:**
```json
{
  "type": "DISCONNECT",
  "timestamp": 1734280000000,
  "payload": {
    "reason": "user_initiated"
  }
}
```

### 9.3 Message: AUTH_REQUEST

Sent by TLend when it needs fresh credentials (e.g., JWT expired, localStorage cleared).

```typescript
interface AuthRequestMessage {
  type: 'AUTH_REQUEST';
  timestamp: number;
  payload: {
    reason: 'jwt_expired' | 'session_invalid' | 'storage_unavailable';
    currentAddress?: string;  // Address TLend thinks is authenticated (if any)
  };
}
```

**Partner Behavior on AUTH_REQUEST:**
1. Generate fresh TON Proof with new challenge/payload
2. Send `AUTH_CREDENTIALS` with fresh credentials
3. If user is no longer connected, send `DISCONNECT`

**Example:**
```json
{
  "type": "AUTH_REQUEST",
  "timestamp": 1734290000000,
  "payload": {
    "reason": "jwt_expired",
    "currentAddress": "0:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260"
  }
}
```

### 9.4 Session State Diagram

```
Partner Wallet State          TLend Iframe State
─────────────────────         ──────────────────

   CONNECTED ──────────────────► AUTHENTICATED
       │                              │
       │ (user disconnects)           │ (JWT expires)
       ▼                              ▼
   DISCONNECTED                   NEEDS_AUTH
       │                              │
       │ DISCONNECT ─────────────────►│
       │                              │
       │                              │ AUTH_REQUEST
       │◄─────────────────────────────│
       │                              │
       │ AUTH_CREDENTIALS ───────────►│
       │ (if reconnected)             │
       │                              │
       │ DISCONNECT ─────────────────►│
       │ (if still disconnected)      │
```

### 9.5 Iframe Reload Behavior

When the iframe is reloaded (user navigates away and back, page refresh):
1. TLend sends `TLEND_LOADED` or `TLEND_READY`
2. Partner sends `AUTH_CHECK_REQUEST` with current wallet address
3. Normal authentication handshake proceeds
4. Fresh credentials are provided (challenges have expiration)

This ensures a clean authentication state on every iframe session.

---

## 10. Security Considerations

### 10.1 Origin Validation

**CRITICAL:** Both parties MUST validate `event.origin` on every message:

```typescript
// Partner - MUST validate TLend origin
const TLEND_ORIGIN = 'https://tlend.co';

window.addEventListener('message', (event) => {
  if (event.origin !== TLEND_ORIGIN) {
    return;
  }
  // Safe to process
});
```

### 10.2 Challenge Payload Verification

See [Section 12.2: Partner Payload Specification](#122-partner-payload-specification) for challenge format requirements.

### 10.3 TON Proof Verification

TLend backend MUST verify TON Proof signatures per [TON Connect specification](https://docs.ton.org/v3/guidelines/ton-connect/verifying-signed-in-users):

1. Verify `proof.domain.value` matches partner's registered domain
2. Verify `proof.timestamp` is recent (within acceptable window)
3. Verify `proof.payload` using partner-specific verification
4. Verify `proof.signature` against `account.publicKey`
5. Verify `account.walletStateInit` matches `account.address`

### 10.4 Replay Attack Prevention

**Challenge Payload:**
- Must contain expiration timestamp
- Must be cryptographically signed/verified
- TLend backend should track recent payloads to prevent replay

**Request IDs:**
- Each request has unique `requestId`
- Backend should track recent IDs

### 10.5 Content Security Policy & Iframe Embedding

**CRITICAL:** For a partner to embed TLend in an iframe, TLend MUST configure CSP `frame-ancestors` to allow the partner's origin. Without this, browsers will block the iframe.

```
Content-Security-Policy: frame-ancestors 'self' https://partner.com https://app.partner.com;
X-Frame-Options: ALLOW-FROM https://partner.com
```

**Why this matters:**
- Modern browsers enforce CSP by default
- Without `frame-ancestors`, the iframe will show a blank page or error
- Each partner origin must be explicitly whitelisted
- This is configured during partner onboarding (see Section 12.1)

**Partner checklist before going live:**
1. Confirm your production domain(s) are added to TLend's CSP
2. Test iframe embedding in staging environment first
3. Verify no browser console errors about frame blocking

### 10.6 Rate Limiting

TLend backend should rate limit:
- Authentication requests: 10 per minute per IP
- Repayment requests: 5 per minute per user

---

## 11. Error Handling

### 11.1 Error Codes

| Code                 | Description                      | Recovery Action                     |
|----------------------|----------------------------------|-------------------------------------|
| `INVALID_ORIGIN`     | Message from unauthorized origin | Ignore message                      |
| `INVALID_MESSAGE`    | Malformed message structure      | Report error to sender              |
| `AUTH_EXPIRED`       | Authentication token expired     | Request new credentials             |
| `INVALID_SIGNATURE`  | TON proof signature invalid      | Request new credentials             |
| `INVALID_PAYLOAD`    | Payload verification failed      | Request new credentials             |
| `PAYLOAD_EXPIRED`    | Payload timestamp expired        | Request new credentials             |
| `ADDRESS_MISMATCH`   | Wallet address mismatch          | Re-authenticate with correct wallet |
| `USER_REJECTED`      | User cancelled transaction       | Inform user, allow retry            |
| `INSUFFICIENT_FUNDS` | Not enough balance               | Display balance error               |
| `TRANSACTION_FAILED` | Network transaction failed       | Display error, allow retry          |
| `TIMEOUT`            | Operation timed out              | Allow retry                         |
| `INTERNAL_ERROR`     | Unexpected system error          | Display generic error               |
| `PARTNER_NOT_FOUND`  | Unknown partnerId                | Contact TLend for onboarding        |

### 11.2 Error Message Format

```typescript
interface ErrorMessage {
  type: 'ERROR';
  requestId?: string;        // If responding to a specific request
  timestamp: number;
  payload: {
    code: string;
    message: string;
    details?: object;        // Additional error context
    recoverable: boolean;    // Can the operation be retried?
  };
}
```

### 11.3 Timeout Handling

| Operation          | Timeout    | Action on Timeout             |
|--------------------|------------|-------------------------------|
| AUTH_CHECK_REQUEST | 5 seconds  | Report error, show fallback   |
| AUTH_CREDENTIALS   | 30 seconds | Report error, allow retry     |
| REPAY_REQUEST      | 60 seconds | Report error, check tx status |

---

## 12. Partner Onboarding

### 12.1 Onboarding Process

To integrate with TLend as a partner:

1. **Contact TLend Team** - Request partner integration
2. **Provide Information:**
   - Partner name and description
   - Domain(s) for all environments (staging, production)
   - Logo assets (SVG preferred)
   - Technical contact
3. **Domain Whitelisting** - TLend configures three related whitelists:

   | Whitelist | Purpose | Example |
   |-----------|---------|---------|
   | **CSP frame-ancestors** | Allow partner to embed TLend iframe | `https://app.partner.com` |
   | **postMessage origins** | Validate message sender | `https://app.partner.com` |
   | **TON Proof domains** | Verify `proof.domain.value` | `app.partner.com` |

   **Important:** All three use the same domain(s). Provide complete list upfront.

4. **Receive Configuration:**
   - `partnerId` - Unique partner identifier
   - HMAC shared secret (if using standard payload format)
   - Confirmation of whitelisted domains
5. **Implement Protocol** - Follow this RFC
6. **Testing** - Use TLend staging environment (`app-test.tlend.co`)
7. **Go Live** - Production deployment

### 12.2 TON Connect Manifest Requirements

Partners authenticate users via TON Connect on their own domain. This means:

- Partner MUST host their own `tonconnect-manifest.json` on their domain
- The manifest's domain becomes `proof.domain.value` in TON Proof
- TLend verifies this domain against the partner whitelist
- **Do NOT use TLend's manifest** - it won't match your domain

**Example manifest** (`https://app.partner.com/tonconnect-manifest.json`):
```json
{
  "url": "https://app.partner.com",
  "name": "Partner Finance",
  "iconUrl": "https://app.partner.com/logo.png"
}
```

When users connect, the TON Proof will contain `domain.value: "app.partner.com"`, which TLend will verify against the whitelist.

### 12.3 Partner Payload Specification

The `proof.payload` field in `AUTH_CREDENTIALS` must be verifiable by TLend. Partners have two options:

#### Option A: Standard HMAC Payload (Recommended)

Use TLend's standard 32-byte payload format with shared HMAC secret:

```
┌─────────────────────────────────────────────────────────────────┐
│                      32 bytes (64 hex chars)                    │
├────────────────┬────────────────────────────────────────────────┤
│  Bytes 0-3     │  Bytes 4-31                                    │
│  (4 bytes)     │  (28 bytes)                                    │
├────────────────┼────────────────────────────────────────────────┤
│  Expiration    │  HMAC-SHA256 Signature (truncated)             │
│  Timestamp     │  HMAC(expiration_time, SHARED_SECRET)[0:28]    │
│  (Big Endian)  │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

**Partner Implementation:**
```typescript
function generatePayload(sharedSecret: Buffer): string {
  // Expiration: 5-30 minutes in the future
  const expirationTime = Math.floor(Date.now() / 1000) + (15 * 60);

  const expirationBuffer = Buffer.alloc(4);
  expirationBuffer.writeUInt32BE(expirationTime, 0);

  const hmac = crypto.createHmac('sha256', sharedSecret);
  hmac.update(expirationBuffer);
  const signature = hmac.digest().subarray(0, 28);

  return Buffer.concat([expirationBuffer, signature]).toString('hex');
}
```

**TLend Verification:**
```typescript
function verifyPartnerPayload(payloadHex: string, sharedSecret: Buffer): boolean {
  const payloadBuffer = Buffer.from(payloadHex, 'hex');

  if (payloadBuffer.length < 32) {
    return false;
  }

  // Extract expiration timestamp
  const expirationTimestamp = payloadBuffer.readUInt32BE(0);

  // Check if expired
  const now = Math.floor(Date.now() / 1000);
  if (expirationTimestamp <= now || expirationTimestamp > now + 30 * 60) {
    return false;
  }

  // Verify HMAC
  const receivedSignature = payloadBuffer.subarray(4, 32);

  const expirationBuffer = Buffer.alloc(4);
  expirationBuffer.writeUInt32BE(expirationTimestamp, 0);

  const hmac = crypto.createHmac('sha256', sharedSecret);
  hmac.update(expirationBuffer);
  const expectedSignature = hmac.digest().subarray(0, 28);

  return crypto.timingSafeEqual(receivedSignature, expectedSignature);
}
```

#### Option B: TLend Challenge Endpoint (Simpler)

If partner cannot manage HMAC shared secrets, they can use TLend's challenge endpoint:

1. Partner calls TLend's challenge endpoint before TON Connect:
   ```
   GET https://backend.tlend.co/api/auth/challenge

   Response: { "challenge": "iGE2WPrESdwAAAGbLBOTnhyn1e/uiQEr..." }
   ```

2. Partner uses this challenge as the `tonProof` payload in TON Connect
3. TLend verifies the challenge since TLend generated it

**Partner Implementation:**
```typescript
async function getProofPayload(): Promise<string> {
  const response = await fetch('https://backend.tlend.co/api/auth/challenge');
  const data = await response.json();
  return data.challenge;
}

// Use in TON Connect
tonConnectUI.setConnectRequestParameters({
  state: 'ready',
  value: { tonProof: await getProofPayload() }
});
```

**Note:** Option B requires an extra API call but avoids shared secret management. Option A is more efficient for high-volume partners.

### 12.4 Partner Configuration at TLend

TLend maintains partner configuration:

```typescript
interface PartnerConfig {
  partnerId: string;
  name: string;
  allowedOrigins: string[];        // For postMessage validation & CSP frame-ancestors
  allowedDomains: string[];        // For TON Proof domain verification
  hmacSecret?: string;             // For Option A payload verification (optional)
  logoUrl?: string;
  active: boolean;
}
```

**Notes:**
- `allowedOrigins` is used for both postMessage validation and CSP `frame-ancestors` header generation
- `hmacSecret` is only needed if partner uses Option A; Option B uses TLend's challenge endpoint

---

## 13. Implementation Checklist

### 13.1 Partner Implementation

#### Phase 1: Basic Integration
- [ ] Implement iframe embedding with TLend URL + `?partner=YOUR_PARTNER_ID`
- [ ] Add message listener for TLend messages
- [ ] Implement `TLEND_LOADED` / `TLEND_READY` handler
- [ ] Send `STYLES_UPGRADE` with partner theme
- [ ] Send `SET_LOGO` with partner branding
- [ ] Show loading state until `TLEND_READY`

#### Phase 2: Authentication
- [ ] Implement `AUTH_CHECK_REQUEST` sending
- [ ] Handle `AUTH_CHECK_RESPONSE`
- [ ] Generate payload (Option A or B)
- [ ] Send `AUTH_CREDENTIALS` with TON proof
- [ ] Handle `AUTH_RESULT` (success/failure)
- [ ] Handle `AUTH_REQUEST` (re-auth needed)
- [ ] Display iframe after `TLEND_READY`

#### Phase 3: Session Management
- [ ] Send `DISCONNECT` when user disconnects wallet
- [ ] Handle wallet changes (disconnect + new auth)
- [ ] Handle `AUTH_REQUEST` for expired sessions

#### Phase 4: Repayment
- [ ] Handle `REPAY_REQUEST` messages
- [ ] Show repayment confirmation modal
- [ ] Execute transaction via TON Connect
- [ ] Send `REPAY_RESULT` on completion
- [ ] Handle user rejection gracefully

#### Phase 5: Error Handling
- [ ] Implement timeout handling
- [ ] Display user-friendly error messages
- [ ] Add retry mechanisms
- [ ] Log errors for debugging

### 13.2 TLend Implementation

#### Phase 1: Iframe Detection
- [ ] Detect iframe context on load
- [ ] Parse `partner` query parameter
- [ ] Send `TLEND_LOADED` message
- [ ] Add origin validation for all messages
- [ ] Hide TON Connect UI in iframe context

#### Phase 2: Styling
- [ ] Handle `STYLES_UPGRADE` messages
- [ ] Handle `SET_LOGO` messages
- [ ] Apply CSS variables dynamically
- [ ] Implement logo component with modes
- [ ] Test theme switching

#### Phase 3: Authentication
- [ ] Handle `AUTH_CHECK_REQUEST`
- [ ] Send `AUTH_CHECK_RESPONSE` with localStorage status
- [ ] Receive `AUTH_CREDENTIALS` from Partner
- [ ] Call backend `/api/auth/verify` with credentials
- [ ] Store JWT in localStorage on success
- [ ] Send `AUTH_RESULT` response
- [ ] Send `AUTH_REQUEST` when JWT expires
- [ ] Handle `DISCONNECT` - clear localStorage
- [ ] Send `TLEND_READY` when fully loaded

#### Phase 4: Repayment
- [ ] Intercept repayment action in iframe context
- [ ] Build transaction using `TLendTx.txPay()`
- [ ] Send `REPAY_REQUEST` to parent
- [ ] Handle `REPAY_RESULT` response
- [ ] Update UI based on transaction status

#### Phase 5: Backend
- [ ] Add partner configuration management
- [ ] Implement payload verification (Option A/B)
- [ ] Accept partner domains for TON Proof verification
- [ ] Add `partnerId` tracking to analytics

---

## 14. Appendix

### 14.1 TypeScript Type Definitions

```typescript
// Message Types
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
  | 'ERROR';

// Base Message
export interface BaseMessage {
  type: MessageType;
  requestId?: string;
  timestamp: number;
}

// All Message Interfaces
export interface TLendLoadedMessage extends BaseMessage {
  type: 'TLEND_LOADED';
  payload: {
    version: string;
    capabilities: string[];
  };
}

export interface StylesUpgradeMessage extends BaseMessage {
  type: 'STYLES_UPGRADE';
  payload: {
    styles: Record<string, string>;
    theme?: 'light' | 'dark';
  };
}

export interface SetLogoMessage extends BaseMessage {
  type: 'SET_LOGO';
  payload: {
    mode: 'tlend_only' | 'partner_only' | 'combined';
    partnerLogoUrl?: string;
    partnerName?: string;
    combinedLogoUrl?: string;
  };
}

export interface AuthCheckRequestMessage extends BaseMessage {
  type: 'AUTH_CHECK_REQUEST';
  requestId: string;
  payload: {
    walletAddress: string;
  };
}

export interface AuthCheckResponseMessage extends BaseMessage {
  type: 'AUTH_CHECK_RESPONSE';
  requestId: string;
  payload: {
    authenticated: boolean;
    address?: string;
    matchesRequested: boolean;
  };
}

export interface TonProofAccount {
  address: string;
  chain: string;
  publicKey: string;
  walletStateInit: string;
}

export interface TonProof {
  timestamp: number;
  domain: {
    lengthBytes: number;
    value: string;
  };
  payload: string;
  signature: string;
}

export interface AuthCredentialsMessage extends BaseMessage {
  type: 'AUTH_CREDENTIALS';
  requestId: string;
  payload: {
    account: TonProofAccount;
    proof: TonProof;
    partnerId: string;
    referenceId?: string;
  };
}

export interface AuthResultMessage extends BaseMessage {
  type: 'AUTH_RESULT';
  requestId: string;
  payload: {
    success: boolean;
    address?: string;
    error?: {
      code: string;
      message: string;
    };
  };
}

export interface AuthRequestMessage extends BaseMessage {
  type: 'AUTH_REQUEST';
  payload: {
    reason: 'jwt_expired' | 'session_invalid' | 'storage_unavailable';
    currentAddress?: string;
  };
}

export interface TLendReadyMessage extends BaseMessage {
  type: 'TLEND_READY';
  payload: {
    address: string;
  };
}

export interface DisconnectMessage extends BaseMessage {
  type: 'DISCONNECT';
  payload: {
    reason?: 'user_initiated' | 'wallet_changed' | 'session_expired';
  };
}

export interface RepayAmount {
  value: string;
  decimals: number;
  formatted: string;
  currency: string;
}

export interface RepayTransaction {
  validUntil: number;
  messages: Array<{
    address: string;
    amount: string;
    payload: string;
  }>;
}

export interface RepayRequestMessage extends BaseMessage {
  type: 'REPAY_REQUEST';
  requestId: string;
  payload: {
    lendId: number;
    nftIndex: string;
    amount: RepayAmount;
    transaction: RepayTransaction;
    metadata: {
      userAddress: string;
      tLendContractAddress: string;
      jettonMasterAddress: string;
    };
  };
}

export interface RepayResultMessage extends BaseMessage {
  type: 'REPAY_RESULT';
  requestId: string;
  payload: {
    success: boolean;
    transactionHash?: string;
    explorerUrl?: string;
    error?: {
      code: string;
      message: string;
      userCancelled?: boolean;
    };
  };
}

export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    details?: object;
    recoverable: boolean;
  };
}

// Union type for all messages
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
  | ErrorMessage;
```

### 14.2 Test Scenarios

#### Authentication Tests
1. Happy path: User not authenticated → Partner sends credentials → Success
2. Already authenticated, same address → Skip credential exchange
3. Already authenticated, different address → Force re-authentication
4. Invalid payload → Error response
5. Expired payload → Error response
6. Invalid signature → Error response
7. JWT expired → TLend sends AUTH_REQUEST → Partner re-authenticates
8. User disconnects → Partner sends DISCONNECT → TLend clears session

#### Repayment Tests
1. Happy path: Repay request → User signs → Success
2. User cancels transaction → Proper error handling
3. Insufficient funds → Error with balance info
4. Network error → Retry mechanism
5. Transaction timeout → Status check

### 14.3 Partner Mock Test Stand

A testing environment is available for front-end engineers to test the TLend iframe integration:

**Repository**: https://github.com/T-Lend/tlend-partner-mock

The mock test stand includes:
- Real TON Connect UI integration for wallet connections
- All message types from RFC v2.0
- Event logging for debugging
- Configurable partner settings (ID, name, theme, logo mode)
- Manual action buttons for testing individual messages

**Quick Start:**
```bash
git clone https://github.com/T-Lend/tlend-partner-mock.git
cd tlend-partner-mock/app
python3 -m http.server 8080
# Open http://localhost:8080
```

### 14.4 Related Documents

- [TLend Backend API Reference](https://backend.tlend.co/redoc.html) - Authentication endpoints, challenge generation
- [TON Connect Authentication](https://docs.ton.org/v3/guidelines/ton-connect/verifying-signed-in-users)
- [Jetton Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
- [Window.postMessage() MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

### 14.5 Revision History

| Version | Date       | Author     | Changes                                           |
|---------|------------|------------|---------------------------------------------------|
| 1.0.0   | 2025-12-15 | TLend Team | Initial draft                                     |
| 2.0.0   | 2025-12-17 | TLend Team | Whitelabel support, session lifecycle, SET_LOGO   |

---

*End of RFC-001*
