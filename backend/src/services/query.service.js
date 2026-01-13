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
        'User-Agent': 'AEP-Monitor/1.0',
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
 * Get connection parameters for Query Service
 */
export async function getConnectionParams() {
    return aepFetch('/data/foundation/query/connection_parameters');
}

/**
 * List queries with pagination
 */
export async function listQueries(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.orderby) params.append('orderby', filters.orderby);
    if (filters.property) params.append('property', filters.property);
    if (filters.excludeSoftDeleted !== undefined) params.append('excludeSoftDeleted', filters.excludeSoftDeleted);

    if (!filters.limit) params.append('limit', '50');
    if (!filters.orderby) params.append('orderby', '-created');

    return aepFetch(`/data/foundation/query/queries?${params}`);
}

/**
 * Get query details
 */
export async function getQueryDetails(queryId) {
    return aepFetch(`/data/foundation/query/queries/${queryId}`);
}

/**
 * Create a new query
 */
export async function createQuery(queryData) {
    return aepFetch('/data/foundation/query/queries', {
        method: 'POST',
        body: JSON.stringify(queryData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Cancel a query
 */
export async function cancelQuery(queryId) {
    return aepFetch(`/data/foundation/query/queries/${queryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ client: 'API', action: 'cancel' }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Soft delete a query
 */
export async function deleteQuery(queryId) {
    return aepFetch(`/data/foundation/query/queries/${queryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ client: 'API', action: 'soft_delete' }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * List query schedules
 */
export async function listSchedules(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.orderby) params.append('orderby', filters.orderby);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/query/schedules?${params}`);
}

/**
 * Get schedule details
 */
export async function getScheduleDetails(scheduleId) {
    return aepFetch(`/data/foundation/query/schedules/${scheduleId}`);
}

/**
 * Create a scheduled query
 */
export async function createSchedule(scheduleData) {
    return aepFetch('/data/foundation/query/schedules', {
        method: 'POST',
        body: JSON.stringify(scheduleData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a schedule
 */
export async function updateSchedule(scheduleId, scheduleData) {
    return aepFetch(`/data/foundation/query/schedules/${scheduleId}`, {
        method: 'PATCH',
        body: JSON.stringify(scheduleData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(scheduleId) {
    return aepFetch(`/data/foundation/query/schedules/${scheduleId}`, {
        method: 'DELETE'
    });
}

/**
 * List runs for a schedule
 */
export async function listScheduleRuns(scheduleId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    return aepFetch(`/data/foundation/query/schedules/${scheduleId}/runs?${params}`);
}

/**
 * Trigger immediate run of scheduled query
 */
export async function triggerScheduleRun(scheduleId) {
    return aepFetch(`/data/foundation/query/schedules/${scheduleId}/runs`, {
        method: 'POST'
    });
}

/**
 * Get schedule run details
 */
export async function getScheduleRunDetails(scheduleId, runId) {
    return aepFetch(`/data/foundation/query/schedules/${scheduleId}/runs/${runId}`);
}

/**
 * Cancel a schedule run
 */
export async function cancelScheduleRun(scheduleId, runId) {
    return aepFetch(`/data/foundation/query/schedules/${scheduleId}/runs/${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ op: 'cancel' }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * List query templates
 */
export async function listTemplates(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.orderby) params.append('orderby', filters.orderby);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/foundation/query/query-templates?${params}`);
}

/**
 * Get template count
 */
export async function getTemplateCount() {
    return aepFetch('/data/foundation/query/query-templates/count');
}

/**
 * Get template details
 */
export async function getTemplateDetails(templateId) {
    return aepFetch(`/data/foundation/query/query-templates/${templateId}`);
}

/**
 * Create a query template
 */
export async function createTemplate(templateData) {
    return aepFetch('/data/foundation/query/query-templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a template
 */
export async function updateTemplate(templateId, templateData) {
    return aepFetch(`/data/foundation/query/query-templates/${templateId}`, {
        method: 'PUT',
        body: JSON.stringify(templateData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId) {
    return aepFetch(`/data/foundation/query/query-templates/${templateId}`, {
        method: 'DELETE'
    });
}

/**
 * Get query stats for dashboard
 */
export async function getQueryStats() {
    try {
        const [queries, schedules, templates, templateCount] = await Promise.all([
            listQueries({ limit: '100' }).catch(() => ({ queries: [] })),
            listSchedules({ limit: '100' }).catch(() => ({ schedules: [] })),
            listTemplates({ limit: '100' }).catch(() => ({ templates: [] })),
            getTemplateCount().catch(() => ({ count: 0 }))
        ]);

        const queryList = queries.queries || [];
        const scheduleList = schedules.schedules || [];
        const templateList = templates.templates || [];

        // Group queries by state
        const byState = {};
        queryList.forEach(q => {
            const state = q.state || 'unknown';
            byState[state] = (byState[state] || 0) + 1;
        });

        return {
            totalQueries: queryList.length,
            totalSchedules: scheduleList.length,
            totalTemplates: templateCount.count || templateList.length,
            byState,
            recentQueries: queryList.slice(0, 10).map(q => ({
                id: q.id,
                sql: q.sql?.substring(0, 100),
                state: q.state,
                created: q.created
            })),
            activeSchedules: scheduleList.filter(s => s.state === 'enabled').length
        };
    } catch (error) {
        console.error('Error getting query stats:', error);
        return {
            totalQueries: 0,
            totalSchedules: 0,
            totalTemplates: 0,
            byState: {},
            recentQueries: [],
            error: error.message
        };
    }
}
