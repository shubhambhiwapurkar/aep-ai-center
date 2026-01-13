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
 * List all datasets with pagination support
 */
export async function listDatasets(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.name) params.append('name', filters.name);
    if (filters.start) params.append('start', filters.start);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.property) params.append('property', filters.property);

    if (!filters.limit) params.append('limit', '100');

    const queryString = params.toString();
    return aepFetch(`/data/foundation/catalog/dataSets?${queryString}`);
}

/**
 * List ALL datasets with automatic pagination
 */
export async function listAllDatasets() {
    const allDatasets = {};
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        try {
            const datasets = await listDatasets({ limit: limit.toString(), start: start.toString() });
            const datasetEntries = Object.entries(datasets);

            if (datasetEntries.length === 0) {
                hasMore = false;
            } else {
                datasetEntries.forEach(([id, ds]) => {
                    allDatasets[id] = ds;
                });
                start += limit;

                // Safety limit to prevent infinite loops
                if (Object.keys(allDatasets).length >= 1000 || datasetEntries.length < limit) {
                    hasMore = false;
                }
            }
        } catch (error) {
            console.error('Pagination error:', error);
            hasMore = false;
        }
    }

    return allDatasets;
}

/**
 * Get dataset details
 */
export async function getDatasetDetails(datasetId) {
    return aepFetch(`/data/foundation/catalog/dataSets/${datasetId}`);
}

/**
 * Get dataset usage labels
 */
export async function getDatasetLabels(datasetId) {
    return aepFetch(`/data/foundation/dataset/datasets/${datasetId}/labels`);
}

/**
 * Get dataset files
 */
export async function getDatasetFiles(datasetId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    return aepFetch(`/data/foundation/catalog/dataSets/${datasetId}/files?${params}`);
}

/**
 * Get batches for a specific dataset
 */
export async function getDatasetBatches(datasetId, filters = {}) {
    const params = new URLSearchParams();
    params.append('dataSet', datasetId);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.status) params.append('status', filters.status);

    return aepFetch(`/data/foundation/catalog/batches?${params}`);
}

/**
 * Get dataset stats for dashboard - now with pagination
 */
export async function getDatasetStats() {
    try {
        const datasets = await listAllDatasets();
        const datasetList = Object.values(datasets);

        const stats = {
            total: datasetList.length,
            enabledForProfile: 0,
            enabledForIdentity: 0,
            byState: {},
            recentDatasets: []
        };

        datasetList.forEach(ds => {
            // Check profile enablement
            if (ds.tags?.['unifiedProfile']?.[0] === 'enabled') {
                stats.enabledForProfile++;
            }
            if (ds.tags?.['unifiedIdentity']?.[0] === 'enabled') {
                stats.enabledForIdentity++;
            }

            // Count by state
            const state = ds.state || 'unknown';
            stats.byState[state] = (stats.byState[state] || 0) + 1;
        });

        // Get recent datasets (last 10)
        stats.recentDatasets = datasetList
            .sort((a, b) => (b.created || 0) - (a.created || 0))
            .slice(0, 10)
            .map(ds => ({
                id: ds.id,
                name: ds.name,
                state: ds.state,
                created: ds.created
            }));

        return stats;
    } catch (error) {
        console.error('Error getting dataset stats:', error);
        return {
            total: 0,
            enabledForProfile: 0,
            enabledForIdentity: 0,
            byState: {},
            recentDatasets: [],
            error: error.message
        };
    }
}
