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

// ===== SEGMENT DEFINITIONS =====

/**
 * List segment definitions
 */
export async function listSegments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.property) params.append('property', filters.property);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/core/ups/segment/definitions?${params}`);
}

/**
 * Get segment definition details
 */
export async function getSegmentDetails(segmentId) {
    return aepFetch(`/data/core/ups/segment/definitions/${segmentId}`);
}

/**
 * Create a segment definition
 */
export async function createSegment(segmentData) {
    return aepFetch('/data/core/ups/segment/definitions', {
        method: 'POST',
        body: JSON.stringify(segmentData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a segment definition
 */
export async function updateSegment(segmentId, segmentData) {
    return aepFetch(`/data/core/ups/segment/definitions/${segmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(segmentData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a segment definition
 */
export async function deleteSegment(segmentId) {
    return aepFetch(`/data/core/ups/segment/definitions/${segmentId}`, {
        method: 'DELETE'
    });
}

// ===== SEGMENT JOBS (EVALUATION) =====

/**
 * List segment jobs
 */
export async function listSegmentJobs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.status) params.append('status', filters.status);
    if (filters.segmentId) params.append('segmentId', filters.segmentId);

    return aepFetch(`/data/core/ups/segment/jobs?${params}`);
}

/**
 * Get segment job details
 */
export async function getSegmentJobDetails(jobId) {
    return aepFetch(`/data/core/ups/segment/jobs/${jobId}`);
}

/**
 * Create a segment evaluation job
 */
export async function createSegmentJob(segmentIds) {
    return aepFetch('/data/core/ups/segment/jobs', {
        method: 'POST',
        body: JSON.stringify(segmentIds.map(id => ({ segmentId: id }))),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Cancel a segment job
 */
export async function cancelSegmentJob(jobId) {
    return aepFetch(`/data/core/ups/segment/jobs/${jobId}`, {
        method: 'DELETE'
    });
}

// ===== EXPORT JOBS =====

/**
 * List export jobs
 */
export async function listExportJobs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.status) params.append('status', filters.status);

    return aepFetch(`/data/core/ups/export/jobs?${params}`);
}

/**
 * Get export job details
 */
export async function getExportJobDetails(jobId) {
    return aepFetch(`/data/core/ups/export/jobs/${jobId}`);
}

/**
 * Create an export job
 */
export async function createExportJob(exportData) {
    return aepFetch('/data/core/ups/export/jobs', {
        method: 'POST',
        body: JSON.stringify(exportData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Cancel an export job
 */
export async function cancelExportJob(jobId) {
    return aepFetch(`/data/core/ups/export/jobs/${jobId}`, {
        method: 'DELETE'
    });
}

// ===== PREVIEWS =====

/**
 * Create a segment preview
 */
export async function createPreview(previewData) {
    return aepFetch('/data/core/ups/preview', {
        method: 'POST',
        body: JSON.stringify(previewData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get preview results
 */
export async function getPreviewResults(previewId) {
    return aepFetch(`/data/core/ups/preview/${previewId}`);
}

/**
 * Delete a preview
 */
export async function deletePreview(previewId) {
    return aepFetch(`/data/core/ups/preview/${previewId}`, {
        method: 'DELETE'
    });
}

// ===== ESTIMATES =====

/**
 * Get segment estimate
 */
export async function getSegmentEstimate(previewId) {
    return aepFetch(`/data/core/ups/estimate/${previewId}`);
}

// ===== SCHEDULES =====

/**
 * List segment schedules
 */
export async function listSegmentSchedules(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);

    return aepFetch(`/data/core/ups/segment/schedules?${params}`);
}

/**
 * Get schedule details
 */
export async function getSegmentScheduleDetails(scheduleId) {
    return aepFetch(`/data/core/ups/segment/schedules/${scheduleId}`);
}

/**
 * Create a segment schedule
 */
export async function createSegmentSchedule(scheduleData) {
    return aepFetch('/data/core/ups/segment/schedules', {
        method: 'POST',
        body: JSON.stringify(scheduleData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a segment schedule
 */
export async function updateSegmentSchedule(scheduleId, scheduleData) {
    return aepFetch(`/data/core/ups/segment/schedules/${scheduleId}`, {
        method: 'PATCH',
        body: JSON.stringify(scheduleData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a segment schedule
 */
export async function deleteSegmentSchedule(scheduleId) {
    return aepFetch(`/data/core/ups/segment/schedules/${scheduleId}`, {
        method: 'DELETE'
    });
}

// ===== SEGMENT SEARCH =====

/**
 * Search segments by namespace
 */
export async function searchSegments(searchParams) {
    return aepFetch('/data/core/ups/search/namespaces', {
        method: 'POST',
        body: JSON.stringify(searchParams),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get segment stats for dashboard
 */
export async function getSegmentStats() {
    try {
        const [segments, jobs, exports, schedules] = await Promise.all([
            listSegments({ limit: '100' }).catch(() => ({ segments: [] })),
            listSegmentJobs({ limit: '50' }).catch(() => ({ children: [] })),
            listExportJobs({ limit: '50' }).catch(() => ({ children: [] })),
            listSegmentSchedules({ limit: '50' }).catch(() => ({ children: [] }))
        ]);

        const segmentList = segments.segments || [];
        const jobList = jobs.children || [];
        const exportList = exports.children || [];
        const scheduleList = schedules.children || [];

        // Group by lifecycle state
        const byState = {};
        segmentList.forEach(s => {
            const state = s.lifecycleState || 'unknown';
            byState[state] = (byState[state] || 0) + 1;
        });

        return {
            totalSegments: segmentList.length,
            evaluationJobs: jobList.length,
            exportJobs: exportList.length,
            schedules: scheduleList.length,
            byState,
            recentSegments: segmentList.slice(0, 10).map(s => ({
                id: s.id,
                name: s.name,
                status: s.lifecycleState,
                expression: s.expression?.type
            })),
            runningJobs: jobList.filter(j => j.status === 'PROCESSING').length,
            completedJobs: jobList.filter(j => j.status === 'SUCCEEDED').length
        };
    } catch (error) {
        console.error('Error getting segment stats:', error);
        return {
            totalSegments: 0,
            evaluationJobs: 0,
            exportJobs: 0,
            byState: {},
            recentSegments: [],
            error: error.message
        };
    }
}
