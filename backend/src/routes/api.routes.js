import { Router } from 'express';
import { checkConnection, clearTokenCache } from '../services/auth.service.js';
import * as batchService from '../services/batch.service.js';
import * as schemaService from '../services/schema.service.js';
import * as identityService from '../services/identity.service.js';
import * as datasetService from '../services/dataset.service.js';
import * as queryService from '../services/query.service.js';
import * as sandboxService from '../services/sandbox.service.js';
import * as profileService from '../services/profile.service.js';
import * as flowService from '../services/flow.service.js';
import * as segmentService from '../services/segment.service.js';
import * as policyService from '../services/policy.service.js';
import * as observabilityService from '../services/observability.service.js';
import * as auditService from '../services/audit.service.js';
import * as accessService from '../services/access.service.js';
import { config, setSandboxName, getSandboxName } from '../config/config.js';

const router = Router();

// Middleware to handle sandbox override from frontend
router.use((req, res, next) => {
    // Allow frontend to specify sandbox via query param or header
    if (req.query.sandbox) {
        req.sandboxOverride = req.query.sandbox;
    } else if (req.headers['x-sandbox-name']) {
        req.sandboxOverride = req.headers['x-sandbox-name'];
    } else {
        req.sandboxOverride = getSandboxName();
    }
    next();
});

// Helper for safe async route handling
const asyncHandler = (fn) => (req, res) => {
    Promise.resolve(fn(req, res)).catch(err => {
        // Only log non-404 errors (404s are expected for missing resources)
        if (!err.message?.includes('404')) {
            console.error('Route error:', err.message);
        }
        const status = err.message?.includes('404') ? 404 :
            err.message?.includes('400') ? 400 : 500;
        res.status(status).json({ error: err.message });
    });
};

// ===== SANDBOX SWITCH API =====
router.get('/sandbox/current', asyncHandler(async (req, res) => {
    res.json({
        sandbox: getSandboxName(),
        default: process.env.SANDBOX_NAME,
        name: getSandboxName()
    });
}));

router.post('/sandbox/switch', asyncHandler(async (req, res) => {
    const { sandbox } = req.body;
    if (!sandbox) {
        return res.status(400).json({ error: 'Sandbox name required' });
    }

    // Actually update the config sandbox (affects all services!)
    setSandboxName(sandbox);

    res.json({ success: true, sandbox: getSandboxName() });
}));

// ===== AUTH / CONNECTION =====
router.get('/connection', asyncHandler(async (req, res) => {
    const status = await checkConnection();
    res.json(status);
}));

router.post('/connection/refresh', asyncHandler(async (req, res) => {
    clearTokenCache();
    const status = await checkConnection();
    res.json(status);
}));

// ===== DASHBOARD SUMMARY =====
router.get('/dashboard/summary', asyncHandler(async (req, res) => {
    const [batchStats, schemaStats, identityStats, datasetStats, queryStats, sandbox] = await Promise.all([
        batchService.getBatchStats(req.query.timeRange || '24h').catch(e => ({ error: e.message })),
        schemaService.getSchemaStats().catch(e => ({ error: e.message })),
        identityService.getIdentityStats().catch(e => ({ error: e.message })),
        datasetService.getDatasetStats().catch(e => ({ error: e.message })),
        queryService.getQueryStats().catch(e => ({ error: e.message })),
        sandboxService.getCurrentSandbox().catch(e => ({ error: e.message }))
    ]);

    res.json({
        timestamp: new Date().toISOString(),
        sandbox,
        batches: batchStats,
        schemas: schemaStats,
        identities: identityStats,
        datasets: datasetStats,
        queries: queryStats
    });
}));

// ===== BATCHES =====
router.get('/batches', asyncHandler(async (req, res) => {
    const batches = await batchService.listBatches(req.query);
    res.json(batches);
}));

