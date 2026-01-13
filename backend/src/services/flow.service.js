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

// ===== CONNECTION SPECS =====

/**
 * List all connection specifications
 */
export async function listConnectionSpecs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.property) params.append('property', filters.property);

    return aepFetch(`/data/foundation/flowservice/connectionSpecs?${params}`);
}

/**
 * Get connection spec details
 */
export async function getConnectionSpecDetails(specId) {
    return aepFetch(`/data/foundation/flowservice/connectionSpecs/${specId}`);
}

// ===== CONNECTIONS =====

/**
 * List all connections
 */
export async function listConnections(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.property) params.append('property', filters.property);
    if (filters.orderby) params.append('orderby', filters.orderby);
    if (filters.continuationToken) params.append('continuationToken', filters.continuationToken);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/flowservice/connections?${params}`);
}

/**
 * Get connection details
 */
export async function getConnectionDetails(connectionId) {
    return aepFetch(`/data/foundation/flowservice/connections/${connectionId}`);
}

/**
 * Test connection connectivity
 */
export async function testConnection(connectionId) {
    return aepFetch(`/data/foundation/flowservice/connections/${connectionId}/test`);
}

/**
 * Explore connection contents
 */
export async function exploreConnection(connectionId) {
    return aepFetch(`/data/foundation/flowservice/connections/${connectionId}/explore`);
}

/**
 * Create a new connection
 */
export async function createConnection(connectionData) {
    return aepFetch('/data/foundation/flowservice/connections', {
        method: 'POST',
        body: JSON.stringify(connectionData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a connection
 */
export async function updateConnection(connectionId, connectionData, ifMatch) {
    return aepFetch(`/data/foundation/flowservice/connections/${connectionId}?if-match=${ifMatch}`, {
        method: 'PATCH',
        body: JSON.stringify(connectionData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a connection
 */
export async function deleteConnection(connectionId) {
    return aepFetch(`/data/foundation/flowservice/connections/${connectionId}`, {
        method: 'DELETE'
    });
}

// ===== FLOWS =====

/**
 * List all flows
 */
export async function listFlows(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.property) params.append('property', filters.property);
    if (filters.orderby) params.append('orderby', filters.orderby);
    if (filters.continuationToken) params.append('continuationToken', filters.continuationToken);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/flowservice/flows?${params}`);
}

/**
 * Get flow details
 */
export async function getFlowDetails(flowId) {
    return aepFetch(`/data/foundation/flowservice/flows/${flowId}`);
}

/**
 * Create a flow
 */
export async function createFlow(flowData) {
    return aepFetch('/data/foundation/flowservice/flows', {
        method: 'POST',
        body: JSON.stringify(flowData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a flow
 */
export async function updateFlow(flowId, flowData, ifMatch) {
    return aepFetch(`/data/foundation/flowservice/flows/${flowId}?if-match=${ifMatch}`, {
        method: 'PATCH',
        body: JSON.stringify(flowData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a flow
 */
export async function deleteFlow(flowId) {
    return aepFetch(`/data/foundation/flowservice/flows/${flowId}`, {
        method: 'DELETE'
    });
}

// ===== FLOW SPECS =====

/**
 * List flow specifications
 */
export async function listFlowSpecs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.property) params.append('property', filters.property);

    return aepFetch(`/data/foundation/flowservice/flowSpecs?${params}`);
}

/**
 * Get flow spec details
 */
export async function getFlowSpecDetails(specId) {
    return aepFetch(`/data/foundation/flowservice/flowSpecs/${specId}`);
}

// ===== FLOW RUNS =====

/**
 * List flow runs
 */
export async function listFlowRuns(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.property) params.append('property', filters.property);
    if (filters.orderby) params.append('orderby', filters.orderby);
    if (filters.continuationToken) params.append('continuationToken', filters.continuationToken);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/flowservice/runs?${params}`);
}

/**
 * Get flow run details
 */
export async function getFlowRunDetails(runId) {
    return aepFetch(`/data/foundation/flowservice/runs/${runId}`);
}

/**
 * Create a new run (trigger flow)
 */
export async function triggerFlowRun(flowId) {
    return aepFetch('/data/foundation/flowservice/runs', {
        method: 'POST',
        body: JSON.stringify({ flowId }),
        headers: { 'Content-Type': 'application/json' }
    });
}

// ===== SOURCE CONNECTIONS =====

/**
 * List source connections
 */
export async function listSourceConnections(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);

    return aepFetch(`/data/foundation/flowservice/sourceConnections?${params}`);
}

/**
 * Get source connection details
 */
export async function getSourceConnectionDetails(connectionId) {
    return aepFetch(`/data/foundation/flowservice/sourceConnections/${connectionId}`);
}

/**
 * Create source connection
 */
export async function createSourceConnection(connectionData) {
    return aepFetch('/data/foundation/flowservice/sourceConnections', {
        method: 'POST',
        body: JSON.stringify(connectionData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete source connection
 */
export async function deleteSourceConnection(connectionId) {
    return aepFetch(`/data/foundation/flowservice/sourceConnections/${connectionId}`, {
        method: 'DELETE'
    });
}

// ===== TARGET CONNECTIONS =====

/**
 * List target connections
 */
export async function listTargetConnections(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);

    return aepFetch(`/data/foundation/flowservice/targetConnections?${params}`);
}

/**
 * Get target connection details
 */
export async function getTargetConnectionDetails(connectionId) {
    return aepFetch(`/data/foundation/flowservice/targetConnections/${connectionId}`);
}

/**
 * Create target connection
 */
export async function createTargetConnection(connectionData) {
    return aepFetch('/data/foundation/flowservice/targetConnections', {
        method: 'POST',
        body: JSON.stringify(connectionData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete target connection
 */
export async function deleteTargetConnection(connectionId) {
    return aepFetch(`/data/foundation/flowservice/targetConnections/${connectionId}`, {
        method: 'DELETE'
    });
}

/**
 * Get flow stats for dashboard
 */
export async function getFlowStats() {
    try {
        const [flows, runs, connections, sourceConns, targetConns] = await Promise.all([
            listFlows({ limit: '100' }).catch(() => ({ items: [] })),
            listFlowRuns({ limit: '100' }).catch(() => ({ items: [] })),
            listConnections({ limit: '100' }).catch(() => ({ items: [] })),
            listSourceConnections({ limit: '50' }).catch(() => ({ items: [] })),
            listTargetConnections({ limit: '50' }).catch(() => ({ items: [] }))
        ]);

        const flowList = flows.items || [];
        const runList = runs.items || [];
        const connectionList = connections.items || [];

        // Calculate stats
        const stats = {
            totalFlows: flowList.length,
            totalRuns: runList.length,
            totalConnections: connectionList.length,
            sourceConnections: sourceConns.items?.length || 0,
            targetConnections: targetConns.items?.length || 0,
            activeFlows: flowList.filter(f => f.state === 'enabled').length,
            runsByStatus: {},
            recentRuns: []
        };

        runList.forEach(run => {
            const status = run.state || 'unknown';
            stats.runsByStatus[status] = (stats.runsByStatus[status] || 0) + 1;
        });

        stats.recentRuns = runList.slice(0, 10).map(r => ({
            id: r.id,
            flowId: r.flowId,
            state: r.state,
            createdAt: r.createdAt
        }));

        return stats;
    } catch (error) {
        console.error('Error getting flow stats:', error);
        return {
            totalFlows: 0,
            totalRuns: 0,
            activeFlows: 0,
            runsByStatus: {},
            error: error.message
        };
    }
}
