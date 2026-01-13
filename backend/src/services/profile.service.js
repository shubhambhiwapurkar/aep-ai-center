import fetch from 'node-fetch';
import { config } from '../config/config.js';
import { getAccessToken } from './auth.service.js';
import * as datasetService from './dataset.service.js';
import * as queryService from './query.service.js';

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
 * Get profile preview sample status
 */
export async function getProfilePreview() {
    return aepFetch('/data/core/ups/previewsamplestatus');
}

/**
 * Get profile distribution by dataset
 */
export async function getProfilesByDataset(date) {
    const params = date ? `?date=${date}` : '';
    return aepFetch(`/data/core/ups/previewsamplestatus/report/dataset${params}`);
}

/**
 * Get profile distribution by namespace
 */
export async function getProfilesByNamespace(date) {
    const params = date ? `?date=${date}` : '';
    return aepFetch(`/data/core/ups/previewsamplestatus/report/namespace${params}`);
}

/**
 * Lookup a profile entity by identity
 */
export async function lookupProfile(entityId, entityIdNS, options = {}) {
    const params = new URLSearchParams({
        'schema.name': options.schemaName || '_xdm.context.profile',
        entityId,
        entityIdNS
    });

    if (options.fields) params.append('fields', options.fields);
    if (options.mergePolicyId) params.append('mergePolicyId', options.mergePolicyId);
    if (options.startTime) params.append('startTime', options.startTime);
    if (options.endTime) params.append('endTime', options.endTime);
    if (options.limit) params.append('limit', options.limit);

    return aepFetch(`/data/core/ups/access/entities?${params}`);
}

/**
 * Lookup multiple profiles
 */