router.get('/batches/all', asyncHandler(async (req, res) => {
    const batches = await batchService.listAllBatches(parseInt(req.query.maxLimit) || 500);
    res.json(batches);
}));

router.get('/batches/stats', asyncHandler(async (req, res) => {
    const stats = await batchService.getBatchStats(req.query.timeRange);
    res.json(stats);
}));

router.get('/batches/timeline', asyncHandler(async (req, res) => {
    const timeline = await batchService.getBatchTimeline(parseInt(req.query.hours) || 24);
    res.json(timeline);
}));

router.get('/batches/:batchId', asyncHandler(async (req, res) => {
    const batch = await batchService.getBatchDetails(req.params.batchId);
    res.json(batch);
}));

router.get('/batches/:batchId/failed', asyncHandler(async (req, res) => {
    const failed = await batchService.getFailedRecords(req.params.batchId);
    res.json(failed);
}));

router.get('/batches/:batchId/meta', asyncHandler(async (req, res) => {
    const meta = await batchService.getBatchMeta(req.params.batchId);
    res.json(meta);
}));

router.get('/batches/:batchId/files', asyncHandler(async (req, res) => {
    const files = await batchService.getBatchFiles(req.params.batchId);
    res.json(files);
}));

router.get('/batches/:batchId/datasets/:datasetId/preview', asyncHandler(async (req, res) => {
    const preview = await batchService.previewBatch(req.params.batchId, req.params.datasetId, req.query);
    res.json(preview);
}));

// ===== SCHEMAS =====
router.get('/schemas', asyncHandler(async (req, res) => {
    const schemas = await schemaService.listSchemas(req.query.container || 'tenant', req.query);
    res.json(schemas);
}));

// Get ALL schemas with pagination (for Schema Registry page)
router.get('/schemas/all', asyncHandler(async (req, res) => {
    const container = req.query.container || 'tenant';
    const schemas = await schemaService.listAllSchemas(container);
    res.json({ results: schemas, total: schemas.length });
}));

router.get('/schemas/stats', asyncHandler(async (req, res) => {
    const stats = await schemaService.getSchemaStats();
    res.json(stats);
}));

router.get('/schemas/registry-stats', asyncHandler(async (req, res) => {
    const stats = await schemaService.getRegistryStats();
    res.json(stats);
}));

router.get('/schemas/unions', asyncHandler(async (req, res) => {
    const unions = await schemaService.listUnionSchemas();
    res.json(unions);
}));

router.get('/schemas/unions/:unionId', asyncHandler(async (req, res) => {
    const union = await schemaService.getUnionSchemaDetails(req.params.unionId);
    res.json(union);
}));

router.get('/schemas/extract-for-ai', asyncHandler(async (req, res) => {
    const extracted = await schemaService.extractUnionSchemaForAI();
    res.json(extracted);
}));

router.get('/schemas/dictionary', asyncHandler(async (req, res) => {
    const dictionary = await schemaService.generateDataDictionary();
    res.json(dictionary);
}));

router.get('/schemas/:schemaId', asyncHandler(async (req, res) => {
    const schema = await schemaService.getSchemaDetails(req.params.schemaId, req.query.container || 'tenant');
    res.json(schema);
}));

router.get('/schemas/:schemaId/sample', asyncHandler(async (req, res) => {
    const sample = await schemaService.getSchemaSampleData(req.params.schemaId, req.query.container || 'tenant');
    res.json(sample);
}));

router.get('/schemas/:schemaId/export', asyncHandler(async (req, res) => {
    const exported = await schemaService.exportSchema(req.params.schemaId);
    res.json(exported);
}));

router.get('/fieldgroups', asyncHandler(async (req, res) => {
    const fieldGroups = await schemaService.listFieldGroups(req.query.container || 'tenant', req.query);
    res.json(fieldGroups);
}));

