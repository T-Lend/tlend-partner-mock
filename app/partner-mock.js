/**
 * Partner Mock Test Stand - TLend Iframe Integration
 *
 * This script implements the Partner (parent) side of the iframe integration
 * protocol as specified in RFC-001-TLEND-PARTNER-IFRAME-INTEGRATION.md (v2.0)
 *
 * Includes actual TON Connect UI integration for real wallet connections.
 *
 * Supports all three tracks:
 * - Track 1: UI/UX Customization (STYLES_UPGRADE, SET_LOGO)
 * - Track 2: Authentication Flow (with DISCONNECT, AUTH_REQUEST)
 * - Track 3: Repayment Flow
 */

// TON Connect UI is loaded via CDN script tag (global: TON_CONNECT_UI)
const TonConnectUI = window.TON_CONNECT_UI?.TonConnectUI;
const THEME = window.TON_CONNECT_UI?.THEME || { DARK: 'DARK', LIGHT: 'LIGHT' };

// ============================================================================
// Configuration & State
// ============================================================================

const CONFIG = {
    // TLend origin validation (update for testing)
    TLEND_ORIGINS: [
        'https://tlend.co',
        'https://staging.tlend.co',
    ],
    // Timeouts (ms)
    AUTH_CHECK_TIMEOUT: 5000,
    AUTH_CREDENTIALS_TIMEOUT: 30000,
    REPAY_TIMEOUT: 60000,
    // TON Connect manifest - FOR TESTING ONLY
    // In production, partners MUST use their own manifest on their domain.
    // The manifest domain is verified by TLend and must be whitelisted.
    // See RFC Section 10.3 and 12.1 for domain whitelisting requirements.
    TON_CONNECT_MANIFEST_URL: 'https://app-test.tlend.co/tonconnect-manifest.json',
};

// Application state
const state = {
    iframeLoaded: false,
    tlendState: null, // LOADING, PENDING_AUTH, READY, ERROR
    walletConnected: false,
    walletAddress: null,
    walletPublicKey: null,
    walletAccount: null,
    tonProof: null,
    pendingRequests: new Map(),
    pendingRepayRequest: null,
    tlendOrigin: null,
    tlendVersion: null,
    tlendCapabilities: [],
    tonConnectUI: null,
};

// DOM Elements
let elements = {};

// ============================================================================
// Message Types (from RFC)
// ============================================================================

const MessageTypes = {
    // TLend -> Partner
    TLEND_LOADED: 'TLEND_LOADED',
    AUTH_CHECK_RESPONSE: 'AUTH_CHECK_RESPONSE',
    AUTH_RESULT: 'AUTH_RESULT',
    AUTH_REQUEST: 'AUTH_REQUEST',        // v2.0: TLend requests fresh credentials
    TLEND_READY: 'TLEND_READY',
    REPAY_REQUEST: 'REPAY_REQUEST',
    ERROR: 'ERROR',
    // Partner -> TLend
    STYLES_UPGRADE: 'STYLES_UPGRADE',
    SET_LOGO: 'SET_LOGO',                // v2.0: Separate logo configuration
    AUTH_CHECK_REQUEST: 'AUTH_CHECK_REQUEST',
    AUTH_CREDENTIALS: 'AUTH_CREDENTIALS',
    DISCONNECT: 'DISCONNECT',            // v2.0: Partner notifies wallet disconnection
    REPAY_RESULT: 'REPAY_RESULT',
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateRequestId(prefix = 'req') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
}

