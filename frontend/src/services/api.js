const API_BASE = 'http://localhost:3001/api';

// ===== GLOBAL SANDBOX STATE =====
let currentSandbox = localStorage.getItem('aep_sandbox') || null;

export const setCurrentSandbox = (sandbox) => {
    currentSandbox = sandbox;
    localStorage.setItem('aep_sandbox', sandbox);
};

export const getCurrentSandboxName = () => currentSandbox;

async function fetchAPI(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Add sandbox header if set
    if (currentSandbox) {
        headers['x-sandbox-name'] = currentSandbox;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
}

// Sandbox-specific fetch (for cross-sandbox queries)
async function fetchAPIWithSandbox(endpoint, sandbox, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'x-sandbox-name': sandbox,
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
}

// ===== SANDBOX API =====
export const getActiveSandboxInfo = () => fetchAPI('/sandbox/current');
export const switchSandbox = (sandbox) => fetchAPI('/sandbox/switch', {
    method: 'POST',
    body: JSON.stringify({ sandbox })
});

// ===== CONNECTION =====
export const checkConnection = () => fetchAPI('/connection');
export const refreshConnection = () => fetchAPI('/connection/refresh', { method: 'POST' });

// ===== DASHBOARD =====
export const getDashboardSummary = (timeRange = '24h') =>
    fetchAPI(`/dashboard/summary?timeRange=${timeRange}`);

// ===== BATCHES =====
export const getBatches = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/batches${params ? '?' + params : ''}`);
};
export const getAllBatches = (maxLimit) =>
    fetchAPI(`/batches/all${maxLimit ? '?maxLimit=' + maxLimit : ''}`);
export const getBatchStats = (timeRange) =>
    fetchAPI(`/batches/stats?timeRange=${timeRange || 'all'}`);
export const getBatchTimeline = (hours) =>
    fetchAPI(`/batches/timeline?hours=${hours || 24}`);
export const getBatchDetails = (batchId) => fetchAPI(`/batches/${batchId}`);
export const getFailedRecords = (batchId) => fetchAPI(`/batches/${batchId}/failed`);
export const getBatchMeta = (batchId) => fetchAPI(`/batches/${batchId}/meta`);
export const getBatchFiles = (batchId) => fetchAPI(`/batches/${batchId}/files`);
export const previewBatch = (batchId, datasetId, options = {}) => {
    const params = new URLSearchParams(options).toString();
    return fetchAPI(`/batches/${batchId}/datasets/${datasetId}/preview${params ? '?' + params : ''}`);
};

// ===== SCHEMAS =====
export const getSchemas = (container = 'tenant', filters = {}) => {
    const params = new URLSearchParams({ container, ...filters }).toString();
    return fetchAPI(`/schemas?${params}`);
};
// Get ALL schemas with pagination (for Schema Registry)
export const getAllSchemas = (container = 'tenant') =>
    fetchAPI(`/schemas/all?container=${container}`);
export const getSchemaStats = () => fetchAPI('/schemas/stats');
export const getRegistryStats = () => fetchAPI('/schemas/registry-stats');
export const getUnionSchemas = () => fetchAPI('/schemas/unions');
export const getUnionSchemaDetails = (unionId) => fetchAPI(`/schemas/unions/${encodeURIComponent(unionId)}`);
export const extractSchemaForAI = () => fetchAPI('/schemas/extract-for-ai');
export const getSchemaDetails = (schemaId, container = 'tenant') =>
    fetchAPI(`/schemas/${encodeURIComponent(schemaId)}?container=${container}`);
export const getSchemaSampleData = (schemaId, container = 'tenant') =>
    fetchAPI(`/schemas/${encodeURIComponent(schemaId)}/sample?container=${container}`);
export const generateDataDictionary = () => fetchAPI('/schemas/dictionary');
export const exportSchema = (schemaId) =>
    fetchAPI(`/schemas/${encodeURIComponent(schemaId)}/export`);
export const getFieldGroups = (container = 'tenant', filters = {}) => {
    const params = new URLSearchParams({ container, ...filters }).toString();
    return fetchAPI(`/fieldgroups?${params}`);
};
export const getFieldGroupDetails = (fieldGroupId, container = 'tenant') =>
    fetchAPI(`/fieldgroups/${encodeURIComponent(fieldGroupId)}?container=${container}`);
export const getClasses = (container = 'tenant', filters = {}) => {
    const params = new URLSearchParams({ container, ...filters }).toString();
    return fetchAPI(`/classes?${params}`);
};
export const getClassDetails = (classId, container = 'tenant') =>
    fetchAPI(`/classes/${encodeURIComponent(classId)}?container=${container}`);
export const getDataTypes = (container = 'tenant', filters = {}) => {
    const params = new URLSearchParams({ container, ...filters }).toString();
    return fetchAPI(`/datatypes?${params}`);
};
export const getDataTypeDetails = (dataTypeId, container = 'tenant') =>
    fetchAPI(`/datatypes/${encodeURIComponent(dataTypeId)}?container=${container}`);
export const getDescriptors = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/descriptors${params ? '?' + params : ''}`);
};
export const getBehaviors = () => fetchAPI('/behaviors');