router.get('/fieldgroups/:fieldGroupId', asyncHandler(async (req, res) => {
    const fieldGroup = await schemaService.getFieldGroupDetails(req.params.fieldGroupId, req.query.container || 'tenant');
    res.json(fieldGroup);
}));

router.get('/classes', asyncHandler(async (req, res) => {
    const classes = await schemaService.listClasses(req.query.container || 'tenant', req.query);
    res.json(classes);
}));

router.get('/classes/:classId', asyncHandler(async (req, res) => {
    const classDetails = await schemaService.getClassDetails(req.params.classId, req.query.container || 'tenant');
    res.json(classDetails);
}));

router.get('/datatypes', asyncHandler(async (req, res) => {
    const dataTypes = await schemaService.listDataTypes(req.query.container || 'tenant', req.query);
    res.json(dataTypes);
}));

router.get('/datatypes/:dataTypeId', asyncHandler(async (req, res) => {
    const dataType = await schemaService.getDataTypeDetails(req.params.dataTypeId, req.query.container || 'tenant');
    res.json(dataType);
}));

router.get('/descriptors', asyncHandler(async (req, res) => {
    const descriptors = await schemaService.listDescriptors(req.query);
    res.json(descriptors);
}));

router.get('/behaviors', asyncHandler(async (req, res) => {
    const behaviors = await schemaService.listBehaviors();
    res.json(behaviors);
}));

// ===== DATASETS =====
router.get('/datasets', asyncHandler(async (req, res) => {
    const datasets = await datasetService.listDatasets(req.query);
    res.json(datasets);
}));

router.get('/datasets/all', asyncHandler(async (req, res) => {
    const datasets = await datasetService.listAllDatasets();
    res.json(datasets);
}));

router.get('/datasets/stats', asyncHandler(async (req, res) => {
    const stats = await datasetService.getDatasetStats();
    res.json(stats);
}));

router.get('/datasets/:datasetId', asyncHandler(async (req, res) => {
    const dataset = await datasetService.getDatasetDetails(req.params.datasetId);
    res.json(dataset);
}));

router.get('/datasets/:datasetId/labels', asyncHandler(async (req, res) => {
    const labels = await datasetService.getDatasetLabels(req.params.datasetId);
    res.json(labels);
}));

router.get('/datasets/:datasetId/files', asyncHandler(async (req, res) => {
    const files = await datasetService.getDatasetFiles(req.params.datasetId, req.query);
    res.json(files);
}));

router.get('/datasets/:datasetId/batches', asyncHandler(async (req, res) => {
    const batches = await datasetService.getDatasetBatches(req.params.datasetId, req.query);
    res.json(batches);
}));

// ===== IDENTITIES =====
router.get('/identities', asyncHandler(async (req, res) => {
    const namespaces = await identityService.listNamespaces();
    res.json(namespaces);
}));

router.get('/identities/stats', asyncHandler(async (req, res) => {
    const stats = await identityService.getIdentityStats();
    res.json(stats);
}));

router.get('/identities/:namespaceId', asyncHandler(async (req, res) => {
    const namespace = await identityService.getNamespaceDetails(req.params.namespaceId);
    res.json(namespace);
}));

router.get('/identity/xid', asyncHandler(async (req, res) => {
    const xid = await identityService.getIdentityXID(req.query.namespace, req.query.id);
    res.json(xid);
}));

router.get('/identity/mappings', asyncHandler(async (req, res) => {
    const mappings = await identityService.getIdentityMappings(req.query.xid, req.query.targetNs);
    res.json(mappings);
}));

router.get('/identity/cluster/members', asyncHandler(async (req, res) => {
    const members = await identityService.getClusterMembers(req.query.xid, req.query.graphType);
    res.json(members);
}));

router.get('/identity/cluster/history', asyncHandler(async (req, res) => {
    const history = await identityService.getClusterHistory(req.query.xid, req.query.graphType);
    res.json(history);
}));