export async function lookupMultipleProfiles(identities, options = {}) {
    return aepFetch('/data/core/ups/access/entities', {
        method: 'POST',
        body: JSON.stringify({
            schema: { name: options.schemaName || '_xdm.context.profile' },
            identities,
            fields: options.fields,
            mergePolicyId: options.mergePolicyId
        }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get related entities (ExperienceEvents for a profile)
 */
export async function getRelatedEntities(entityId, entityIdNS, relatedSchemaName, options = {}) {
    const params = new URLSearchParams({
        'schema.name': '_xdm.context.profile',
        'relatedSchema.name': relatedSchemaName,
        relatedEntityId: entityId,
        relatedEntityIdNS: entityIdNS
    });

    if (options.limit) params.append('limit', options.limit);
    if (options.orderby) params.append('orderby', options.orderby);
    if (options.startTime) params.append('startTime', options.startTime);
    if (options.endTime) params.append('endTime', options.endTime);

    return aepFetch(`/data/core/ups/access/entities?${params}`);
}

/**
 * Delete a profile entity
 */
export async function deleteProfile(entityId, entityIdNS, schemaName = '_xdm.context.profile') {
    const params = new URLSearchParams({
        'schema.name': schemaName,
        entityId,
        entityIdNS
    });

    return aepFetch(`/data/core/ups/access/entities?${params}`, {
        method: 'DELETE'
    });
}

/**
 * List merge policies
 */
export async function listMergePolicies(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.schemaName) params.append('schema.name', filters.schemaName);
    if (filters.default !== undefined) params.append('default', filters.default);

    if (!filters.limit) params.append('limit', '50');

    return aepFetch(`/data/core/ups/config/mergePolicies?${params}`);
}

/**
 * Get merge policy details
 */
export async function getMergePolicyDetails(policyId) {
    return aepFetch(`/data/core/ups/config/mergePolicies/${policyId}`);
}

/**
 * Create a merge policy
 */
export async function createMergePolicy(policyData) {
    return aepFetch('/data/core/ups/config/mergePolicies', {
        method: 'POST',
        body: JSON.stringify(policyData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a merge policy
 */
export async function updateMergePolicy(policyId, policyData) {
    return aepFetch(`/data/core/ups/config/mergePolicies/${policyId}`, {
        method: 'PUT',
        body: JSON.stringify(policyData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a merge policy
 */
export async function deleteMergePolicy(policyId) {
    return aepFetch(`/data/core/ups/config/mergePolicies/${policyId}`, {
        method: 'DELETE'
    });
}

/**
 * List profile system jobs (delete requests)
 */
export async function listProfileJobs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.page) params.append('page', filters.page);

    return aepFetch(`/data/core/ups/system/jobs?${params}`);
}

/**
 * Get profile job details
 */
export async function getProfileJobDetails(jobId) {
    return aepFetch(`/data/core/ups/system/jobs/${jobId}`);
}

/**
 * Create a profile delete job
 */
export async function createProfileDeleteJob(jobData) {
    return aepFetch('/data/core/ups/system/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a profile job
 */
export async function deleteProfileJob(jobId) {
    return aepFetch(`/data/core/ups/system/jobs/${jobId}`, {
        method: 'DELETE'
    });
}

/**
 * List computed attributes
 */
export async function listComputedAttributes() {
    return aepFetch('/data/core/ups/config/computedAttributes');
}

/**
 * Get computed attribute details
 */
export async function getComputedAttributeDetails(attributeId) {
    return aepFetch(`/data/core/ups/config/computedAttributes/${attributeId}`);
}

/**
 * List edge projection configurations
 */
export async function listProjections(schemaName) {
    const params = schemaName ? `?schemaName=${schemaName}` : '';
    return aepFetch(`/data/core/ups/config/projections${params}`);
}

/**
 * List projection destinations
 */
export async function listProjectionDestinations() {
    return aepFetch('/data/core/ups/config/destinations');
}

/**
 * Get profile stats for dashboard
 */
export async function getProfileStats() {
    try {
        const [preview, mergePolicies, jobs] = await Promise.all([
            getProfilePreview().catch(() => null),
            listMergePolicies({ limit: '100' }).catch(() => ({ children: [] })),
            listProfileJobs({ limit: '50' }).catch(() => ({ children: [] }))
        ]);

        return {
            totalProfiles: preview?.totalRows || 0,
            lastSampleTime: preview?.lastSampleTime || null,
            lastUpdated: preview?.lastSuccessfulSampleTimestamp || null,
            sampleSize: preview?.sampleSize || 0,
            mergePolicies: mergePolicies.children?.length || 0,
            deleteJobs: jobs.children?.length || 0,
            defaultMergePolicy: mergePolicies.children?.find(p => p.default)?.id || null
        };
    } catch (error) {
        console.error('Error getting profile stats:', error);
        return {
            totalProfiles: 0,
            mergePolicies: 0,
            deleteJobs: 0,
            error: error.message
        };
    }
}

/**
 * Check for orphaned profiles (inactive > N months)
 */
export async function checkOrphanedProfiles(monthsInactive = 3) {
    // 1. Find Snapshot Logic
    const datasets = await datasetService.listDatasets({ name: 'Profile Snapshot Export', limit: '1' });
    const snapshotId = Object.keys(datasets || {})[0];

    if (!snapshotId) {
        throw new Error('Profile Snapshot dataset not found. Cannot run analysis.');
    }

    const tableName = snapshotId;
    const days = monthsInactive * 30;

    // 2. SQL
    const sql = `SELECT count(1) as orphan_count FROM "${tableName}" WHERE timestamp < date_sub(current_date(), ${days})`;

    // 3. Execute
    const queryRun = await queryService.createQuery({
        dbName: 'prod:all',
        sql: sql,
        name: `API: Orphan Check (> ${days} days)`
    });

    return {
        analysis: 'Orphaned Profile Check',
        thresholdDays: days,
        status: 'Query Submitted',
        queryId: queryRun.id,
        sql: sql,
        note: 'Check results in Query Service to see the count of inactive profiles.'
    };
}