// ===== DATASETS =====
export const getDatasets = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/datasets${params ? '?' + params : ''}`);
};
export const getAllDatasets = () => fetchAPI('/datasets/all');
export const getDatasetStats = () => fetchAPI('/datasets/stats');
export const getDatasetDetails = (datasetId) => fetchAPI(`/datasets/${datasetId}`);
export const getDatasetLabels = (datasetId) => fetchAPI(`/datasets/${datasetId}/labels`);
export const getDatasetFiles = (datasetId, filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/datasets/${datasetId}/files${params ? '?' + params : ''}`);
};
export const getDatasetBatches = (datasetId, filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/datasets/${datasetId}/batches${params ? '?' + params : ''}`);
};

// ===== IDENTITIES =====
export const getIdentities = () => fetchAPI('/identities');
export const getNamespaces = () => fetchAPI('/identities');
export const getIdentityStats = () => fetchAPI('/identities/stats');
export const getIdentityDetails = (namespaceId) => fetchAPI(`/identities/${namespaceId}`);
export const getNamespaceDetails = (namespaceId) => fetchAPI(`/identities/${namespaceId}`);
export const getIdentityXID = (namespace, id) =>
    fetchAPI(`/identity/xid?namespace=${namespace}&id=${encodeURIComponent(id)}`);
export const getXID = (namespace, id) =>
    fetchAPI(`/identity/xid?namespace=${namespace}&id=${encodeURIComponent(id)}`);
export const getIdentityMappings = (xid, targetNs) =>
    fetchAPI(`/identity/mappings?xid=${xid}${targetNs ? '&targetNs=' + targetNs : ''}`);
export const getClusterMembers = (xid, graphType) =>
    fetchAPI(`/identity/cluster/members?xid=${xid}${graphType ? '&graphType=' + graphType : ''}`);
export const getClusterHistory = (xid, graphType) =>
    fetchAPI(`/identity/cluster/history?xid=${xid}${graphType ? '&graphType=' + graphType : ''}`);

// ===== PROFILES =====
export const getProfileStats = () => fetchAPI('/profiles/stats');
export const getProfilePreview = () => fetchAPI('/profiles/preview');
export const lookupProfile = (entityId, entityIdNS, options = {}) => {
    const params = new URLSearchParams({ entityId, entityIdNS, ...options });
    return fetchAPI(`/profiles/lookup?${params}`);
};
export const getProfileByIdentity = (namespace, identity, options = {}) => {
    const params = new URLSearchParams({ entityId: identity, entityIdNS: namespace, ...options });
    return fetchAPI(`/profiles/lookup?${params}`);
};
export const getExperienceEvents = (namespace, identity, options = {}) => {
    const params = new URLSearchParams({
        entityId: identity,
        entityIdNS: namespace,
        relatedSchema: '_xdm.context.experienceevent',
        ...options
    });
    return fetchAPI(`/profiles/lookup?${params}`);
};
export const lookupMultipleProfiles = (identities, options = {}) =>
    fetchAPI('/profiles/lookup', {
        method: 'POST',
        body: JSON.stringify({ identities, options })
    });
export const getProfilesByDataset = (date) =>
    fetchAPI(`/profiles/distribution/dataset${date ? '?date=' + date : ''}`);
export const getProfilesByNamespace = (date) =>
    fetchAPI(`/profiles/distribution/namespace${date ? '?date=' + date : ''}`);
export const getProfileDistribution = () => fetchAPI('/profiles/distribution/dataset');
export const getMergePolicies = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/merge-policies${params ? '?' + params : ''}`);
};
export const getMergePolicyDetails = (policyId) => fetchAPI(`/merge-policies/${policyId}`);
export const getProfileJobs = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/profile-jobs${params ? '?' + params : ''}`);
};
export const getProfileJobDetails = (jobId) => fetchAPI(`/profile-jobs/${jobId}`);
export const getComputedAttributes = () => fetchAPI('/computed-attributes');
export const getProjections = (schemaName) =>
    fetchAPI(`/projections${schemaName ? '?schemaName=' + schemaName : ''}`);
export const getProjectionDestinations = () => fetchAPI('/projection-destinations');
export const checkOrphanedProfiles = (months) => fetchAPI(`/profiles/orphans?months=${months || 3}`);

// ===== QUERIES =====
export const getQueries = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/queries${params ? '?' + params : ''}`);
};
export const getRecentQueries = (filters = {}) => getQueries(filters);
export const getQueryStats = () => fetchAPI('/queries/stats');
export const getQueryConnection = () => fetchAPI('/queries/connection');
export const getQueryDetails = (queryId) => fetchAPI(`/queries/${queryId}`);
export const getQuerySchedules = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/query-schedules${params ? '?' + params : ''}`);
};
export const getQueryScheduleDetails = (scheduleId) => fetchAPI(`/query-schedules/${scheduleId}`);
export const getQueryScheduleRuns = (scheduleId, filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/query-schedules/${scheduleId}/runs${params ? '?' + params : ''}`);
};
export const getQueryScheduleRunDetails = (scheduleId, runId) =>
    fetchAPI(`/query-schedules/${scheduleId}/runs/${runId}`);
