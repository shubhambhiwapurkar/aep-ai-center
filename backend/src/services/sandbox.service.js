import fetch from 'node-fetch';
import { config } from '../config/config.js';
import { getAccessToken } from './auth.service.js';

async function aepFetch(endpoint, options = {}) {
    const token = await getAccessToken();

    const headers = {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.apiKey,
        'x-gw-ims-org-id': config.imsOrg,
        'x-sandbox-name': config.sandboxName,
        'Accept': 'application/json',
        ...options.headers
    };

    const response = await fetch(`${config.platformUrl}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
}

// ===== SANDBOX MANAGEMENT =====

/**
 * List all sandboxes
 */
export async function listSandboxes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.property) params.append('property', filters.property);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);

    return aepFetch(`/data/foundation/sandbox-management/sandboxes?${params}`);
}

/**
 * List active sandboxes (user operations)
 */
export async function listActiveSandboxes() {
    return aepFetch('/data/foundation/sandbox-management/');
}

/**
 * List supported sandbox types
 */
export async function listSandboxTypes() {
    return aepFetch('/data/foundation/sandbox-management/sandboxTypes');
}

/**
 * Get sandbox details by name
 */
export async function getSandboxDetails(sandboxName) {
    return aepFetch(`/data/foundation/sandbox-management/sandboxes/${sandboxName}`);
}

/**
 * Create a new sandbox
 */
export async function createSandbox(sandboxData) {
    return aepFetch('/data/foundation/sandbox-management/sandboxes', {
        method: 'POST',
        body: JSON.stringify(sandboxData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a sandbox
 */
export async function updateSandbox(sandboxName, sandboxData) {
    return aepFetch(`/data/foundation/sandbox-management/sandboxes/${sandboxName}`, {
        method: 'PATCH',
        body: JSON.stringify(sandboxData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Reset a sandbox
 */
export async function resetSandbox(sandboxName) {
    return aepFetch(`/data/foundation/sandbox-management/sandboxes/${sandboxName}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'reset' }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a sandbox
 */
export async function deleteSandbox(sandboxName) {
    return aepFetch(`/data/foundation/sandbox-management/sandboxes/${sandboxName}`, {
        method: 'DELETE'
    });
}

/**
 * Get current sandbox info
 */
export async function getCurrentSandbox() {
    try {
        const sandboxes = await listSandboxes();
        const current = sandboxes.sandboxes?.find(s => s.name === config.sandboxName);
        return current || { name: config.sandboxName, title: config.sandboxName };
    } catch (error) {
        return { name: config.sandboxName, title: config.sandboxName, error: error.message };
    }
}

/**
 * Get sandbox stats
 */
export async function getSandboxStats() {
    try {
        const [sandboxes, types] = await Promise.all([
            listSandboxes().catch(() => ({ sandboxes: [] })),
            listSandboxTypes().catch(() => ({ types: [] }))
        ]);

        const sandboxList = sandboxes.sandboxes || [];

        return {
            total: sandboxList.length,
            types: types.types || [],
            byType: sandboxList.reduce((acc, sb) => {
                const type = sb.type || 'unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {}),
            byState: sandboxList.reduce((acc, sb) => {
                const state = sb.state || 'unknown';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {}),
            sandboxes: sandboxList.map(sb => ({
                name: sb.name,
                title: sb.title,
                type: sb.type,
                state: sb.state,
                region: sb.region
            })),
            current: config.sandboxName
        };
    } catch (error) {
        console.error('Error getting sandbox stats:', error);
        return {
            total: 0,
            current: config.sandboxName,
            error: error.message
        };
    }
}
