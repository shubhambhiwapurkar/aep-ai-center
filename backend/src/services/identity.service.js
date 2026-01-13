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

/**
 * List all identity namespaces
 */
export async function listNamespaces() {
    return aepFetch('/data/core/idnamespace/identities');
}

/**
 * Get namespace details by ID
 */
export async function getNamespaceDetails(namespaceId) {
    return aepFetch(`/data/core/idnamespace/identities/${namespaceId}`);
}

/**
 * Create a new identity namespace
 */
export async function createNamespace(namespaceData) {
    return aepFetch('/data/core/idnamespace/identities', {
        method: 'POST',
        body: JSON.stringify(namespaceData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update an identity namespace
 */
export async function updateNamespace(namespaceId, namespaceData) {
    return aepFetch(`/data/core/idnamespace/identities/${namespaceId}`, {
        method: 'PUT',
        body: JSON.stringify(namespaceData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get identity XID from namespace and ID
 */
export async function getIdentityXID(namespace, id) {
    const params = new URLSearchParams({ namespace, id });
    return aepFetch(`/data/core/identity/identity?${params}`);
}

/**
 * Get identity mappings (linked identities)
 */
export async function getIdentityMappings(xid, targetNs) {
    const params = new URLSearchParams({ xid });
    if (targetNs) params.append('targetNs', targetNs);
    return aepFetch(`/data/core/identity/mapping?${params}`);
}

/**
 * Get identity cluster members (all linked identities)
 */
export async function getClusterMembers(xid, graphType = 'Private Graph') {
    const params = new URLSearchParams({ xid, 'graph-type': graphType });
    return aepFetch(`/data/core/identity/cluster/members?${params}`);
}

/**
 * Get identity cluster history
 */
export async function getClusterHistory(xid, graphType = 'Private Graph') {
    const params = new URLSearchParams({ xid, 'graph-type': graphType });
    return aepFetch(`/data/core/identity/cluster/history?${params}`);
}

/**
 * Batch get identity mappings
 */
export async function batchGetMappings(identities, targetNs) {
    return aepFetch('/data/core/identity/mappings', {
        method: 'POST',
        body: JSON.stringify({ xids: identities, targetNs }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Batch get cluster members
 */
export async function batchGetClusterMembers(identities, graphType = 'Private Graph') {
    return aepFetch('/data/core/identity/clusters/members', {
        method: 'POST',
        body: JSON.stringify({ xids: identities, 'graph-type': graphType }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get identity stats for dashboard
 */
export async function getIdentityStats() {
    try {
        const namespaces = await listNamespaces();

        const stats = {
            total: 0,
            custom: 0,
            standard: 0,
            shared: 0,
            byType: {},
            byCode: [],
            namespaces: []
        };

        if (Array.isArray(namespaces)) {
            stats.total = namespaces.length;

            namespaces.forEach(ns => {
                // Count by custom flag
                if (ns.custom) {
                    stats.custom++;
                } else {
                    stats.standard++;
                }

                if (ns.shared) stats.shared++;

                // Count by type
                const type = ns.type || 'unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;

                // Add to namespaces list
                stats.namespaces.push({
                    id: ns.id,
                    code: ns.code,
                    name: ns.name,
                    type: ns.type,
                    custom: ns.custom,
                    description: ns.description
                });
            });

            // Top namespaces by code
            stats.byCode = stats.namespaces.slice(0, 20);
        }

        return stats;
    } catch (error) {
        console.error('Error getting identity stats:', error);
        return {
            total: 0,
            custom: 0,
            standard: 0,
            byType: {},
            namespaces: [],
            error: error.message
        };
    }
}