export const getQueryTemplates = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/query-templates${params ? '?' + params : ''}`);
};
export const getQueryTemplateCount = () => fetchAPI('/query-templates/count');
export const getQueryTemplateDetails = (templateId) => fetchAPI(`/query-templates/${templateId}`);

// Execute SQL query
export const executeQuery = (sql, options = {}) =>
    fetchAPI('/queries', {
        method: 'POST',
        body: JSON.stringify({ sql, ...options })
    });

// ===== FLOWS =====
export const getFlows = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/flows${params ? '?' + params : ''}`);
};
export const getFlowStats = () => fetchAPI('/flows/stats');
export const getFlowDetails = (flowId) => fetchAPI(`/flows/${flowId}`);
export const getFlowRuns = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/flow-runs${params ? '?' + params : ''}`);
};
export const getFlowRunDetails = (runId) => fetchAPI(`/flow-runs/${runId}`);
export const getRunDetails = (runId) => fetchAPI(`/flow-runs/${runId}`);
export const getFlowSpecs = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/flow-specs${params ? '?' + params : ''}`);
};
export const getFlowSpecDetails = (specId) => fetchAPI(`/flow-specs/${specId}`);
export const getConnections = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/connections${params ? '?' + params : ''}`);
};
export const getConnectionDetails = (connectionId) => fetchAPI(`/connections/${connectionId}`);
export const testConnection = (connectionId) => fetchAPI(`/connections/${connectionId}/test`);
export const exploreConnection = (connectionId) => fetchAPI(`/connections/${connectionId}/explore`);
export const getConnectionSpecs = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/connection-specs${params ? '?' + params : ''}`);
};
export const getConnectionSpecDetails = (specId) => fetchAPI(`/connection-specs/${specId}`);
export const getSourceConnections = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/source-connections${params ? '?' + params : ''}`);
};
export const getSourceConnectionDetails = (connectionId) => fetchAPI(`/source-connections/${connectionId}`);
export const getTargetConnections = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/target-connections${params ? '?' + params : ''}`);
};
export const getTargetConnectionDetails = (connectionId) => fetchAPI(`/target-connections/${connectionId}`);