// ===== PROFILES =====
router.get('/profiles/stats', asyncHandler(async (req, res) => {
    const stats = await profileService.getProfileStats();
    res.json(stats);
}));

router.get('/profiles/preview', asyncHandler(async (req, res) => {
    const preview = await profileService.getProfilePreview();
    res.json(preview);
}));

router.get('/profiles/lookup', asyncHandler(async (req, res) => {
    const { entityId, entityIdNS, ...options } = req.query;
    if (!entityId || !entityIdNS) {
        return res.status(400).json({ error: 'entityId and entityIdNS are required' });
    }
    const profile = await profileService.lookupProfile(entityId, entityIdNS, options);
    res.json(profile);
}));

router.post('/profiles/lookup', asyncHandler(async (req, res) => {
    const profiles = await profileService.lookupMultipleProfiles(req.body.identities, req.body.options);
    res.json(profiles);
}));

router.get('/profiles/distribution/dataset', asyncHandler(async (req, res) => {
    const report = await profileService.getProfilesByDataset(req.query.date);
    res.json(report);
}));

router.get('/profiles/distribution/namespace', asyncHandler(async (req, res) => {
    const report = await profileService.getProfilesByNamespace(req.query.date);
    res.json(report);
}));

router.get('/profiles/orphans', asyncHandler(async (req, res) => {
    const result = await profileService.checkOrphanedProfiles(req.query.months || 3);
    res.json(result);
}));

router.get('/merge-policies', asyncHandler(async (req, res) => {
    const policies = await profileService.listMergePolicies(req.query);
    res.json(policies);
}));

router.get('/merge-policies/:policyId', asyncHandler(async (req, res) => {
    const policy = await profileService.getMergePolicyDetails(req.params.policyId);
    res.json(policy);
}));

router.get('/profile-jobs', asyncHandler(async (req, res) => {
    const jobs = await profileService.listProfileJobs(req.query);
    res.json(jobs);
}));

router.get('/profile-jobs/:jobId', asyncHandler(async (req, res) => {
    const job = await profileService.getProfileJobDetails(req.params.jobId);
    res.json(job);
}));

router.get('/computed-attributes', asyncHandler(async (req, res) => {
    const attrs = await profileService.listComputedAttributes();
    res.json(attrs);
}));

router.get('/projections', asyncHandler(async (req, res) => {
    const projections = await profileService.listProjections(req.query.schemaName);
    res.json(projections);
}));

router.get('/projection-destinations', asyncHandler(async (req, res) => {
    const destinations = await profileService.listProjectionDestinations();
    res.json(destinations);
}));

// ===== QUERIES =====
router.get('/queries', asyncHandler(async (req, res) => {
    const queries = await queryService.listQueries(req.query);
    res.json(queries);
}));

router.get('/queries/stats', asyncHandler(async (req, res) => {
    const stats = await queryService.getQueryStats();
    res.json(stats);
}));

// Execute a query (creates and polls for completion)
router.post('/queries', asyncHandler(async (req, res) => {
    const { sql, name, description } = req.body;

    if (!sql) {
        return res.status(400).json({ error: 'SQL query is required' });
    }

    // Create the query
    const queryData = {
        dbName: 'prod:all',  // Default database
        sql,
        name: name || `Query_${Date.now()}`,
        description: description || 'Executed from AEP Monitor'
    };

    const createdQuery = await queryService.createQuery(queryData);

    // Poll for completion (max 30 seconds)
    const startTime = Date.now();
    const timeout = 30000;
    let result = createdQuery;

    while (['SUBMITTED', 'IN_PROGRESS', 'PENDING'].includes(result.state)) {
        if (Date.now() - startTime > timeout) {
            return res.json({
                ...result,
                message: 'Query is still running. Check back later.',
                polling: true
            });
        }

        await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
        result = await queryService.getQueryDetails(result.id);
    }

    res.json(result);
}));

