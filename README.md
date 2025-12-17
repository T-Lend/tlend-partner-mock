# Partner Mock Test Stand

A testing environment that simulates a Partner parent application for testing TLend iframe integration as specified in [RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md](./RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md) (v2.2.0).

## Quick Start

### Option 1: Local HTTP Server (Recommended)

```bash
# Clone and navigate to the app directory
git clone https://github.com/T-Lend/tlend-partner-mock.git
cd tlend-partner-mock/app

# Start a local server (choose one)
python3 -m http.server 8080
# OR
npx serve -p 8080
# OR
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

### Option 2: Open Directly

Simply open `index.html` in a modern browser. Note: Some features may require a proper HTTP server due to CORS restrictions.

## Features

This mock test stand implements all three tracks from the RFC:

### Track 1: UI/UX Customization
- Sends `STYLES_UPGRADE` message with Partner theme colors
- Sends `SET_LOGO` message for logo configuration (v2.0)
- Supports both dark and light themes
- Configurable logo modes: combined, tlend_only, partner_only

### Track 2: Authentication Flow
- Sends `AUTH_CHECK_REQUEST` to query TLend auth status
- Generates mock TON proof credentials
- Sends `AUTH_CREDENTIALS` for wallet authentication
- Handles `AUTH_RESULT` responses
- Sends `DISCONNECT` when wallet disconnects (v2.0)
- Handles `AUTH_REQUEST` for re-authentication (v2.0)

### Track 3: Repayment Flow
- Receives `REPAY_REQUEST` from TLend iframe
- Displays repayment confirmation modal
- Real TON Connect UI for actual transaction signing
- Simulates transaction signing for testing
- Sends `REPAY_RESULT` back to TLend

## Usage Guide

### 1. Configure TLend URL

Enter the TLend UI deployment URL you want to test:

- **Production**: `https://app.tlend.co`
- **Staging**: `https://app-test.tlend.co`
- **PR Preview**: `https://t-lend-ui-pr-XXX.evgeniy-kirichenko.workers.dev`
- **Local Dev**: `http://localhost:5173`

### 2. Configure Partner Settings

- **Partner ID**: Unique identifier assigned during onboarding
- **Partner Name**: Display name for combined logo
- **Theme**: Dark or light theme
- **Logo Mode**: How to display logo (combined, tlend_only, partner_only)

### 3. Connect Wallet (Real TON Connect)

Use the TON Connect button in the top right to connect a real wallet. The mock will request a TON Proof during connection.

### 4. Load the Iframe

Click "Load TLend Iframe" to embed TLend in the test stand.

### 5. Observe the Flow

Watch the Event Log panel to see all postMessage communication:
- **IN (green)**: Messages received from TLend
- **OUT (blue)**: Messages sent to TLend

### 6. Test Authentication

The mock will automatically:
1. Receive `TLEND_LOADED` from TLend
2. Send `STYLES_UPGRADE` with Partner theme
3. Send `SET_LOGO` with logo configuration
4. Send `AUTH_CHECK_REQUEST` to check auth status
5. Send `AUTH_CREDENTIALS` if TLend needs authentication

### 7. Test Repayment

When you initiate a repayment in the TLend iframe:
1. The mock receives `REPAY_REQUEST`
2. A confirmation modal appears
3. Click "Confirm & Sign" to sign with TON Connect (or simulate)
4. Or click "Cancel" to simulate user rejection

## Manual Actions

Use the buttons in the "Manual Actions" panel to manually send messages:

- **Send STYLES_UPGRADE**: Re-apply Partner theme to TLend
- **Send SET_LOGO**: Re-send logo configuration
- **Send AUTH_CHECK_REQUEST**: Query TLend authentication status
- **Send AUTH_CREDENTIALS**: Send wallet credentials
- **Send DISCONNECT**: Notify TLend of wallet disconnection (v2.0)
- **Force Set READY State**: Override state to READY

## State Indicator

The "TLend State" panel shows the current lifecycle state:

| State | Description |
|-------|-------------|
| LOADING | TLend iframe is loading |
| PENDING_AUTH | Waiting for authentication |
| READY | Fully authenticated and operational |
| ERROR | An error occurred |

## Message Formats

All messages follow the RFC-001 v2.2.0 specification. See the Event Log for full JSON payloads.

### Key Message Types

**From TLend (incoming):**
- `TLEND_LOADED` - Initial load notification
- `AUTH_CHECK_RESPONSE` - Auth status report
- `AUTH_RESULT` - Auth outcome
- `AUTH_REQUEST` - Request for fresh credentials (v2.0)
- `TLEND_READY` - Fully ready signal
- `REPAY_REQUEST` - Transaction request
- `ERROR` - Error notification