// ===== SEGMENTS =====
export const getSegments = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/segments${params ? '?' + params : ''}`);
};
export const getSegmentStats = () => fetchAPI('/segments/stats');
export const getSegmentDetails = (segmentId) => fetchAPI(`/segments/${segmentId}`);
export const getSegmentJobs = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/segment-jobs${params ? '?' + params : ''}`);
};
export const getSegmentJobDetails = (jobId) => fetchAPI(`/segment-jobs/${jobId}`);
export const getExportJobs = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/export-jobs${params ? '?' + params : ''}`);
};
export const getExportJobDetails = (jobId) => fetchAPI(`/export-jobs/${jobId}`);
export const getSegmentSchedules = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/segment-schedules${params ? '?' + params : ''}`);
};
export const getSegmentScheduleDetails = (scheduleId) => fetchAPI(`/segment-schedules/${scheduleId}`);
export const getSchedules = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/segment-schedules${params ? '?' + params : ''}`);
};
export const estimateSegment = (segmentId) => fetchAPI(`/segments/${segmentId}/estimate`);
export const previewSegment = (expression) =>
    fetchAPI('/segment-preview', {
        method: 'POST',
        body: JSON.stringify({ expression })
    });

// ===== SANDBOXES =====
export const getSandboxes = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/sandboxes${params ? '?' + params : ''}`);
};
export const getSandboxStats = () => fetchAPI('/sandboxes/stats');
export const getSandboxTypes = () => fetchAPI('/sandboxes/types');
export const getCurrentSandbox = () => fetchAPI('/sandboxes/current');
export const getActiveSandboxes = () => fetchAPI('/sandboxes/active');
export const getSandboxDetails = (sandboxName) => fetchAPI(`/sandboxes/${sandboxName}`);

// ===== POLICIES =====
export const getPolicyStats = () => fetchAPI('/policies/stats');
export const getCoreLabels = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/labels/core${params ? '?' + params : ''}`);
};
export const getCoreLabelDetails = (labelName) => fetchAPI(`/labels/core/${labelName}`);
export const getCustomLabels = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/labels/custom${params ? '?' + params : ''}`);
};
export const getCustomLabelDetails = (labelName) => fetchAPI(`/labels/custom/${labelName}`);
export const getCorePolicies = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/policies/core${params ? '?' + params : ''}`);
};
export const getCorePolicyDetails = (policyId) => fetchAPI(`/policies/core/${policyId}`);
export const getCustomPolicies = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/policies/custom${params ? '?' + params : ''}`);
};
export const getCustomPolicyDetails = (policyId) => fetchAPI(`/policies/custom/${policyId}`);
export const getEnabledPolicies = () => fetchAPI('/policies/enabled');
export const getCoreMarketingActions = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/marketing-actions/core${params ? '?' + params : ''}`);
};
export const getCoreMarketingActionDetails = (actionName) =>
    fetchAPI(`/marketing-actions/core/${actionName}`);
export const getCustomMarketingActions = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/marketing-actions/custom${params ? '?' + params : ''}`);
};
export const getCustomMarketingActionDetails = (actionName) =>
    fetchAPI(`/marketing-actions/custom/${actionName}`);

// ===== OBSERVABILITY =====
export const getObservabilityStats = () => fetchAPI('/observability/stats');
export const getIngestionMetrics = (options = {}) => {
    const params = new URLSearchParams(options).toString();
    return fetchAPI(`/observability/ingestion${params ? '?' + params : ''}`);
};
export const getProfileMetrics = (options = {}) => {
    const params = new URLSearchParams(options).toString();
    return fetchAPI(`/observability/profile${params ? '?' + params : ''}`);
};
export const getIdentityMetrics = (options = {}) => {
    const params = new URLSearchParams(options).toString();
    return fetchAPI(`/observability/identity${params ? '?' + params : ''}`);
};
export const getCustomMetrics = (metricsRequest) =>
    fetchAPI('/observability/metrics', {
        method: 'POST',
        body: JSON.stringify(metricsRequest)
    });

// ===== AUDIT =====
export const getAuditStats = () => fetchAPI('/audit/stats');
export const getAuditEvents = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/audit/events${params ? '?' + params : ''}`);
};
export const getAuditEventDetails = (eventId) => fetchAPI(`/audit/events/${eventId}`);

// ===== ACCESS / PRIVACY =====
export const getAccessPermissions = () => fetchAPI('/access/permissions');
export const getPrivacyStats = () => fetchAPI('/privacy/stats');
export const getPrivacyJobs = (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchAPI(`/privacy/jobs${params ? '?' + params : ''}`);
};
export const getPrivacyJobDetails = (jobId) => fetchAPI(`/privacy/jobs/${jobId}`);
export const getFileDetails = (fileId) => fetchAPI(`/files/${fileId}`);
export const previewFile = (fileId, options = {}) => {
    const params = new URLSearchParams(options).toString();
    return fetchAPI(`/files/${fileId}/preview${params ? '?' + params : ''}`);
};
export const downloadFile = (fileId) => fetchAPI(`/files/${fileId}/download`);

// ===== API CATALOG =====
export const getAPICatalog = () => fetchAPI('/catalog');