router.get('/queries/connection', asyncHandler(async (req, res) => {
    const params = await queryService.getConnectionParams();
    res.json(params);
}));

router.get('/queries/:queryId', asyncHandler(async (req, res) => {
    const query = await queryService.getQueryDetails(req.params.queryId);
    res.json(query);
}));

router.get('/query-schedules', asyncHandler(async (req, res) => {
    const schedules = await queryService.listSchedules(req.query);
    res.json(schedules);
}));

router.get('/query-schedules/:scheduleId', asyncHandler(async (req, res) => {
    const schedule = await queryService.getScheduleDetails(req.params.scheduleId);
    res.json(schedule);
}));

router.get('/query-schedules/:scheduleId/runs', asyncHandler(async (req, res) => {
    const runs = await queryService.listScheduleRuns(req.params.scheduleId, req.query);
    res.json(runs);
}));

router.get('/query-schedules/:scheduleId/runs/:runId', asyncHandler(async (req, res) => {
    const run = await queryService.getScheduleRunDetails(req.params.scheduleId, req.params.runId);
    res.json(run);
}));

router.get('/query-templates', asyncHandler(async (req, res) => {
    const templates = await queryService.listTemplates(req.query);
    res.json(templates);
}));

router.get('/query-templates/count', asyncHandler(async (req, res) => {
    const count = await queryService.getTemplateCount();
    res.json(count);
}));

router.get('/query-templates/:templateId', asyncHandler(async (req, res) => {
    const template = await queryService.getTemplateDetails(req.params.templateId);
    res.json(template);
}));

// ===== FLOWS =====
router.get('/flows', asyncHandler(async (req, res) => {
    const flows = await flowService.listFlows(req.query);
    res.json(flows);
}));

router.get('/flows/stats', asyncHandler(async (req, res) => {
    const stats = await flowService.getFlowStats();
    res.json(stats);
}));

router.get('/flows/:flowId', asyncHandler(async (req, res) => {
    const flow = await flowService.getFlowDetails(req.params.flowId);
    res.json(flow);
}));

router.get('/flow-runs', asyncHandler(async (req, res) => {
    const runs = await flowService.listFlowRuns(req.query);
    res.json(runs);
}));

router.get('/flow-runs/:runId', asyncHandler(async (req, res) => {
    const run = await flowService.getFlowRunDetails(req.params.runId);
    res.json(run);
}));

router.get('/flow-specs', asyncHandler(async (req, res) => {
    const specs = await flowService.listFlowSpecs(req.query);
    res.json(specs);
}));

router.get('/flow-specs/:specId', asyncHandler(async (req, res) => {
    const spec = await flowService.getFlowSpecDetails(req.params.specId);
    res.json(spec);
}));

router.get('/connections', asyncHandler(async (req, res) => {
    const connections = await flowService.listConnections(req.query);
    res.json(connections);
}));

router.get('/connections/:connectionId', asyncHandler(async (req, res) => {
    const connection = await flowService.getConnectionDetails(req.params.connectionId);
    res.json(connection);
}));

router.get('/connections/:connectionId/test', asyncHandler(async (req, res) => {
    const result = await flowService.testConnection(req.params.connectionId);
    res.json(result);
}));

router.get('/connections/:connectionId/explore', asyncHandler(async (req, res) => {
    const result = await flowService.exploreConnection(req.params.connectionId);
    res.json(result);
}));

router.get('/connection-specs', asyncHandler(async (req, res) => {
    const specs = await flowService.listConnectionSpecs(req.query);
    res.json(specs);
}));

router.get('/connection-specs/:specId', asyncHandler(async (req, res) => {
    const spec = await flowService.getConnectionSpecDetails(req.params.specId);
    res.json(spec);
}));

router.get('/source-connections', asyncHandler(async (req, res) => {
    const connections = await flowService.listSourceConnections(req.query);
    res.json(connections);
}));

