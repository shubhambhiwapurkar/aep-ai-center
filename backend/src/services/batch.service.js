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
 * List batches with optional filters and pagination
 */
export async function listBatches(filters = {}) {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.start) params.append('start', filters.start);
    if (filters.dataSet) params.append('dataSet', filters.dataSet);
    if (filters.createdAfter) params.append('createdAfter', filters.createdAfter);
    if (filters.createdBefore) params.append('createdBefore', filters.createdBefore);

    // Default ordering
    if (!filters.orderBy) params.append('orderBy', 'desc:created');
    if (!filters.limit) params.append('limit', '50');

    const queryString = params.toString();
    return aepFetch(`/data/foundation/catalog/batches?${queryString}`);
}

/**
 * List ALL batches with pagination
 */
export async function listAllBatches(maxLimit = 500) {
    const allBatches = {};
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore && Object.keys(allBatches).length < maxLimit) {
        try {
            const batches = await listBatches({ limit: limit.toString(), start: start.toString() });
            const batchEntries = Object.entries(batches);

            if (batchEntries.length === 0) {
                hasMore = false;
            } else {
                batchEntries.forEach(([id, batch]) => {
                    allBatches[id] = { id, ...batch };
                });
                start += limit;

                if (batchEntries.length < limit) {
                    hasMore = false;
                }
            }
        } catch (error) {
            console.error('Batch pagination error:', error);
            hasMore = false;
        }
    }

    return allBatches;
}

/**
 * Get batch details by ID
 */
export async function getBatchDetails(batchId) {
    return aepFetch(`/data/foundation/catalog/batches/${batchId}`);
}

/**
 * Get failed batch records
 */
export async function getFailedRecords(batchId) {
    return aepFetch(`/data/foundation/export/batches/${batchId}/failed`);
}

/**
 * Get batch meta information
 */
export async function getBatchMeta(batchId) {
    return aepFetch(`/data/foundation/export/batches/${batchId}/meta`);
}

/**
 * Get batch files
 */
export async function getBatchFiles(batchId) {
    return aepFetch(`/data/foundation/export/batches/${batchId}/files`);
}

/**
 * Preview batch data
 */
export async function previewBatch(batchId, datasetId, options = {}) {
    const params = new URLSearchParams();
    params.append('format', options.format || 'json');
    if (options.nrow) params.append('nrow', options.nrow);

    return aepFetch(`/data/foundation/import/batches/${batchId}/datasets/${datasetId}/preview?${params}`);
}

/**
 * Signal batch completion
 */
export async function completeBatch(batchId) {
    return aepFetch(`/data/foundation/import/batches/${batchId}?action=COMPLETE`, {
        method: 'POST'
    });
}

/**
 * Calculate batch statistics for dashboard
 */
export async function getBatchStats(timeRange = '24h') {
    try {
        // Calculate time filter based on range
        const now = Date.now();
        let createdAfter;
        switch (timeRange) {
            case '1h': createdAfter = now - (60 * 60 * 1000); break;
            case '6h': createdAfter = now - (6 * 60 * 60 * 1000); break;
            case '24h': createdAfter = now - (24 * 60 * 60 * 1000); break;
            case '7d': createdAfter = now - (7 * 24 * 60 * 60 * 1000); break;
            default: createdAfter = 0; // All time
        }

        const batches = await listBatches({
            limit: '200',
            createdAfter: createdAfter > 0 ? createdAfter.toString() : undefined
        });

        const batchList = Object.entries(batches).map(([id, batch]) => ({ id, ...batch }));

        // Calculate stats
        const stats = {
            total: batchList.length,
            success: 0,
            failed: 0,
            active: 0,
            totalRecords: 0,
            failedRecords: 0,
            byStatus: {},
            timeline: [],
            recentBatches: []
        };

        batchList.forEach(batch => {
            const status = batch.status || 'unknown';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

            if (status === 'success') stats.success++;
            else if (status === 'failed') stats.failed++;
            else if (status === 'active' || status === 'processing' || status === 'loading') stats.active++;

            stats.totalRecords += batch.recordCount || 0;
            stats.failedRecords += batch.failedRecordCount || 0;
        });

        stats.successRate = stats.total > 0
            ? ((stats.success / (stats.success + stats.failed || 1)) * 100).toFixed(1)
            : 100;

        // Get recent batches
        stats.recentBatches = batchList
            .sort((a, b) => (b.created || 0) - (a.created || 0))
            .slice(0, 10);

        return stats;
    } catch (error) {
        console.error('Error getting batch stats:', error);
        return {
            total: 0,
            success: 0,
            failed: 0,
            active: 0,
            successRate: 100,
            byStatus: {},
            recentBatches: [],
            error: error.message
        };
    }
}

/**
 * Get batch timeline data for charts
 */
export async function getBatchTimeline(hours = 24) {
    try {
        const createdAfter = Date.now() - (hours * 60 * 60 * 1000);
        const batches = await listBatches({
            limit: '500',
            createdAfter: createdAfter.toString()
        });

        const batchList = Object.entries(batches).map(([id, batch]) => ({ id, ...batch }));

        // Group by hour
        const hourlyData = {};
        batchList.forEach(batch => {
            const hour = new Date(batch.created).toISOString().substring(0, 13);
            if (!hourlyData[hour]) {
                hourlyData[hour] = { hour, success: 0, failed: 0, active: 0, total: 0 };
            }
            hourlyData[hour].total++;
            if (batch.status === 'success') hourlyData[hour].success++;
            else if (batch.status === 'failed') hourlyData[hour].failed++;
            else hourlyData[hour].active++;
        });

        return Object.values(hourlyData).sort((a, b) => a.hour.localeCompare(b.hour));
    } catch (error) {
        console.error('Error getting batch timeline:', error);
        return [];
    }
}
