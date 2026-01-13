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

// ===== DATA USAGE LABELS =====

/**
 * List core labels
 */
export async function listCoreLabels(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    return aepFetch(`/data/foundation/dulepolicy/labels/core?${params}`);
}

/**
 * Get core label details
 */
export async function getCoreLabelDetails(labelName) {
    return aepFetch(`/data/foundation/dulepolicy/labels/core/${labelName}`);
}

/**
 * List custom labels
 */
export async function listCustomLabels(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);

    return aepFetch(`/data/foundation/dulepolicy/labels/custom?${params}`);
}

/**
 * Get custom label details
 */
export async function getCustomLabelDetails(labelName) {
    return aepFetch(`/data/foundation/dulepolicy/labels/custom/${labelName}`);
}

/**
 * Create or update a custom label
 */
export async function upsertCustomLabel(labelName, labelData) {
    return aepFetch(`/data/foundation/dulepolicy/labels/custom/${labelName}`, {
        method: 'PUT',
        body: JSON.stringify(labelData),
        headers: { 'Content-Type': 'application/json' }
    });
}

// ===== POLICIES =====

/**
 * List core policies
 */
export async function listCorePolicies(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.duleLabels) params.append('duleLabels', filters.duleLabels);

    return aepFetch(`/data/foundation/dulepolicy/policies/core?${params}`);
}

/**
 * Get core policy details
 */
export async function getCorePolicyDetails(policyId) {
    return aepFetch(`/data/foundation/dulepolicy/policies/core/${policyId}`);
}

/**
 * List custom policies
 */
export async function listCustomPolicies(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.start) params.append('start', filters.start);
    if (filters.duleLabels) params.append('duleLabels', filters.duleLabels);

    return aepFetch(`/data/foundation/dulepolicy/policies/custom?${params}`);
}

/**
 * Get custom policy details
 */
export async function getCustomPolicyDetails(policyId) {
    return aepFetch(`/data/foundation/dulepolicy/policies/custom/${policyId}`);
}

/**
 * Create a custom policy
 */
export async function createCustomPolicy(policyData) {
    return aepFetch('/data/foundation/dulepolicy/policies/custom', {
        method: 'POST',
        body: JSON.stringify(policyData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Update a custom policy
 */
export async function updateCustomPolicy(policyId, policyData) {
    return aepFetch(`/data/foundation/dulepolicy/policies/custom/${policyId}`, {
        method: 'PUT',
        body: JSON.stringify(policyData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete a custom policy
 */
export async function deleteCustomPolicy(policyId) {
    return aepFetch(`/data/foundation/dulepolicy/policies/custom/${policyId}`, {
        method: 'DELETE'
    });
}

/**
 * List enabled core policies
 */
export async function listEnabledCorePolicies() {
    return aepFetch('/data/foundation/dulepolicy/enabledCorePolicies');
}

/**
 * Update enabled core policies
 */
export async function updateEnabledCorePolicies(policyIds) {
    return aepFetch('/data/foundation/dulepolicy/enabledCorePolicies', {
        method: 'PUT',
        body: JSON.stringify({ policyIds }),
        headers: { 'Content-Type': 'application/json' }
    });
}

// ===== MARKETING ACTIONS =====

/**
 * List core marketing actions
 */
export async function listCoreMarketingActions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);

    return aepFetch(`/data/foundation/dulepolicy/marketingActions/core?${params}`);
}

/**
 * Get core marketing action details
 */
export async function getCoreMarketingActionDetails(actionName) {
    return aepFetch(`/data/foundation/dulepolicy/marketingActions/core/${actionName}`);
}

/**
 * List custom marketing actions
 */
export async function listCustomMarketingActions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);

    return aepFetch(`/data/foundation/dulepolicy/marketingActions/custom?${params}`);
}

/**
 * Get custom marketing action details
 */
export async function getCustomMarketingActionDetails(actionName) {
    return aepFetch(`/data/foundation/dulepolicy/marketingActions/custom/${actionName}`);
}

/**
 * Create or update custom marketing action
 */
export async function upsertCustomMarketingAction(actionName, actionData) {
    return aepFetch(`/data/foundation/dulepolicy/marketingActions/custom/${actionName}`, {
        method: 'PUT',
        body: JSON.stringify(actionData),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Delete custom marketing action
 */
export async function deleteCustomMarketingAction(actionName) {
    return aepFetch(`/data/foundation/dulepolicy/marketingActions/custom/${actionName}`, {
        method: 'DELETE'
    });
}

// ===== POLICY EVALUATION =====

/**
 * Evaluate policy based on labels
 */
export async function evaluatePolicyByLabels(marketingActionName, labels, isCore = true) {
    const path = isCore ? 'core' : 'custom';
    const params = new URLSearchParams({ duleLabels: labels.join(',') });

    return aepFetch(`/data/foundation/dulepolicy/marketingActions/${path}/${marketingActionName}/constraints?${params}`);
}

/**
 * Evaluate policy based on datasets
 */
export async function evaluatePolicyByDatasets(marketingActionName, entities, isCore = true) {
    const path = isCore ? 'core' : 'custom';

    return aepFetch(`/data/foundation/dulepolicy/marketingActions/${path}/${marketingActionName}/constraints`, {
        method: 'POST',
        body: JSON.stringify(entities),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Bulk policy evaluation
 */
export async function bulkEvaluatePolicies(evaluations) {
    return aepFetch('/data/foundation/dulepolicy/bulk-eval', {
        method: 'POST',
        body: JSON.stringify(evaluations),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Get policy stats for dashboard
 */
export async function getPolicyStats() {
    try {
        const [coreLabels, customLabels, corePolicies, customPolicies, enabledCore, coreActions, customActions] = await Promise.all([
            listCoreLabels({ limit: '100' }).catch(() => ({ children: [] })),
            listCustomLabels({ limit: '100' }).catch(() => ({ children: [] })),
            listCorePolicies({ limit: '100' }).catch(() => ({ children: [] })),
            listCustomPolicies({ limit: '100' }).catch(() => ({ children: [] })),
            listEnabledCorePolicies().catch(() => ({ policyIds: [] })),
            listCoreMarketingActions({ limit: '50' }).catch(() => ({ children: [] })),
            listCustomMarketingActions({ limit: '50' }).catch(() => ({ children: [] }))
        ]);

        return {
            coreLabels: coreLabels.children?.length || 0,
            customLabels: customLabels.children?.length || 0,
            corePolicies: corePolicies.children?.length || 0,
            customPolicies: customPolicies.children?.length || 0,
            enabledCorePolicies: enabledCore.policyIds?.length || 0,
            coreMarketingActions: coreActions.children?.length || 0,
            customMarketingActions: customActions.children?.length || 0,
            totalLabels: (coreLabels.children?.length || 0) + (customLabels.children?.length || 0),
            totalPolicies: (corePolicies.children?.length || 0) + (customPolicies.children?.length || 0)
        };
    } catch (error) {
        console.error('Error getting policy stats:', error);
        return {
            totalLabels: 0,
            totalPolicies: 0,
            error: error.message
        };
    }
}