router.get('/source-connections/:connectionId', asyncHandler(async (req, res) => {
    const connection = await flowService.getSourceConnectionDetails(req.params.connectionId);
    res.json(connection);
}));

router.get('/target-connections', asyncHandler(async (req, res) => {
    const connections = await flowService.listTargetConnections(req.query);
    res.json(connections);
}));

router.get('/target-connections/:connectionId', asyncHandler(async (req, res) => {
    const connection = await flowService.getTargetConnectionDetails(req.params.connectionId);
    res.json(connection);
}));

// ===== SEGMENTS =====
router.get('/segments', asyncHandler(async (req, res) => {
    const segments = await segmentService.listSegments(req.query);
    res.json(segments);
}));

router.get('/segments/stats', asyncHandler(async (req, res) => {
    const stats = await segmentService.getSegmentStats();
    res.json(stats);
}));

router.get('/segments/:segmentId', asyncHandler(async (req, res) => {
    const segment = await segmentService.getSegmentDetails(req.params.segmentId);
    res.json(segment);
}));

router.get('/segment-jobs', asyncHandler(async (req, res) => {
    const jobs = await segmentService.listSegmentJobs(req.query);
    res.json(jobs);
}));

router.get('/segment-jobs/:jobId', asyncHandler(async (req, res) => {
    const job = await segmentService.getSegmentJobDetails(req.params.jobId);
    res.json(job);
}));

router.get('/export-jobs', asyncHandler(async (req, res) => {
    const jobs = await segmentService.listExportJobs(req.query);
    res.json(jobs);
}));

router.get('/export-jobs/:jobId', asyncHandler(async (req, res) => {
    const job = await segmentService.getExportJobDetails(req.params.jobId);
    res.json(job);
}));

router.get('/segment-schedules', asyncHandler(async (req, res) => {
    const schedules = await segmentService.listSegmentSchedules(req.query);
    res.json(schedules);
}));

router.get('/segment-schedules/:scheduleId', asyncHandler(async (req, res) => {
    const schedule = await segmentService.getSegmentScheduleDetails(req.params.scheduleId);
    res.json(schedule);
}));

// ===== SANDBOXES =====
router.get('/sandboxes', asyncHandler(async (req, res) => {
    const sandboxes = await sandboxService.listSandboxes(req.query);
    res.json(sandboxes);
}));

router.get('/sandboxes/stats', asyncHandler(async (req, res) => {
    const stats = await sandboxService.getSandboxStats();
    res.json(stats);
}));

router.get('/sandboxes/types', asyncHandler(async (req, res) => {
    const types = await sandboxService.listSandboxTypes();
    res.json(types);
}));

router.get('/sandboxes/current', asyncHandler(async (req, res) => {
    const current = await sandboxService.getCurrentSandbox();
    res.json(current);
}));

router.get('/sandboxes/active', asyncHandler(async (req, res) => {
    const active = await sandboxService.listActiveSandboxes();
    res.json(active);
}));

router.get('/sandboxes/:sandboxName', asyncHandler(async (req, res) => {
    const sandbox = await sandboxService.getSandboxDetails(req.params.sandboxName);
    res.json(sandbox);
}));

// ===== POLICIES =====
router.get('/policies/stats', asyncHandler(async (req, res) => {
    const stats = await policyService.getPolicyStats();
    res.json(stats);
}));

router.get('/labels/core', asyncHandler(async (req, res) => {
    const labels = await policyService.listCoreLabels(req.query);
    res.json(labels);
}));

router.get('/labels/core/:labelName', asyncHandler(async (req, res) => {
    const label = await policyService.getCoreLabelDetails(req.params.labelName);
    res.json(label);
}));

router.get('/labels/custom', asyncHandler(async (req, res) => {
    const labels = await policyService.listCustomLabels(req.query);
    res.json(labels);
}));

router.get('/labels/custom/:labelName', asyncHandler(async (req, res) => {
    const label = await policyService.getCustomLabelDetails(req.params.labelName);
    res.json(label);
}));