**To TLend (outgoing):**
- `STYLES_UPGRADE` - Theme customization
- `SET_LOGO` - Logo configuration (v2.0)
- `AUTH_CHECK_REQUEST` - Auth query
- `AUTH_CREDENTIALS` - Wallet credentials
- `DISCONNECT` - Wallet disconnection notice (v2.0)
- `REPAY_RESULT` - Transaction result

## Debugging

### Browser Console

Access the mock API via `window.PartnerMock`:

```javascript
// View current state
console.log(PartnerMock.state);

// Manually send messages
PartnerMock.sendStylesUpgrade();
PartnerMock.sendSetLogo();
PartnerMock.sendAuthCheckRequest();
PartnerMock.sendAuthCredentials();
PartnerMock.sendDisconnect('user_initiated');

// Fetch TLend challenge (Option B per RFC)
const challenge = await PartnerMock.fetchTLendChallenge();
console.log(challenge);

// Generate mock TON proof (for offline testing)
const proof = PartnerMock.generateMockTonProof('0:abc...');
console.log(proof);
```

### Event Log

The Event Log panel shows all communication in real-time. Click "Clear" to reset.

## Testing Checklist

### Authentication Flow
- [ ] `TLEND_LOADED` received with version and capabilities
- [ ] `STYLES_UPGRADE` sent and applied
- [ ] `SET_LOGO` sent with logo mode
- [ ] `AUTH_CHECK_REQUEST` sent with wallet address
- [ ] `AUTH_CHECK_RESPONSE` received
- [ ] `AUTH_CREDENTIALS` sent with TON proof
- [ ] `AUTH_RESULT` received (success or failure)
- [ ] `TLEND_READY` received when fully operational
- [ ] `AUTH_REQUEST` handled (when JWT expires)
- [ ] `DISCONNECT` sent when wallet disconnects

### Repayment Flow
- [ ] `REPAY_REQUEST` received when user initiates repayment
- [ ] Confirmation modal displays correct amounts
- [ ] "Confirm" sends successful `REPAY_RESULT`
- [ ] "Cancel" sends rejected `REPAY_RESULT`
- [ ] TLend UI updates based on result

### Error Handling
- [ ] Invalid credentials show error
- [ ] Timeout handling works
- [ ] Error messages are logged

## TypeScript Types Package

For TypeScript/JavaScript integration, install the official type definitions:

```bash
npm install @tlend/iframe-types
```

This package provides:
- All message type definitions
- Type guards and validators
- Constants (error codes, timeouts, capabilities)
- Utility functions

See [packages/tlend-iframe-types/README.md](./packages/tlend-iframe-types/README.md) for detailed usage.

## Files

```
tlend-partner-mock/
├── app/
│   ├── index.html              # Main Partner mock test stand
│   ├── partner-mock.js         # Message handling logic
│   ├── styles.css              # Partner-like styling
│   ├── tlend-iframe-mock.html  # TLend mock (for testing Partner side)
│   ├── logo-combined-dark.svg  # Combined logo (dark theme)
│   └── logo-combined-light.svg # Combined logo (light theme)
├── packages/
│   └── tlend-iframe-types/     # TypeScript type definitions (npm package)
├── .github/
│   └── workflows/
│       └── publish-types.yml   # GitHub Action for npm publishing
├── RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md # Protocol specification (v2.2.0)
└── README.md                                   # This file
```

## Testing Both Sides

### Testing TLend Implementation (Main Use Case)

Use `index.html` - this simulates a Partner and embeds the actual TLend UI in an iframe.

### Testing Partner Implementation

Use `tlend-iframe-mock.html` - this simulates TLend and can be embedded as an iframe to test a Partner implementation. Open it in a separate tab to see what messages TLend should send.

## Notes for TLend Implementation

When implementing the TLend side of this integration:

1. **Origin Validation**: Add the mock's origin to allowed origins during testing
2. **Environment Detection**: `window.parent !== window` to detect iframe context
3. **Hide TON Connect UI**: When in iframe mode, hide native wallet UI
4. **Message Handling**: Implement handlers for all Partner → TLend messages
5. **Auth Flow**: Accept credentials from parent instead of direct TON Connect
6. **Session Lifecycle**: Handle `DISCONNECT` and send `AUTH_REQUEST` when needed

## Support

Refer to the full specification in [RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md](./RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md) for detailed protocol documentation.
