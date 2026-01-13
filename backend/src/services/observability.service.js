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

// ===== OBSERVABILITY METRICS =====

/**
 * Get metrics using V1 API
 */
export async function getMetricsV1(metric, options = {}) {
    const params = new URLSearchParams({ metric });
    if (options.id) params.append('id', options.id);
    if (options.dateRange) params.append('dateRange', options.dateRange);

    return aepFetch(`/data/infrastructure/observability/insights/metrics?${params}`);
}

/**
 * Get metrics using V2 API (POST)
 */
export async function getMetricsV2(metricsRequest) {
    return aepFetch('/data/infrastructure/observability/insights/metrics', {
        method: 'POST',
        body: JSON.stringify(metricsRequest),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get ingestion metrics
 */
export async function getIngestionMetrics(options = {}) {
    const metrics = [
        'timeseries.ingestion.dataset.size',
        'timeseries.ingestion.dataset.dailysize',
        'timeseries.ingestion.dataset.batchfailed.count',
        'timeseries.ingestion.dataset.batchsuccess.count'
    ];

    const request = {
        start: options.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: options.end || new Date().toISOString(),
        granularity: options.granularity || 'PT1H',
        metrics
    };

    if (options.datasetId) {
        request['metrics'] = metrics.map(m => ({
            name: m,
            filters: [{ name: 'dataSetId', value: options.datasetId, groupBy: false }]
        }));
    }

    return getMetricsV2(request);
}

/**
 * Get profile metrics
 */
export async function getProfileMetrics(options = {}) {
    const request = {
        start: options.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: options.end || new Date().toISOString(),
        granularity: options.granularity || 'PT1H',
        metrics: [
            'timeseries.profiles.dataset.recordsuccess.count',
            'timeseries.profiles.dataset.recordfailed.count'
        ]
    };

    return getMetricsV2(request);
}

/**
 * Get identity metrics
 */
export async function getIdentityMetrics(options = {}) {
    const request = {
        start: options.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: options.end || new Date().toISOString(),
        granularity: options.granularity || 'PT1H',
        metrics: [
            'timeseries.identity.dataset.recordsuccess.count',
            'timeseries.identity.dataset.recordfailed.count',
            'timeseries.identity.dataset.recordskipped.count'
        ]
    };

    return getMetricsV2(request);
}

/**
 * Get observability stats for dashboard
 */
export async function getObservabilityStats() {
    try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [ingestion, profile, identity] = await Promise.all([
            getIngestionMetrics({ start: yesterday.toISOString(), end: now.toISOString() }).catch(() => null),
            getProfileMetrics({ start: yesterday.toISOString(), end: now.toISOString() }).catch(() => null),
            getIdentityMetrics({ start: yesterday.toISOString(), end: now.toISOString() }).catch(() => null)
        ]);

        return {
            ingestion: parseMetrics(ingestion),
            profile: parseMetrics(profile),
            identity: parseMetrics(identity),
            timeRange: {
                start: yesterday.toISOString(),
                end: now.toISOString()
            }
        };
    } catch (error) {
        console.error('Error getting observability stats:', error);
        return {
            ingestion: null,
            profile: null,
            identity: null,
            error: error.message
        };
    }
}

function parseMetrics(data) {
    if (!data || !data.metricResponses) return null;

    const result = {};
    data.metricResponses.forEach(metric => {
        result[metric.metric] = metric.dataPoints || [];
    });

    return result;
}

/**
 * Get system health status
 */
export async function getSystemHealth() {
    try {
        const stats = await getObservabilityStats();

        // Determine health based on metrics
        // Simple logic: if we can fetch metrics, services are reachable
        const services = {
            'identity': stats.identity ? 'online' : 'degraded',
            'catalog': 'online', // inferred
            'ingestion': stats.ingestion ? 'online' : 'degraded',
            'query': 'online', // inferred
            'access-control': 'online'
        };

        const isHealthy = Object.values(services).every(s => s === 'online');

        return {
            status: isHealthy ? 'healthy' : 'degraded',
            services,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'critical',
            services: {},
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}