router.get('/policies/core', asyncHandler(async (req, res) => {
    const policies = await policyService.listCorePolicies(req.query);
    res.json(policies);
}));

router.get('/policies/core/:policyId', asyncHandler(async (req, res) => {
    const policy = await policyService.getCorePolicyDetails(req.params.policyId);
    res.json(policy);
}));

router.get('/policies/custom', asyncHandler(async (req, res) => {
    const policies = await policyService.listCustomPolicies(req.query);
    res.json(policies);
}));

router.get('/policies/custom/:policyId', asyncHandler(async (req, res) => {
    const policy = await policyService.getCustomPolicyDetails(req.params.policyId);
    res.json(policy);
}));

router.get('/policies/enabled', asyncHandler(async (req, res) => {
    const enabled = await policyService.listEnabledCorePolicies();
    res.json(enabled);
}));

router.get('/marketing-actions/core', asyncHandler(async (req, res) => {
    const actions = await policyService.listCoreMarketingActions(req.query);
    res.json(actions);
}));

router.get('/marketing-actions/core/:actionName', asyncHandler(async (req, res) => {
    const action = await policyService.getCoreMarketingActionDetails(req.params.actionName);
    res.json(action);
}));

router.get('/marketing-actions/custom', asyncHandler(async (req, res) => {
    const actions = await policyService.listCustomMarketingActions(req.query);
    res.json(actions);
}));

router.get('/marketing-actions/custom/:actionName', asyncHandler(async (req, res) => {
    const action = await policyService.getCustomMarketingActionDetails(req.params.actionName);
    res.json(action);
}));

// ===== OBSERVABILITY =====
router.get('/observability/stats', asyncHandler(async (req, res) => {
    const stats = await observabilityService.getObservabilityStats();
    res.json(stats);
}));

router.get('/observability/ingestion', asyncHandler(async (req, res) => {
    const metrics = await observabilityService.getIngestionMetrics(req.query);
    res.json(metrics);
}));

router.get('/observability/profile', asyncHandler(async (req, res) => {
    const metrics = await observabilityService.getProfileMetrics(req.query);
    res.json(metrics);
}));

router.get('/observability/identity', asyncHandler(async (req, res) => {
    const metrics = await observabilityService.getIdentityMetrics(req.query);
    res.json(metrics);
}));

router.post('/observability/metrics', asyncHandler(async (req, res) => {
    const metrics = await observabilityService.getMetricsV2(req.body);
    res.json(metrics);
}));

// ===== AUDIT =====
router.get('/audit/stats', asyncHandler(async (req, res) => {
    const stats = await auditService.getAuditStats();
    res.json(stats);
}));

router.get('/audit/events', asyncHandler(async (req, res) => {
    const events = await auditService.listAuditEvents(req.query);
    res.json(events);
}));

router.get('/audit/events/:eventId', asyncHandler(async (req, res) => {
    const event = await auditService.getAuditEventDetails(req.params.eventId);
    res.json(event);
}));

// ===== ACCESS / PRIVACY =====
router.get('/access/permissions', asyncHandler(async (req, res) => {
    const permissions = await accessService.getPermissionReference();
    res.json(permissions);
}));

router.get('/privacy/stats', asyncHandler(async (req, res) => {
    const stats = await accessService.getPrivacyStats();
    res.json(stats);
}));

router.get('/privacy/jobs', asyncHandler(async (req, res) => {
    const jobs = await accessService.listPrivacyJobs(req.query);
    res.json(jobs);
}));

router.get('/privacy/jobs/:jobId', asyncHandler(async (req, res) => {
    const job = await accessService.getPrivacyJobDetails(req.params.jobId);
    res.json(job);
}));

router.get('/files/:fileId', asyncHandler(async (req, res) => {
    const file = await accessService.getFileDetails(req.params.fileId);
    res.json(file);
}));

