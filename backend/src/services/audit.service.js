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

// ===== AUDIT EVENTS =====

/**
 * List audit events
 */
export async function listAuditEvents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.queryId) params.append('queryId', filters.queryId);
    if (filters.user) params.append('user', filters.user);
    if (filters.resource) params.append('resource', filters.resource);
    if (filters.action) params.append('action', filters.action);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/audit/events?${params}`);
}

/**
 * Get audit event details
 */
export async function getAuditEventDetails(eventId) {
    return aepFetch(`/data/foundation/audit/events/${eventId}`);
}

/**
 * Create audit export job
 */
export async function createAuditExport(exportData) {
    return aepFetch('/data/foundation/audit/export', {
        method: 'POST',
        body: JSON.stringify(exportData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get audit stats
 */
export async function getAuditStats() {
    try {
        const events = await listAuditEvents({ limit: '100' });
        const eventList = events.children || [];

        // Group by action type
        const byAction = {};
        const byUser = {};
        const byResource = {};

        eventList.forEach(event => {
            const action = event.action || 'unknown';
            byAction[action] = (byAction[action] || 0) + 1;

            const user = event.user?.id || 'unknown';
            byUser[user] = (byUser[user] || 0) + 1;

            const resource = event.resource?.name || 'unknown';
            byResource[resource] = (byResource[resource] || 0) + 1;
        });

        return {
            totalEvents: eventList.length,
            byAction,
            byUser,
            byResource,
            recentEvents: eventList.slice(0, 10).map(e => ({
                id: e.id,
                action: e.action,
                user: e.user?.id,
                resource: e.resource?.name,
                timestamp: e.timestamp
            }))
        };
    } catch (error) {
        console.error('Error getting audit stats:', error);
        return {
            totalEvents: 0,
            byAction: {},
            error: error.message
        };
    }
}