function truncateAddress(address, chars = 8) {
    if (!address) return '';
    if (address.length <= chars * 2) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ============================================================================
// Logging
// ============================================================================

function logEvent(direction, type, payload, isError = false) {
    const logEl = elements.eventLog;
    if (!logEl) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${direction} ${isError ? 'error' : ''}`;

    const timestamp = formatTimestamp(Date.now());
    const dirLabel = direction === 'incoming' ? 'IN' : 'OUT';
    const dirClass = direction;

    entry.innerHTML = `
        <div class="log-timestamp">${timestamp}</div>
        <div>
            <span class="log-direction ${dirClass}">${dirLabel}</span>
            <span class="log-type">${type}</span>
        </div>
        ${payload ? `<div class="log-payload">${JSON.stringify(payload, null, 2)}</div>` : ''}
    `;

    logEl.insertBefore(entry, logEl.firstChild);

    // Also log to console
    console.log(`[Partner Mock] ${dirLabel} ${type}:`, payload);
}

function logInfo(message) {
    const logEl = elements.eventLog;
    if (!logEl) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry info';
    entry.innerHTML = `
        <div class="log-timestamp">${formatTimestamp(Date.now())}</div>
        <div>${message}</div>
    `;
    logEl.insertBefore(entry, logEl.firstChild);
    console.log(`[Partner Mock] INFO: ${message}`);
}

// ============================================================================
// State Management
// ============================================================================

function updateTLendState(newState) {
    state.tlendState = newState;

    // Update UI
    const stateItems = document.querySelectorAll('.state-item');
    stateItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.state === newState) {
            item.classList.add('active');
        }
    });

    // Update iframe status
    const statusDot = elements.iframeStatus?.querySelector('.status-dot');
    const statusText = elements.iframeStatus?.querySelector('.status-text');

    if (statusDot && statusText) {
        statusDot.className = 'status-dot';
        switch (newState) {
            case 'LOADING':
                statusDot.classList.add('loading');
                statusText.textContent = 'Loading...';
                break;
            case 'PENDING_AUTH':
                statusDot.classList.add('pending');
                statusText.textContent = 'Pending Auth';
                break;
            case 'READY':
                statusDot.classList.add('ready');
                statusText.textContent = 'Ready';
                break;
            case 'ERROR':
                statusDot.classList.add('error');
                statusText.textContent = 'Error';
                break;
        }
    }
}

function updateButtonStates() {
    const iframeLoaded = state.iframeLoaded;
    const hasIframe = !!document.querySelector('#iframeContainer iframe');

    // Enable manual message buttons if iframe exists (even before TLEND_LOADED)
    if (elements.sendStylesBtn) elements.sendStylesBtn.disabled = !hasIframe;
    if (elements.sendLogoBtn) elements.sendLogoBtn.disabled = !hasIframe;
    if (elements.sendAuthCheckBtn) elements.sendAuthCheckBtn.disabled = !hasIframe;
    if (elements.sendAuthCredsBtn) elements.sendAuthCredsBtn.disabled = !hasIframe;
    if (elements.sendDisconnectBtn) elements.sendDisconnectBtn.disabled = !hasIframe;
    if (elements.reloadIframeBtn) elements.reloadIframeBtn.disabled = !hasIframe;
    if (elements.setReadyBtn) elements.setReadyBtn.disabled = !hasIframe;
}


// ============================================================================
// TON Connect UI Integration
// ============================================================================

async function initTonConnect() {
    // Check if TON Connect UI is available
    if (!TonConnectUI) {
        logInfo('TON Connect UI not loaded - wallet features disabled');
        logInfo('(This is normal when opening from file://)');

        // Add a placeholder button
        const buttonContainer = document.getElementById('ton-connect-button');
        if (buttonContainer) {
            buttonContainer.innerHTML = `
                <button class="btn btn-secondary" style="opacity: 0.6; cursor: not-allowed;" disabled>
                    Wallet (requires HTTP)
                </button>
            `;
        }
        return;
    }

    try {
        state.tonConnectUI = new TonConnectUI({
            manifestUrl: 'https://app-test.tlend.co/tonconnect-manifest.json',
            buttonRootId: 'ton-connect-button',
            uiPreferences: {
                theme: THEME.DARK,
            },
        });

        // Set up TON Proof request BEFORE any connection attempt
        // This tells wallets we want a proof when connecting
        // Using TLend's challenge endpoint (Option B per RFC Section 12.3)
        const proofPayload = await fetchTLendChallenge();
        state.tonConnectUI.setConnectRequestParameters({
            state: 'ready',
            value: {
                tonProof: proofPayload,
            },
        });
        logInfo(`TON Proof configured with TLend challenge`);

        // Subscribe to wallet status changes
        state.tonConnectUI.onStatusChange(async (wallet) => {
            if (wallet) {
                state.walletConnected = true;
                state.walletAddress = wallet.account.address;
                state.walletAccount = wallet.account;

                console.log(`Wallet: `, wallet, `Connect items: `, wallet.connectItems);

                // Check if we have TON proof
                if (wallet.connectItems?.tonProof && 'proof' in wallet.connectItems.tonProof) {
                    state.tonProof = wallet.connectItems.tonProof.proof;
                    logInfo(`Wallet connected with TON Proof: ${truncateAddress(state.walletAddress)}`);
                } else {
                    logInfo(`Wallet connected (no proof): ${truncateAddress(state.walletAddress)}`);
                }

                updateButtonStates();
            } else {
                const wasConnected = state.walletConnected;
                state.walletConnected = false;
                state.walletAddress = null;
                state.walletAccount = null;
                state.tonProof = null;
                logInfo('Wallet disconnected');
                updateButtonStates();

                // v2.0: Notify TLend of disconnection if iframe is loaded
                if (wasConnected && state.iframeLoaded) {
                    sendDisconnect('user_initiated');
                }
            }
        });

        logInfo('TON Connect UI initialized');
    } catch (error) {
        console.error('Failed to init TON Connect:', error);
        logInfo(`TON Connect init failed: ${error.message}`);
    }
}

// Request TON Proof when connecting
async function connectWithProof() {
    if (!state.tonConnectUI) {
        logInfo('TON Connect not initialized');
        return;
    }

    try {
        // Fetch fresh challenge from TLend (Option B per RFC Section 12.3)
        const challenge = await fetchTLendChallenge();
        state.tonConnectUI.setConnectRequestParameters({
            state: 'ready',
            value: {
                tonProof: challenge,
            },
        });

        await state.tonConnectUI.openModal();
    } catch (error) {
        logInfo(`Connect error: ${error.message}`);
    }
}

// Fetch challenge from TLend backend (Option B per RFC Section 12.3)
async function fetchTLendChallenge() {
    try {
        const response = await fetch('https://backend.tlend.co/api/auth/challenge');
        if (!response.ok) {
            throw new Error(`Challenge fetch failed: ${response.status}`);
        }
        const data = await response.json();
        logInfo(`Fetched TLend challenge: ${data.challenge.substring(0, 20)}...`);
        return data.challenge;
    } catch (error) {
        logInfo(`Failed to fetch TLend challenge: ${error.message}`);
        // Fallback to mock payload for offline testing
        const timestamp = Math.floor(Date.now() / 1000) + 300;
        return `partner-mock-fallback-${timestamp}`;
    }
}

// Legacy sync function for compatibility (uses cached or generates mock)
function generateProofPayload() {
    // For sync contexts, return mock payload
    // Prefer fetchTLendChallenge() for actual usage
    const timestamp = Math.floor(Date.now() / 1000) + 300;
    return `partner-mock-${timestamp}`;
}

// ============================================================================
// Message Sending
// ============================================================================

function sendToTLend(message) {
    const iframe = document.querySelector('#iframeContainer iframe');
    if (!iframe || !iframe.contentWindow) {
        logInfo('Cannot send message: iframe not loaded');
        return false;
    }

    // Use the actual iframe origin or * for testing
    const targetOrigin = state.tlendOrigin || '*';

    iframe.contentWindow.postMessage(message, targetOrigin);
    logEvent('outgoing', message.type, message);
    return true;
}

// ============================================================================
// Track 1: UI/UX Customization
// ============================================================================

function getPartnerStyles(theme = 'dark') {
    const styles = {
        dark: {
            '--primary-color': '#6366f1',
            '--secondary-color': '#8b5cf6',
            '--background-color': '#0f0f23',
            '--surface-color': '#1a1a2e',
            '--text-color': '#ffffff',
            '--text-secondary': '#a0a0b0',
            '--border-color': '#2d2d44',
            '--border-radius': '12px',
            '--button-bg': '#6366f1',
            '--button-text': '#ffffff',
            '--card-bg': '#1a1a2e',
            '--success-color': '#10b981',
            '--error-color': '#ef4444',
            '--warning-color': '#f59e0b',
        },
        light: {
            '--primary-color': '#6366f1',
            '--secondary-color': '#8b5cf6',
            '--background-color': '#f8fafc',
            '--surface-color': '#ffffff',
            '--text-color': '#1e293b',
            '--text-secondary': '#64748b',
            '--border-color': '#e2e8f0',
            '--border-radius': '12px',
            '--button-bg': '#6366f1',
            '--button-text': '#ffffff',
            '--card-bg': '#ffffff',
            '--success-color': '#10b981',
            '--error-color': '#ef4444',
            '--warning-color': '#f59e0b',
        }
    };
    return styles[theme] || styles.dark;
}

function sendStylesUpgrade() {
    const theme = elements.partnerTheme?.value || 'dark';

    const message = {
        type: MessageTypes.STYLES_UPGRADE,
        timestamp: Date.now(),
        payload: {
            styles: getPartnerStyles(theme),
            theme: theme,
            // Note: logo is now sent separately via SET_LOGO (RFC v2.0)
        }
    };

    sendToTLend(message);
}

// v2.0: Separate logo configuration message
function sendSetLogo() {
    const logoMode = elements.logoMode?.value || 'combined';
    const partnerName = elements.partnerName?.value || 'Partner Finance';

    const message = {
        type: MessageTypes.SET_LOGO,
        timestamp: Date.now(),
        payload: {
            mode: logoMode,
            partnerName: partnerName,
            partnerLogoUrl: 'https://partner.example.com/logo.svg',
        }
    };

    sendToTLend(message);
}

// v2.0: Send DISCONNECT when wallet disconnects
function sendDisconnect(reason = 'user_initiated') {
    const message = {
        type: MessageTypes.DISCONNECT,
        timestamp: Date.now(),
        payload: {
            reason: reason, // 'user_initiated' | 'wallet_changed' | 'session_expired'
        }
    };

    sendToTLend(message);
    logInfo(`Sent DISCONNECT to TLend (reason: ${reason})`);
}

// ============================================================================
// Track 2: Authentication Flow
// ============================================================================

function sendAuthCheckRequest() {
    if (!state.walletAddress) {
        logInfo('Cannot send AUTH_CHECK_REQUEST: connect wallet first');
        return;
    }

    const walletAddress = state.walletAddress;

    const requestId = generateRequestId('auth-check');

    const message = {
        type: MessageTypes.AUTH_CHECK_REQUEST,
        requestId: requestId,
        timestamp: Date.now(),
        payload: {
            walletAddress: walletAddress,
        }
    };

    // Store pending request for timeout handling
    state.pendingRequests.set(requestId, {
        type: 'AUTH_CHECK',
        timestamp: Date.now(),
        timeout: setTimeout(() => {
            handleAuthCheckTimeout(requestId);
        }, CONFIG.AUTH_CHECK_TIMEOUT)
    });

    sendToTLend(message);
}

function handleAuthCheckTimeout(requestId) {
    const pending = state.pendingRequests.get(requestId);
    if (pending) {
        state.pendingRequests.delete(requestId);
        logInfo(`AUTH_CHECK_REQUEST timed out (${CONFIG.AUTH_CHECK_TIMEOUT}ms)`);
    }
}

function handleAuthCheckResponse(message) {
    const { requestId, payload } = message;

    // Clear pending request timeout
    const pending = state.pendingRequests.get(requestId);
    if (pending) {
        clearTimeout(pending.timeout);
        state.pendingRequests.delete(requestId);
    }

    const { authenticated, matchesRequested, address, expiresAt } = payload;

    if (!authenticated || !matchesRequested) {
        logInfo('TLend not authenticated or address mismatch - sending credentials');
        updateTLendState('PENDING_AUTH');
        // Auto-send credentials if wallet is connected
        if (state.walletConnected) {
            setTimeout(() => sendAuthCredentials(), 500);
        }
    } else {
        logInfo(`TLend already authenticated for ${truncateAddress(address)}`);
    }
}

function sendAuthCredentials() {
    if (!state.walletAddress) {
        logInfo('Cannot send AUTH_CREDENTIALS: connect wallet first');
        return;
    }

    const walletAddress = state.walletAddress;

    const requestId = generateRequestId('auth-cred');

    // Use real TON proof if available, otherwise generate mock
    let credentials;
    if (state.walletAccount && state.tonProof) {
        credentials = {
            account: {
                address: state.walletAccount.address,
                chain: state.walletAccount.chain,
                publicKey: state.walletAccount.publicKey,
                walletStateInit: state.walletAccount.walletStateInit,
            },
            proof: state.tonProof,
        };
        logInfo('Using real TON proof from connected wallet');
    } else {
        credentials = generateMockTonProof(walletAddress);
        logInfo('Using mock TON proof (wallet not connected with proof)');
    }

    const partnerId = elements.partnerId?.value || 'partner_xyz';

    const message = {
        type: MessageTypes.AUTH_CREDENTIALS,
        requestId: requestId,
        timestamp: Date.now(),
        payload: {
            account: credentials.account,
            proof: credentials.proof,
            partnerId: partnerId,
            referenceId: `${partnerId}-session-${Date.now()}`,
        }
    };

    // Store pending request
    state.pendingRequests.set(requestId, {
        type: 'AUTH_CREDENTIALS',
        timestamp: Date.now(),
        timeout: setTimeout(() => {
            handleAuthCredentialsTimeout(requestId);
        }, CONFIG.AUTH_CREDENTIALS_TIMEOUT)
    });

    sendToTLend(message);
}

function handleAuthCredentialsTimeout(requestId) {
    const pending = state.pendingRequests.get(requestId);
    if (pending) {
        state.pendingRequests.delete(requestId);
        logInfo(`AUTH_CREDENTIALS timed out (${CONFIG.AUTH_CREDENTIALS_TIMEOUT}ms)`);

        // Check if we should auto-set ready anyway
        const autoReady = elements.autoReadyMode?.value;
        if (autoReady === 'immediate') {
            logInfo('Auto-setting READY state (immediate mode)');
            updateTLendState('READY');
        }
    }
}

function handleAuthResult(message) {
    const { requestId, payload } = message;

    // Clear pending request timeout
    const pending = state.pendingRequests.get(requestId);
    if (pending) {
        clearTimeout(pending.timeout);
        state.pendingRequests.delete(requestId);
    }

    if (payload.success) {
        logInfo(`Authentication successful for ${truncateAddress(payload.address)}`);
        state.walletAddress = payload.address;
    } else {
        logInfo(`Authentication failed: ${payload.error?.code} - ${payload.error?.message}`);

        // Check if we should auto-set ready anyway
        const autoReady = elements.autoReadyMode?.value;
        if (autoReady === 'immediate') {
            logInfo('Auto-setting READY state despite auth failure (immediate mode)');
            updateTLendState('READY');
        } else {
            updateTLendState('ERROR');
        }
    }
}

// v2.0: Handle AUTH_REQUEST from TLend (JWT expired, needs fresh credentials)
function handleAuthRequest(message) {
    const { payload } = message;
    const reason = payload?.reason || 'unknown';
    const currentAddress = payload?.currentAddress;

    logInfo(`TLend requests re-authentication (reason: ${reason})`);

    if (currentAddress) {
        logInfo(`TLend thinks current address is: ${truncateAddress(currentAddress)}`);
    }

    // Check if user is still connected
    if (state.walletConnected && state.walletAddress) {
        logInfo('Wallet still connected - sending fresh credentials');
        updateTLendState('PENDING_AUTH');
        // Send fresh credentials
        setTimeout(() => sendAuthCredentials(), 500);
    } else {
        logInfo('Wallet not connected - sending DISCONNECT');
        sendDisconnect('session_expired');
    }
}

/**
 * Generate mock TON proof credentials
 * Used when real TON Connect proof is not available
 */
function generateMockTonProof(address) {
    // Generate mock expiration timestamp (30 minutes from now)
    const expirationTime = Math.floor(Date.now() / 1000) + (30 * 60);

    // Generate mock HMAC payload (32 bytes hex = 64 chars)
    const expirationHex = expirationTime.toString(16).padStart(8, '0');
    const mockHmacSignature = Array.from({ length: 28 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
    const payloadHex = expirationHex + mockHmacSignature;

    // Generate mock public key (32 bytes hex)
    const mockPublicKey = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');

    // Mock wallet state init (base64)
    const mockStateInit = 'te6cckECFgEAAwQA' + btoa(String.fromCharCode(...Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))));

    // Mock signature (base64)
    const mockSignature = btoa(String.fromCharCode(...Array.from({ length: 64 }, () => Math.floor(Math.random() * 256))));

    return {
        account: {
            address: address,
            chain: '-239',
            publicKey: mockPublicKey,
            walletStateInit: mockStateInit,
        },
        proof: {
            timestamp: Math.floor(Date.now() / 1000),
            domain: {
                lengthBytes: 15,
                value: 'partner.example', // Partner's domain - must be whitelisted by TLend
            },
            payload: payloadHex,
            signature: mockSignature,
        }
    };
}

// ============================================================================
// Track 3: Repayment Flow
// ============================================================================

function handleRepayRequest(message) {
    const { requestId, payload } = message;

    state.pendingRepayRequest = {
        requestId,
        payload,
        timestamp: Date.now(),
    };

    // Show repay panel
    showRepayPanel(payload);

    // Also show modal for confirmation
    showRepayModal(payload);
}

function showRepayPanel(payload) {
    const panel = elements.repayPanel;
    const details = elements.repayDetails;

    if (!panel || !details) return;

    details.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Lend ID:</span>
            <span class="detail-value">${payload.lendId}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">NFT Index:</span>
            <span class="detail-value">${payload.nftIndex}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Amount:</span>
            <span class="detail-value">${payload.amount.formatted} ${payload.amount.currency}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Valid Until:</span>
            <span class="detail-value">${new Date(payload.transaction.validUntil * 1000).toLocaleTimeString()}</span>
        </div>
    `;

    panel.style.display = 'block';
}

function showRepayModal(payload) {
    const modal = elements.repayModal;
    const body = elements.repayModalBody;

    if (!modal || !body) return;

    body.innerHTML = `
        <div class="tx-detail">
            <span class="tx-label">Amount</span>
            <span class="tx-value amount">${payload.amount.formatted} ${payload.amount.currency}</span>
        </div>
        <div class="tx-detail">
            <span class="tx-label">Lend ID</span>
            <span class="tx-value">#${payload.lendId}</span>
        </div>
        <div class="tx-detail">
            <span class="tx-label">NFT Index</span>
            <span class="tx-value">${payload.nftIndex}</span>
        </div>
        <div class="tx-detail">
            <span class="tx-label">User Address</span>
            <span class="tx-value address">${payload.metadata?.userAddress || 'N/A'}</span>
        </div>
        <div class="tx-detail">
            <span class="tx-label">TLend Contract</span>
            <span class="tx-value address">${payload.metadata?.tLendContractAddress || 'N/A'}</span>
        </div>
        <div class="tx-detail">
            <span class="tx-label">Gas (TON)</span>
            <span class="tx-value">${payload.transaction?.messages?.[0]?.amount ? (parseInt(payload.transaction.messages[0].amount) / 1e9).toFixed(4) : 'N/A'}</span>
        </div>
    `;

    modal.style.display = 'flex';
}

function hideRepayModal() {
    const modal = elements.repayModal;
    if (modal) {
        modal.style.display = 'none';
    }
}

async function approveRepayRequest() {
    if (!state.pendingRepayRequest) {
        logInfo('No pending repay request');
        return;
    }

    const { requestId, payload } = state.pendingRepayRequest;

    // Check if we have TON Connect and can sign the actual transaction
    if (state.tonConnectUI && state.walletConnected && payload.transaction) {
        logInfo('Signing transaction with TON Connect...');

        try {
            const result = await state.tonConnectUI.sendTransaction({
                validUntil: payload.transaction.validUntil,
                messages: payload.transaction.messages.map(msg => ({
                    address: msg.address,
                    amount: msg.amount,
                    payload: msg.payload,
                })),
            });

            // Transaction signed and sent
            const txResult = {
                type: MessageTypes.REPAY_RESULT,
                requestId: requestId,
                timestamp: Date.now(),
                payload: {
                    success: true,
                    transactionHash: result.boc,
                    explorerUrl: `https://tonscan.org/tx/${result.boc}`,
                }
            };

            sendToTLend(txResult);
            logInfo(`Transaction sent via TON Connect`);

        } catch (error) {
            logInfo(`TON Connect transaction failed: ${error.message}`);

            const txResult = {
                type: MessageTypes.REPAY_RESULT,
                requestId: requestId,
                timestamp: Date.now(),
                payload: {
                    success: false,
                    error: {
                        code: error.message?.includes('rejected') ? 'USER_REJECTED' : 'TRANSACTION_FAILED',
                        message: error.message,
                        userCancelled: error.message?.includes('rejected'),
                    }
                }
            };

            sendToTLend(txResult);
        }
    } else {
        // Simulate transaction for testing
        logInfo('Simulating transaction (no real TON Connect)...');

        setTimeout(() => {
            const mockTxHash = Array.from({ length: 32 }, () =>
                Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
            ).join('');

            const result = {
                type: MessageTypes.REPAY_RESULT,
                requestId: requestId,
                timestamp: Date.now(),
                payload: {
                    success: true,
                    transactionHash: mockTxHash,
                    explorerUrl: `https://tonscan.org/tx/${mockTxHash}`,
                }
            };

            sendToTLend(result);
            logInfo(`Mock transaction sent: ${truncateAddress(mockTxHash)}`);
        }, 2000);
    }

    // Clean up
    state.pendingRepayRequest = null;
    if (elements.repayPanel) elements.repayPanel.style.display = 'none';
    hideRepayModal();
}

function rejectRepayRequest(reason = 'USER_REJECTED') {
    if (!state.pendingRepayRequest) {
        logInfo('No pending repay request');
        return;
    }

    const { requestId } = state.pendingRepayRequest;

    const result = {
        type: MessageTypes.REPAY_RESULT,
        requestId: requestId,
        timestamp: Date.now(),
        payload: {
            success: false,
            error: {
                code: reason,
                message: reason === 'USER_REJECTED'
                    ? 'Transaction was rejected by user'
                    : 'Transaction failed',
                userCancelled: reason === 'USER_REJECTED',
            }
        }
    };

    sendToTLend(result);

    // Clean up
    state.pendingRepayRequest = null;
    if (elements.repayPanel) elements.repayPanel.style.display = 'none';
    hideRepayModal();

    logInfo('Repay request rejected');
}

// ============================================================================
// Message Handler
// ============================================================================

function handleMessage(event) {
    // Store origin for future messages
    if (!state.tlendOrigin) {
        state.tlendOrigin = event.origin;
        // Add to allowed origins for this session
        if (!CONFIG.TLEND_ORIGINS.includes(event.origin)) {
            CONFIG.TLEND_ORIGINS.push(event.origin);
            logInfo(`Added TLend origin: ${event.origin}`);
        }
    }

    const message = event.data;

    // Validate message structure
    if (!message || typeof message !== 'object' || !message.type) {
        return; // Ignore non-protocol messages
    }

    // Log incoming message
    logEvent('incoming', message.type, message);

    // Handle by message type
    switch (message.type) {
        case MessageTypes.TLEND_LOADED:
            handleTLendLoaded(message);
            break;

        case MessageTypes.AUTH_CHECK_RESPONSE:
            handleAuthCheckResponse(message);
            break;

        case MessageTypes.AUTH_RESULT:
            handleAuthResult(message);
            break;

        case MessageTypes.TLEND_READY:
            handleTLendReady(message);
            break;

        case MessageTypes.REPAY_REQUEST:
            handleRepayRequest(message);
            break;

        case MessageTypes.AUTH_REQUEST:
            handleAuthRequest(message);
            break;

        case MessageTypes.ERROR:
            handleError(message);
            break;

        default:
            logInfo(`Unknown message type: ${message.type}`);
    }
}

function handleTLendLoaded(message) {
    state.iframeLoaded = true;
    state.tlendVersion = message.payload?.version;
    state.tlendCapabilities = message.payload?.capabilities || [];

    updateTLendState('LOADING');
    updateButtonStates();

    logInfo(`TLend loaded: v${state.tlendVersion}, capabilities: ${state.tlendCapabilities.join(', ')}`);

    // Auto-send styles and logo
    setTimeout(() => {
        sendStylesUpgrade();
    }, 100);
    setTimeout(() => {
        sendSetLogo();
    }, 200);

    // Check if we should skip auth or send auth messages
    const skipAuth = elements.skipAuth?.value === 'yes';
    const autoReady = elements.autoReadyMode?.value;

    if (skipAuth) {
        logInfo('Skipping auth flow (skipAuth=yes)');
        if (autoReady === 'immediate') {
            setTimeout(() => {
                logInfo('Setting READY state immediately');
                updateTLendState('READY');
            }, 500);
        }
    } else {
        // Send auth check
        setTimeout(() => {
            sendAuthCheckRequest();
        }, 300);
    }
}

function handleTLendReady(message) {
    state.iframeLoaded = true;
    updateButtonStates();

    logInfo(`TLend READY received - address: ${truncateAddress(message.payload?.address)}`);

    // Check if we should send auth messages (TLend might not send TLEND_LOADED)
    const skipAuth = elements.skipAuth?.value === 'yes';

    if (!skipAuth && state.walletConnected) {
        // Send styles and logo first
        setTimeout(() => {
            sendStylesUpgrade();
        }, 100);
        setTimeout(() => {
            sendSetLogo();
        }, 200);

        // Then send auth check
        setTimeout(() => {
            sendAuthCheckRequest();
        }, 400);
    } else if (skipAuth) {
        updateTLendState('READY');
    } else {
        logInfo('Wallet not connected - connect wallet to send auth messages');
        updateTLendState('READY');
    }
}

function handleError(message) {
    const { payload } = message;
    logInfo(`ERROR from TLend: ${payload.code} - ${payload.message}`);

    if (!payload.recoverable) {
        updateTLendState('ERROR');
    }
}

// ============================================================================
// Iframe Management
// ============================================================================

function loadIframe() {
    const url = elements.tlendUrl?.value;
    if (!url) {
        logInfo('Please enter a TLend URL');
        return;
    }

    const container = elements.iframeContainer;
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Reset state
    state.iframeLoaded = false;
    state.tlendState = null;
    state.tlendOrigin = null;
    state.tlendVersion = null;
    state.tlendCapabilities = [];
    state.pendingRequests.clear();

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = 'clipboard-read; clipboard-write';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.minHeight = '600px';
    iframe.style.border = 'none';

    // Handle iframe load event (for when TLend doesn't send TLEND_LOADED)
    iframe.onload = () => {
        const autoReady = elements.autoReadyMode?.value;
        const skipAuth = elements.skipAuth?.value === 'yes';

        if (!state.iframeLoaded) {
            logInfo('Iframe loaded (no TLEND_LOADED received yet)');

            // If in immediate mode and skipAuth, set ready after a short delay
            if (autoReady === 'immediate' && skipAuth) {
                setTimeout(() => {
                    if (!state.iframeLoaded) {
                        state.iframeLoaded = true;
                        updateButtonStates();
                        logInfo('Auto-setting READY (iframe loaded, immediate mode)');
                        updateTLendState('READY');
                    }
                }, 2000);
            }
        }
    };

    container.appendChild(iframe);

    updateTLendState('LOADING');
    updateButtonStates(); // Enable manual buttons now that iframe exists
    logInfo(`Loading TLend iframe: ${url}`);
}

function reloadIframe() {
    const iframe = document.querySelector('#iframeContainer iframe');
    if (iframe) {
        // Reset state
        state.iframeLoaded = false;
        state.tlendState = null;
        state.pendingRequests.clear();

        iframe.src = iframe.src;
        updateTLendState('LOADING');
        logInfo('Reloading iframe');
    }
}

function forceSetReady() {
    state.iframeLoaded = true;
    updateTLendState('READY');
    updateButtonStates();
    logInfo('Manually set to READY state');
}

// ============================================================================
// Initialization
// ============================================================================

function initializeElements() {
    elements = {
        // Config inputs
        tlendUrl: document.getElementById('tlendUrl'),
        partnerId: document.getElementById('partnerId'),
        partnerName: document.getElementById('partnerName'),
        partnerTheme: document.getElementById('partnerTheme'),
        logoMode: document.getElementById('logoMode'),
        autoReadyMode: document.getElementById('autoReadyMode'),
        skipAuth: document.getElementById('skipAuth'),

        // Buttons
        loadIframeBtn: document.getElementById('loadIframeBtn'),
        reloadIframeBtn: document.getElementById('reloadIframeBtn'),
        sendStylesBtn: document.getElementById('sendStylesBtn'),
        sendLogoBtn: document.getElementById('sendLogoBtn'),
        sendAuthCheckBtn: document.getElementById('sendAuthCheckBtn'),
        sendAuthCredsBtn: document.getElementById('sendAuthCredsBtn'),
        sendDisconnectBtn: document.getElementById('sendDisconnectBtn'),
        setReadyBtn: document.getElementById('setReadyBtn'),
        clearLogBtn: document.getElementById('clearLogBtn'),

        // Containers
        iframeContainer: document.getElementById('iframeContainer'),
        iframeStatus: document.getElementById('iframeStatus'),
        walletSection: document.getElementById('walletSection'),
        eventLog: document.getElementById('eventLog'),

        // Repay
        repayPanel: document.getElementById('repayPanel'),
        repayDetails: document.getElementById('repayDetails'),
        approveRepayBtn: document.getElementById('approveRepayBtn'),
        rejectRepayBtn: document.getElementById('rejectRepayBtn'),

        // Modal
        repayModal: document.getElementById('repayModal'),
        repayModalBody: document.getElementById('repayModalBody'),
        closeRepayModal: document.getElementById('closeRepayModal'),
        cancelRepayBtn: document.getElementById('cancelRepayBtn'),
        confirmRepayBtn: document.getElementById('confirmRepayBtn'),
    };
}

function bindEventListeners() {
    // Config actions
    elements.loadIframeBtn?.addEventListener('click', loadIframe);
    elements.reloadIframeBtn?.addEventListener('click', reloadIframe);

    // Manual actions
    elements.sendStylesBtn?.addEventListener('click', sendStylesUpgrade);
    elements.sendLogoBtn?.addEventListener('click', sendSetLogo);
    elements.sendAuthCheckBtn?.addEventListener('click', sendAuthCheckRequest);
    elements.sendAuthCredsBtn?.addEventListener('click', sendAuthCredentials);
    elements.sendDisconnectBtn?.addEventListener('click', () => sendDisconnect('user_initiated'));
    elements.setReadyBtn?.addEventListener('click', forceSetReady);

    // Log
    elements.clearLogBtn?.addEventListener('click', () => {
        if (elements.eventLog) {
            elements.eventLog.innerHTML = '';
        }
    });

    // Repay panel
    elements.approveRepayBtn?.addEventListener('click', approveRepayRequest);
    elements.rejectRepayBtn?.addEventListener('click', () => rejectRepayRequest('USER_REJECTED'));

    // Repay modal
    elements.closeRepayModal?.addEventListener('click', hideRepayModal);
    elements.cancelRepayBtn?.addEventListener('click', () => {
        rejectRepayRequest('USER_REJECTED');
    });
    elements.confirmRepayBtn?.addEventListener('click', () => {
        hideRepayModal();
        approveRepayRequest();
    });

    // Message listener
    window.addEventListener('message', handleMessage);

    // Theme change
    elements.partnerTheme?.addEventListener('change', () => {
        if (state.iframeLoaded) {
            sendStylesUpgrade();
        }
    });
}

async function initialize() {
    initializeElements();
    bindEventListeners();
    updateButtonStates();

    // Initialize TON Connect UI
    await initTonConnect();

    logInfo('Partner Mock Test Stand initialized (RFC v2.0)');
    logInfo('1. Connect wallet with TON Connect (top right)');
    logInfo('2. Load TLend iframe');
    logInfo('3. Auth messages will be sent automatically on TLEND_READY');
}

// Start on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Export for debugging
window.PartnerMock = {
    state,
    sendStylesUpgrade,
    sendSetLogo,
    sendAuthCheckRequest,
    sendAuthCredentials,
    sendDisconnect,
    approveRepayRequest,
    rejectRepayRequest,
    generateMockTonProof,
    fetchTLendChallenge,
    forceSetReady,
    connectWithProof,
};
// Keep legacy export for backwards compatibility
window.EVAAMock = window.PartnerMock;