router.get('/files/:fileId/preview', asyncHandler(async (req, res) => {
    const preview = await accessService.previewFile(req.params.fileId, req.query);
    res.json(preview);
}));

// ===== AI AGENT =====
import * as agentService from '../agent/agent.service.js';

router.post('/agent/chat', asyncHandler(async (req, res) => {
    const { message, autoMode, history, approvedAction } = req.body;
    const response = await agentService.processMessage({
        message,
        autoMode,
        history,
        approvedAction
    });
    res.json(response);
}));

router.get('/agent/tools', asyncHandler(async (req, res) => {
    const tools = agentService.getTools();
    res.json(tools);
}));

router.get('/agent/history', asyncHandler(async (req, res) => {
    const history = agentService.getHistory();
    res.json(history);
}));

router.delete('/agent/history', asyncHandler(async (req, res) => {
    agentService.clearHistory();
    res.json({ success: true });
}));

// ===== CHAT HISTORY (Recall) =====
import * as chatService from '../services/chat.service.js';

router.get('/chat/conversations', asyncHandler(async (req, res) => {
    const conversations = chatService.getConversations();
    res.json({ conversations });
}));

router.get('/chat/conversations/:id', asyncHandler(async (req, res) => {
    const conversation = chatService.getConversation(req.params.id);
    if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
}));

router.post('/chat/conversations', asyncHandler(async (req, res) => {
    const { title } = req.body;
    const conversation = chatService.createConversation(title);
    res.json(conversation);
}));

router.put('/chat/conversations/:id', asyncHandler(async (req, res) => {
    const { messages } = req.body;
    const conversation = chatService.saveMessages(req.params.id, messages);
    res.json(conversation);
}));

router.delete('/chat/conversations/:id', asyncHandler(async (req, res) => {
    chatService.deleteConversation(req.params.id);
    res.json({ success: true });
}));

router.delete('/chat/conversations', asyncHandler(async (req, res) => {
    chatService.clearAllConversations();
    res.json({ success: true });
}));

// ===== SCHEMA CONTEXT FOR AGENT =====
router.get('/agent/schema-context', asyncHandler(async (req, res) => {
    // Get all schemas with their field paths for agent context
    try {
        const schemas = await schemaService.listSchemas('tenant', { limit: 50 });
        const schemaList = schemas?.results || [];

        // Extract field paths from schemas
        const fieldPaths = [];
        for (const schema of schemaList.slice(0, 10)) {
            try {
                const details = await schemaService.getSchemaDetails(schema.$id || schema.meta?.altId, 'tenant');
                if (details?.properties) {
                    extractFieldPaths(details.properties, '', fieldPaths, schema.title);
                }
            } catch (e) {
                // Skip schemas that fail to load
            }
        }

        res.json({
            schemaCount: schemaList.length,
            fieldPaths: fieldPaths.slice(0, 100), // Limit to top 100 fields
            commonFields: extractCommonFields(fieldPaths)
        });
    } catch (error) {
        res.json({ error: error.message, fieldPaths: [], commonFields: [] });
    }
}));

// Helper to extract field paths from schema
function extractFieldPaths(properties, prefix, results, schemaTitle) {
    for (const [key, value] of Object.entries(properties || {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        results.push({
            path,
            type: value.type || 'object',
            title: value.title || key,
            schema: schemaTitle
        });
        if (value.properties) {
            extractFieldPaths(value.properties, path, results, schemaTitle);
        }
    }
}

// Extract common profile fields
function extractCommonFields(fieldPaths) {
    const commonPatterns = ['email', 'gender', 'birthDate', 'age', 'firstName', 'lastName', 'phone', 'address', 'city', 'country'];
    return fieldPaths.filter(f =>
        commonPatterns.some(p => f.path.toLowerCase().includes(p.toLowerCase()))
    ).slice(0, 20);
}

export default router;

