import fetch from 'node-fetch';
import { config } from '../config/config.js';

let cachedToken = null;
let tokenExpiry = null;

/**
 * Get OAuth access token from Adobe IMS
 * Uses client credentials flow for server-to-server authentication
 */
export async function getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
        return cachedToken;
    }

    try {
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            scope: config.scopes.split(',').join(',')
        });

        const response = await fetch(`${config.imsUrl}/ims/token/v3`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000);

        return cachedToken;
    } catch (error) {
        console.error('Auth error:', error.message);
        throw error;
    }
}

/**
 * Check connection status by validating token and testing API
 */
export async function checkConnection() {
    try {
        const token = await getAccessToken();

        // Test connection with sandboxes endpoint
        const response = await fetch(`${config.platformUrl}/data/foundation/sandbox-management/sandboxes`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-api-key': config.apiKey,
                'x-gw-ims-org-id': config.imsOrg,
                'x-sandbox-name': config.sandboxName
            }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                connected: true,
                sandboxName: config.sandboxName,
                timestamp: new Date().toISOString(),
                sandboxes: data.sandboxes || []
            };
        } else {
            return {
                connected: false,
                error: `API returned ${response.status}`,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        return {
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Clear cached token (for manual refresh)
 */
export function clearTokenCache() {
    cachedToken = null;
    tokenExpiry = null;
}
