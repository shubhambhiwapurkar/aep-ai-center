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

// ===== DATA ACCESS =====

/**
 * Get file details
 */
export async function getFileDetails(fileId) {
    return aepFetch(`/data/foundation/export/files/${fileId}`);
}

/**
 * Download file content
 */
export async function downloadFile(fileId, options = {}) {
    const params = new URLSearchParams();
    if (options.path) params.append('path', options.path);

    return aepFetch(`/data/foundation/export/files/${fileId}?${params}`);
}

/**
 * Preview file content
 */
export async function previewFile(fileId, options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);

    return aepFetch(`/data/foundation/export/files/${fileId}/preview?${params}`);
}

// ===== PRIVACY JOBS =====

/**
 * List privacy jobs
 */
export async function listPrivacyJobs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.regulation) params.append('regulation', filters.regulation);
    if (filters.status) params.append('status', filters.status);
    if (filters.size) params.append('size', filters.size);
    if (filters.page) params.append('page', filters.page);
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);

    return aepFetch(`/data/core/privacy/jobs?${params}`);
}

/**
 * Get privacy job details
 */
export async function getPrivacyJobDetails(jobId) {
    return aepFetch(`/data/core/privacy/jobs/${jobId}`);
}

/**
 * Create privacy job
 */
export async function createPrivacyJob(jobData) {
    return aepFetch('/data/core/privacy/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
        headers: { 'Content-Type': 'application/json' }
    });
}

// ===== CONSENT =====

/**
 * Process consent request
 */
export async function processConsent(consentData) {
    return aepFetch('/data/core/privacy/consent', {
        method: 'POST',
        body: JSON.stringify(consentData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get privacy stats
 */
export async function getPrivacyStats() {
    try {
        const jobs = await listPrivacyJobs({ size: '100' });
        const jobList = jobs.jobs || [];

        const byStatus = {};
        const byRegulation = {};

        jobList.forEach(job => {
            const status = job.status || 'unknown';
            byStatus[status] = (byStatus[status] || 0) + 1;

            const regulation = job.regulation || 'unknown';
            byRegulation[regulation] = (byRegulation[regulation] || 0) + 1;
        });

        return {
            totalJobs: jobList.length,
            byStatus,
            byRegulation,
            pendingJobs: jobList.filter(j => j.status === 'processing').length,
            completedJobs: jobList.filter(j => j.status === 'complete').length,
            recentJobs: jobList.slice(0, 10)
        };
    } catch (error) {
        console.error('Error getting privacy stats:', error);
        return {
            totalJobs: 0,
            byStatus: {},
            error: error.message
        };
    }
}

// ===== ACCESS CONTROL =====

/**
 * List effective policies
 */
export async function listEffectivePolicies(resourceType, resourceId) {
    return aepFetch('/data/foundation/access-control/acl/effective-policies', {
        method: 'POST',
        body: JSON.stringify([{ resource: `/${resourceType}`, resourceId }]),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get permission reference (all available permissions)
 */
export async function getPermissionReference() {
    return aepFetch('/data/foundation/access-control/acl/reference');
}
