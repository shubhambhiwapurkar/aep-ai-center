/**
 * Tool Registry - All tools available to the AI Agent
 * Each tool represents an action the agent can take
 */
import * as batchService from '../../services/batch.service.js';
import * as schemaService from '../../services/schema.service.js';
import * as datasetService from '../../services/dataset.service.js';
import * as identityService from '../../services/identity.service.js';
import * as profileService from '../../services/profile.service.js';
import * as queryService from '../../services/query.service.js';
import * as segmentService from '../../services/segment.service.js';
import * as sandboxService from '../../services/sandbox.service.js';
import * as flowService from '../../services/flow.service.js';
import * as policyService from '../../services/policy.service.js';
import * as auditService from '../../services/audit.service.js';
import * as observabilityService from '../../services/observability.service.js';

/**
 * Tool definitions for the AI Agent
 * Each tool has: name, description, parameters, execute function, requiresApproval flag
 */
export const tools = {
    // ===== BATCH TOOLS =====
    get_failed_batches: {
        name: 'get_failed_batches',
        description: 'Get batches that failed during ingestion. Use this when user asks about failed batches, errors, or ingestion problems.',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum number of results (default 10)' },
                datasetId: { type: 'string', description: 'Filter by dataset ID (optional)' }
            }
        },
        requiresApproval: false,
        execute: async ({ limit = 10, datasetId }) => {
            const batches = await batchService.listBatches({
                status: 'failed',
                limit: String(limit),
                datasetId
            });
            return batches;
        }
    },

    get_batch_details: {
        name: 'get_batch_details',
        description: 'Get detailed information about a specific batch including errors and metadata',
        parameters: {
            type: 'object',
            properties: {
                batchId: { type: 'string', description: 'The batch ID to look up' }
            },
            required: ['batchId']
        },
        requiresApproval: false,
        execute: async ({ batchId }) => {
            const [details, meta, failed] = await Promise.all([
                batchService.getBatchDetails(batchId),
                batchService.getBatchMeta(batchId).catch(() => null),
                batchService.getFailedRecords(batchId).catch(() => ({ data: [] }))
            ]);
            return { details, meta, failedRecords: failed };
        }
    },

    get_batch_stats: {
        name: 'get_batch_stats',
        description: 'Get overall batch ingestion statistics including success rates and counts',
        parameters: {
            type: 'object',
            properties: {
                timeRange: { type: 'string', description: 'Time range: 24h, 7d, 30d, or all' }
            }
        },
        requiresApproval: false,
        execute: async ({ timeRange = '24h' }) => {
            return batchService.getBatchStats(timeRange);
        }
    },

    // ===== SCHEMA TOOLS =====
    search_schemas: {
        name: 'search_schemas',
        description: 'Search for schemas in the Schema Registry by name or property',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term for schema name' },
                container: { type: 'string', description: 'Container: tenant or global' }
            }
        },
        requiresApproval: false,
        execute: async ({ query, container = 'tenant' }) => {
            const schemas = await schemaService.listSchemas(container, {
                property: query ? `title~${query}` : undefined
            });
            return schemas;
        }
    },

    get_schema_stats: {
        name: 'get_schema_stats',
        description: 'Get schema registry statistics - counts by type, behaviors, etc.',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return schemaService.getRegistryStats();
        }
    },

    get_schema_details: {
        name: 'get_schema_details',
        description: 'Get detailed information about a specific schema including properties',
        parameters: {
            type: 'object',
            properties: {
                schemaId: { type: 'string', description: 'The schema ID (URL encoded)' },
                container: { type: 'string', description: 'Container: tenant or global' }
            },
            required: ['schemaId']
        },
        requiresApproval: false,
        execute: async ({ schemaId, container = 'tenant' }) => {
            return schemaService.getSchemaDetails(schemaId, container);
        }
    },

    // ===== DATASET TOOLS =====
    list_datasets: {
        name: 'list_datasets',
        description: 'List all datasets in the catalog',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum results' }
            }
        },
        requiresApproval: false,
        execute: async ({ limit = 20 }) => {
            return datasetService.listDatasets({ limit: String(limit) });
        }
    },

    get_dataset_stats: {
        name: 'get_dataset_stats',
        description: 'Get dataset statistics - total count, sizes, types',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return datasetService.getDatasetStats();
        }
    },

    // ===== PROFILE TOOLS =====
    lookup_profile: {
        name: 'lookup_profile',
        description: 'Look up a profile by identity (email, ECID, phone, etc.)',
        parameters: {
            type: 'object',
            properties: {
                namespace: { type: 'string', description: 'Identity namespace (e.g., Email, ECID)' },
                identity: { type: 'string', description: 'The identity value' }
            },
            required: ['namespace', 'identity']
        },
        requiresApproval: false,
        execute: async ({ namespace, identity }) => {
            return profileService.lookupProfileByIdentity(namespace, identity);
        }
    },

    get_profile_stats: {
        name: 'get_profile_stats',
        description: 'Get profile store statistics - total profiles, namespaces, etc.',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return profileService.getProfileStats();
        }
    },

    // ===== IDENTITY TOOLS =====
    list_namespaces: {
        name: 'list_namespaces',
        description: 'List all identity namespaces',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return identityService.listNamespaces();
        }
    },

    get_identity_xid: {
        name: 'get_identity_xid',
        description: 'Get the XID (Experience ID) for an identity',
        parameters: {
            type: 'object',
            properties: {
                namespace: { type: 'string', description: 'Identity namespace' },
                id: { type: 'string', description: 'Identity value' }
            },
            required: ['namespace', 'id']
        },
        requiresApproval: false,
        execute: async ({ namespace, id }) => {
            return identityService.getXID(namespace, id);
        }
    },

    // ===== QUERY TOOLS =====
    list_recent_queries: {
        name: 'list_recent_queries',
        description: 'List recent queries executed in Query Service',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum results' }
            }
        },
        requiresApproval: false,
        execute: async ({ limit = 10 }) => {
            return queryService.listQueries({ limit: String(limit), orderby: '-created' });
        }
    },

    execute_sql_query: {
        name: 'execute_sql_query',
        description: 'Execute a SQL query against AEP data. REQUIRES USER APPROVAL.',
        parameters: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'The SQL query to execute' },
                name: { type: 'string', description: 'Optional name for the query' }
            },
            required: ['sql']
        },
        requiresApproval: true, // REQUIRES APPROVAL
        execute: async ({ sql, name }) => {
            return queryService.createQuery({
                dbName: 'prod:all',
                sql,
                name: name || `Agent_Query_${Date.now()}`
            });
        }
    },

    get_query_stats: {
        name: 'get_query_stats',
        description: 'Get query service statistics',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return queryService.getQueryStats();
        }
    },

    // ===== SEGMENT TOOLS =====
    list_segments: {
        name: 'list_segments',
        description: 'List audience segments',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum results' }
            }
        },
        requiresApproval: false,
        execute: async ({ limit = 20 }) => {
            return segmentService.listSegments({ limit: String(limit) });
        }
    },

    get_segment_stats: {
        name: 'get_segment_stats',
        description: 'Get segment statistics',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return segmentService.getSegmentStats();
        }
    },

    // ===== SANDBOX TOOLS =====
    list_sandboxes: {
        name: 'list_sandboxes',
        description: 'List all sandboxes in the organization',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return sandboxService.listSandboxes();
        }
    },

    get_current_sandbox: {
        name: 'get_current_sandbox',
        description: 'Get the currently active sandbox',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        execute: async () => {
            return sandboxService.getCurrentSandbox();
        }
    },

    // ===== FORENSIC AGENT TOOLS =====
    analyze_batch_errors: {
        name: 'analyze_batch_errors',
        description: 'Analyze errors from a failed batch, categorize them, and identify root cause patterns. Use when a batch has failed and user wants to understand why.',
        parameters: {
            type: 'object',
            properties: {
                batchId: { type: 'string', description: 'The batch ID to analyze' }
            },
            required: ['batchId']
        },
        requiresApproval: false,
        execute: async ({ batchId }) => {
            // Get batch details and failed records
            const [details, failed] = await Promise.all([
                batchService.getBatchDetails(batchId),
                batchService.getFailedRecords(batchId).catch(() => ({ data: [] }))
            ]);

            // Analyze error patterns
            const errorCounts = {};
            const sampleErrors = [];
            const failedRecords = failed?.data || [];

            failedRecords.forEach((record, idx) => {
                const errorCode = record.errorCode || record.code || 'UNKNOWN';
                const errorMessage = record.message || record.errorMessage || 'No message';

                if (!errorCounts[errorCode]) {
                    errorCounts[errorCode] = { count: 0, message: errorMessage, samples: [] };
                }
                errorCounts[errorCode].count++;

                if (errorCounts[errorCode].samples.length < 3) {
                    errorCounts[errorCode].samples.push({
                        index: idx,
                        data: record.data || record
                    });
                }
            });

            // Calculate percentages and sort by frequency
            const totalErrors = failedRecords.length;
            const errorAnalysis = Object.entries(errorCounts)
                .map(([code, info]) => ({
                    errorCode: code,
                    count: info.count,
                    percentage: totalErrors > 0 ? ((info.count / totalErrors) * 100).toFixed(1) : 0,
                    message: info.message,
                    samples: info.samples
                }))
                .sort((a, b) => b.count - a.count);

            return {
                batchId,
                status: details?.status || 'unknown',
                totalErrors,
                createdAt: details?.created,
                completedAt: details?.completed,
                datasetId: details?.dataSetId,
                errorBreakdown: errorAnalysis,
                topError: errorAnalysis[0] || null,
                recommendation: errorAnalysis.length > 0
                    ? `${errorAnalysis[0].percentage}% of errors are "${errorAnalysis[0].errorCode}". Review the target schema for type mismatches.`
                    : 'No errors found to analyze.'
            };
        }
    },

    diagnose_ingestion_failure: {
        name: 'diagnose_ingestion_failure',
        description: 'Diagnose why a batch ingestion failed by comparing data with target schema. Identifies type mismatches, missing required fields, and format issues.',
        parameters: {
            type: 'object',
            properties: {
                batchId: { type: 'string', description: 'The failed batch ID' },
                datasetId: { type: 'string', description: 'Target dataset ID (optional, will be fetched from batch if not provided)' }
            },
            required: ['batchId']
        },
        requiresApproval: false,
        execute: async ({ batchId, datasetId }) => {
            // Get batch and dataset info
            const batchDetails = await batchService.getBatchDetails(batchId);
            const targetDatasetId = datasetId || batchDetails?.dataSetId;

            let datasetInfo = null;
            let schemaInfo = null;

            if (targetDatasetId) {
                try {
                    datasetInfo = await datasetService.getDatasetDetails(targetDatasetId);
                    if (datasetInfo?.schemaRef?.id) {
                        schemaInfo = await schemaService.getSchemaDetails(
                            encodeURIComponent(datasetInfo.schemaRef.id),
                            'tenant'
                        ).catch(() => null);
                    }
                } catch (e) {
                    console.error('Failed to fetch dataset/schema', e);
                }
            }

            // Get failed records for analysis
            const failedRecords = await batchService.getFailedRecords(batchId).catch(() => ({ data: [] }));

            const diagnosis = {
                batchId,
                status: batchDetails?.status,
                dataset: {
                    id: targetDatasetId,
                    name: datasetInfo?.name || 'Unknown'
                },
                schema: schemaInfo ? {
                    id: datasetInfo?.schemaRef?.id,
                    title: schemaInfo?.title || 'Unknown'
                } : null,
                errorCount: failedRecords?.data?.length || 0,
                issues: [],
                recommendations: []
            };

            // Common issue patterns
            if (!schemaInfo) {
                diagnosis.issues.push('Could not fetch target schema - verify dataset configuration');
            }

            if (batchDetails?.status === 'failed') {
                const errors = batchDetails?.errors || [];
                errors.forEach(err => {
                    if (err.code?.includes('TYPE')) {
                        diagnosis.issues.push(`Type mismatch: ${err.description || err.message}`);
                        diagnosis.recommendations.push('Check that source data types match the XDM schema');
                    }
                    if (err.code?.includes('REQUIRED') || err.code?.includes('MISSING')) {
                        diagnosis.issues.push(`Missing required field: ${err.description || err.message}`);
                        diagnosis.recommendations.push('Ensure all required XDM fields are populated');
                    }
                });
            }

            if (diagnosis.issues.length === 0) {
                diagnosis.issues.push('Batch failed but specific errors not available');
                diagnosis.recommendations.push('Check batch meta API for detailed diagnostics');
            }

            return diagnosis;
        }
    },

    get_error_summary: {
        name: 'get_error_summary',
        description: 'Get a human-readable summary of recent ingestion errors across all batches. Good for getting a quick overview of ingestion health.',
        parameters: {
            type: 'object',
            properties: {
                hours: { type: 'number', description: 'Look back hours (default 24)' }
            }
        },
        requiresApproval: false,
        execute: async ({ hours = 24 }) => {
            const batches = await batchService.listBatches({
                status: 'failed',
                limit: '50'
            });

            const failedBatches = batches?.batches || [];
            const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

            const recentFailed = failedBatches.filter(b =>
                new Date(b.created).getTime() > cutoffTime
            );

            // Group by dataset
            const byDataset = {};
            recentFailed.forEach(b => {
                const dsId = b.dataSetId || 'unknown';
                if (!byDataset[dsId]) {
                    byDataset[dsId] = { count: 0, batches: [] };
                }
                byDataset[dsId].count++;
                byDataset[dsId].batches.push(b.id);
            });

            return {
                timeRange: `Last ${hours} hours`,
                totalFailed: recentFailed.length,
                byDataset: Object.entries(byDataset).map(([id, info]) => ({
                    datasetId: id,
                    failedBatches: info.count,
                    batchIds: info.batches.slice(0, 5)
                })),
                summary: recentFailed.length === 0
                    ? `✅ No failed batches in the last ${hours} hours!`
                    : `⚠️ ${recentFailed.length} batches failed across ${Object.keys(byDataset).length} datasets`
            };
        }
    },

    // ===== IDENTITY GRAPH DOCTOR TOOLS =====
    get_identity_graph: {
        name: 'get_identity_graph',
        description: 'Get the identity graph for a specific identity. Shows all linked identities across namespaces.',
        parameters: {
            type: 'object',
            properties: {
                namespace: { type: 'string', description: 'Identity namespace (e.g., Email, ECID, Phone)' },
                identity: { type: 'string', description: 'The identity value' }
            },
            required: ['namespace', 'identity']
        },
        requiresApproval: false,
        execute: async ({ namespace, identity }) => {
            // First get the XID
            const xidResult = await identityService.getIdentityXID(namespace, identity);
            const xid = xidResult?.xid;

            if (!xid) {
                return { error: 'Could not find XID for this identity', namespace, identity };
            }

            // Get cluster members
            const cluster = await identityService.getClusterMembers(xid).catch(() => null);
            const members = cluster?.cluster || [];

            // Get namespaces for context
            const namespaces = await identityService.listNamespaces().catch(() => []);
            const nsMap = {};
            namespaces.forEach(ns => { nsMap[ns.id] = ns; });

            return {
                inputIdentity: { namespace, identity, xid },
                graphSize: members.length,
                members: members.map(m => ({
                    xid: m.xid,
                    namespace: nsMap[m.nsid]?.code || m.nsid,
                    namespaceName: nsMap[m.nsid]?.name || 'Unknown'
                })),
                isSharedDevice: members.length > 10,
                warning: members.length > 10
                    ? '⚠️ This identity has many linked profiles - could be a shared device'
                    : null
            };
        }
    },

    diagnose_identity_link: {
        name: 'diagnose_identity_link',
        description: 'Diagnose why two identities are or are not linked. Analyzes namespace priorities and graph connections.',
        parameters: {
            type: 'object',
            properties: {
                namespace1: { type: 'string', description: 'First identity namespace' },
                identity1: { type: 'string', description: 'First identity value' },
                namespace2: { type: 'string', description: 'Second identity namespace' },
                identity2: { type: 'string', description: 'Second identity value' }
            },
            required: ['namespace1', 'identity1', 'namespace2', 'identity2']
        },
        requiresApproval: false,
        execute: async ({ namespace1, identity1, namespace2, identity2 }) => {
            // Get XIDs for both identities
            const [xid1Result, xid2Result] = await Promise.all([
                identityService.getIdentityXID(namespace1, identity1).catch(() => null),
                identityService.getIdentityXID(namespace2, identity2).catch(() => null)
            ]);

            const xid1 = xid1Result?.xid;
            const xid2 = xid2Result?.xid;

            const diagnosis = {
                identity1: { namespace: namespace1, value: identity1, xid: xid1, found: !!xid1 },
                identity2: { namespace: namespace2, value: identity2, xid: xid2, found: !!xid2 },
                areLinked: false,
                reasons: [],
                recommendations: []
            };

            if (!xid1) {
                diagnosis.reasons.push(`Identity 1 (${namespace1}:${identity1}) not found in the graph`);
                diagnosis.recommendations.push('Verify this identity exists in ingested data');
            }

            if (!xid2) {
                diagnosis.reasons.push(`Identity 2 (${namespace2}:${identity2}) not found in the graph`);
                diagnosis.recommendations.push('Verify this identity exists in ingested data');
            }

            if (xid1 && xid2) {
                // Get cluster for first identity
                const cluster = await identityService.getClusterMembers(xid1).catch(() => ({ cluster: [] }));
                const members = cluster?.cluster || [];

                // Check if xid2 is in the cluster
                diagnosis.areLinked = members.some(m => m.xid === xid2);

                if (diagnosis.areLinked) {
                    diagnosis.reasons.push('✅ These identities ARE linked in the same cluster');
                } else {
                    diagnosis.reasons.push('❌ These identities are NOT linked');
                    diagnosis.reasons.push('Possible causes: Different ingestion sources, namespace priority mismatch, or no common event/record');
                    diagnosis.recommendations.push('Check if both identities appear in the same record/event');
                    diagnosis.recommendations.push('Review namespace priority settings');
                    diagnosis.recommendations.push('Verify identity graph configuration');
                }

                // Check for shared device pattern
                if (members.length > 10) {
                    diagnosis.reasons.push(`⚠️ Identity 1 is part of a large cluster (${members.length} members) - possible shared device`);
                }
            }

            return diagnosis;
        }
    },

    detect_shared_device: {
        name: 'detect_shared_device',
        description: 'Detect if an identity belongs to a shared device by checking cluster size and linking patterns.',
        parameters: {
            type: 'object',
            properties: {
                namespace: { type: 'string', description: 'Identity namespace' },
                identity: { type: 'string', description: 'Identity value (e.g., ECID)' },
                threshold: { type: 'number', description: 'Threshold for shared device detection (default 10)' }
            },
            required: ['namespace', 'identity']
        },
        requiresApproval: false,
        execute: async ({ namespace, identity, threshold = 10 }) => {
            const xidResult = await identityService.getIdentityXID(namespace, identity).catch(() => null);
            const xid = xidResult?.xid;

            if (!xid) {
                return { found: false, error: 'Identity not found in graph' };
            }

            const cluster = await identityService.getClusterMembers(xid).catch(() => ({ cluster: [] }));
            const members = cluster?.cluster || [];

            // Analyze namespace distribution
            const nsCounts = {};
            members.forEach(m => {
                nsCounts[m.nsid] = (nsCounts[m.nsid] || 0) + 1;
            });

            const isSharedDevice = members.length > threshold;

            return {
                identity: { namespace, value: identity, xid },
                clusterSize: members.length,
                threshold,
                isSharedDevice,
                namespaceDistribution: nsCounts,
                verdict: isSharedDevice
                    ? `🚨 SHARED DEVICE DETECTED: This ${namespace} is linked to ${members.length} identities (threshold: ${threshold})`
                    : `✅ Normal: This ${namespace} is linked to ${members.length} identities`,
                recommendation: isSharedDevice
                    ? 'Consider excluding this identity from person-based segments and personalization'
                    : null
            };
        }
    },

    // ===== SEGMENT DEBUGGER TOOLS =====
    debug_segment: {
        name: 'debug_segment',
        description: 'Debug why a segment has 0 or low qualified profiles. Checks merge policy, PQL validity, and sample profile evaluation.',
        parameters: {
            type: 'object',
            properties: {
                segmentId: { type: 'string', description: 'The segment ID to debug' }
            },
            required: ['segmentId']
        },
        requiresApproval: false,
        execute: async ({ segmentId }) => {
            // Get segment details
            const segment = await segmentService.getSegmentDetails(segmentId).catch(() => null);

            if (!segment) {
                return { error: 'Segment not found', segmentId };
            }

            const debug = {
                segmentId,
                name: segment.name,
                status: segment.status,
                evaluationType: segment.type || 'batch',
                pql: segment.expression?.value,
                mergePolicyId: segment.mergePolicyId,
                lastEvaluated: segment.lastEvaluatedTs,
                qualifiedCount: segment.profiles || 0,
                issues: [],
                recommendations: []
            };

            // Check for common issues
            if (!segment.expression?.value) {
                debug.issues.push('No PQL expression defined');
                debug.recommendations.push('Add a valid PQL expression to qualify profiles');
            }

            if (segment.status !== 'ACTIVE') {
                debug.issues.push(`Segment is not active (status: ${segment.status})`);
                debug.recommendations.push('Enable the segment for evaluation');
            }

            if (segment.type === 'streaming') {
                debug.issues.push('Streaming segments have 4-6 hour latency');
                debug.recommendations.push('Recent profile updates may not yet be reflected');
            }

            if (!segment.mergePolicyId) {
                debug.issues.push('No merge policy specified');
                debug.recommendations.push('Specify a merge policy that includes your target datasets');
            }

            if (debug.qualifiedCount === 0 && debug.issues.length === 0) {
                debug.issues.push('Segment evaluated but no profiles matched');
                debug.recommendations.push('Review PQL criteria - may be too restrictive');
                debug.recommendations.push('Verify target datasets are enabled for profile');
            }

            return debug;
        }
    },

    generate_pql_from_description: {
        name: 'generate_pql_from_description',
        description: 'Generate a PQL (Profile Query Language) expression from a natural language description. For creating segments.',
        parameters: {
            type: 'object',
            properties: {
                description: { type: 'string', description: 'Natural language description of the segment criteria' }
            },
            required: ['description']
        },
        requiresApproval: true, // Requires approval since it generates code
        execute: async ({ description }) => {
            // This would ideally use the LLM to generate PQL
            // For now, provide templates based on common patterns
            const templates = {
                'purchase': 'select * from ProfileEntity where purchases.purchaseDate > date("now - 30d")',
                'email': 'select * from ProfileEntity where personalEmail.address is not null',
                'loyalty': 'select * from ProfileEntity where loyalty.tier = "gold"',
                'active': 'select * from ProfileEntity where lastActivity > date("now - 7d")',
                'high value': 'select * from ProfileEntity where metrics.lifetimeValue > 1000'
            };

            const descLower = description.toLowerCase();
            let suggestedPql = null;
            let matchedTemplate = null;

            for (const [key, pql] of Object.entries(templates)) {
                if (descLower.includes(key)) {
                    suggestedPql = pql;
                    matchedTemplate = key;
                    break;
                }
            }

            return {
                description,
                suggestedPql: suggestedPql || 'select * from ProfileEntity where [YOUR_CONDITION]',
                matchedTemplate,
                note: suggestedPql
                    ? `Generated PQL based on "${matchedTemplate}" pattern. Review and modify field names as needed.`
                    : 'Could not match to a known pattern. Please specify the exact attribute and condition.',
                examples: [
                    { desc: 'Users who purchased in last 30 days', pql: 'purchases.purchaseDate > date("now - 30d")' },
                    { desc: 'Gold loyalty members', pql: 'loyalty.tier = "gold"' },
                    { desc: 'Users with email', pql: 'personalEmail.address is not null' }
                ]
            };
        }
    },

    // ===== SQL ANALYST AGENT TOOLS =====
    generate_sql_from_intent: {
        name: 'generate_sql_from_intent',
        description: 'Generate a SQL query from a natural language description. For AEP Query Service.',
        parameters: {
            type: 'object',
            properties: {
                intent: { type: 'string', description: 'Natural language description of the data you want' }
            },
            required: ['intent']
        },
        requiresApproval: true, // Requires approval since it generates executable code
        execute: async ({ intent }) => {
            // Pattern matching for common SQL intents
            const patterns = {
                'top': /(?:top|first)\s+(\d+)/i,
                'count': /count|how many/i,
                'revenue': /revenue|sales|total/i,
                'city': /city|cities|location/i,
                'date': /last\s+(\d+)\s+(day|week|month)/i,
                'user': /user|customer|profile/i
            };

            let suggestedSql = '';
            const intentLower = intent.toLowerCase();

            // Build SQL based on patterns matched
            if (patterns.count.test(intentLower)) {
                suggestedSql = 'SELECT COUNT(*) as total\nFROM your_dataset';
            } else if (patterns.revenue.test(intentLower) && patterns.city.test(intentLower)) {
                const topMatch = intentLower.match(patterns.top);
                const limit = topMatch ? topMatch[1] : '10';
                suggestedSql = `SELECT city, SUM(revenue) as total_revenue
FROM commerce_events
GROUP BY city
ORDER BY total_revenue DESC
LIMIT ${limit}`;
            } else if (patterns.user.test(intentLower)) {
                const dateMatch = intentLower.match(patterns.date);
                if (dateMatch) {
                    suggestedSql = `SELECT *
FROM profile_snapshot
WHERE _aep.timestamp > CURRENT_DATE - INTERVAL '${dateMatch[1]} ${dateMatch[2]}s'
LIMIT 100`;
                } else {
                    suggestedSql = `SELECT *
FROM profile_snapshot
LIMIT 100`;
                }
            } else {
                suggestedSql = `-- Intent: ${intent}
SELECT 
    column1,
    column2, 
    COUNT(*) as count
FROM your_table
WHERE condition = 'value'
GROUP BY column1, column2
ORDER BY count DESC
LIMIT 10`;
            }

            return {
                intent,
                suggestedSql,
                note: 'Review and modify table names and columns to match your schema. Use EXPLAIN to check performance before running.',
                tips: [
                    'Use APPROX_COUNT_DISTINCT for large cardinality counts',
                    'Add date partition filters to improve performance',
                    'Avoid SELECT * - specify only needed columns'
                ]
            };
        }
    },

    optimize_sql_query: {
        name: 'optimize_sql_query',
        description: 'Analyze a SQL query and provide optimization suggestions. Identifies full table scans, missing partition filters, and performance issues.',
        parameters: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'The SQL query to optimize' }
            },
            required: ['sql']
        },
        requiresApproval: false,
        execute: async ({ sql }) => {
            const issues = [];
            const suggestions = [];
            const sqlUpper = sql.toUpperCase();

            // Check for SELECT *
            if (sqlUpper.includes('SELECT *')) {
                issues.push('SELECT * retrieves all columns - may cause unnecessary data transfer');
                suggestions.push('Specify only the columns you need: SELECT col1, col2, ...');
            }

            // Check for missing LIMIT
            if (!sqlUpper.includes('LIMIT')) {
                issues.push('No LIMIT clause - query may return very large result set');
                suggestions.push('Add LIMIT clause to restrict result size: LIMIT 1000');
            }

            // Check for missing WHERE clause
            if (!sqlUpper.includes('WHERE')) {
                issues.push('No WHERE clause - full table scan likely');
                suggestions.push('Add date/partition filters in WHERE clause');
            }

            // Check for COUNT DISTINCT
            if (sqlUpper.includes('COUNT(DISTINCT')) {
                suggestions.push('Consider APPROX_COUNT_DISTINCT for large datasets - faster with minimal accuracy loss');
            }

            // Check for missing date filter
            if (!sqlUpper.includes('DATE') && !sqlUpper.includes('TIMESTAMP') && !sqlUpper.includes('INTERVAL')) {
                issues.push('No date filter detected - may scan entire history');
                suggestions.push('Add date partition filter: WHERE _timestamp > CURRENT_DATE - INTERVAL \'7 days\'');
            }

            // Check for ORDER BY without LIMIT
            if (sqlUpper.includes('ORDER BY') && !sqlUpper.includes('LIMIT')) {
                issues.push('ORDER BY without LIMIT requires sorting entire dataset');
                suggestions.push('Add LIMIT after ORDER BY to improve performance');
            }

            const score = 100 - (issues.length * 20);

            return {
                sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
                performanceScore: Math.max(0, score),
                issueCount: issues.length,
                issues,
                suggestions,
                summary: issues.length === 0
                    ? '✅ Query looks well-optimized!'
                    : `⚠️ Found ${issues.length} potential performance issues`
            };
        }
    },

    // ===== CREATION TOOLS =====
    create_segment: {
        name: 'create_segment',
        description: 'Create a new segment/audience in AEP. Requires name, PQL expression, and optionally merge policy.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name for the segment' },
                description: { type: 'string', description: 'Description of what this segment captures' },
                pql: { type: 'string', description: 'PQL expression defining segment membership criteria' },
                evaluationType: { type: 'string', enum: ['batch', 'streaming'], description: 'Evaluation type (default: batch)' }
            },
            required: ['name', 'pql']
        },
        requiresApproval: true, // Requires approval since it creates resources
        execute: async ({ name, description, pql, evaluationType = 'batch' }) => {
            // Build segment payload
            const segmentPayload = {
                name: name,
                description: description || `Segment created by AI Agent: ${name}`,
                expression: {
                    type: 'PQL',
                    format: 'pql/text',
                    value: pql
                },
                schema: {
                    name: '_xdm.context.profile'
                },
                evaluationType: evaluationType
            };

            // Create the segment via API
            const segment = await segmentService.createSegment(segmentPayload);

            return {
                success: true,
                segmentId: segment?.id,
                name: segment?.name,
                status: segment?.lifecycleState || 'DRAFT',
                pql: pql,
                message: `Segment "${name}" created successfully!`,
                nextSteps: [
                    'The segment will begin evaluation shortly',
                    'View it in the Segments page to monitor qualification',
                    'Enable for destinations when ready'
                ]
            };
        }
    },

    get_tenant_id: {
        name: 'get_tenant_id',
        description: 'Get the tenant ID for the current AEP organization. Needed for building schema references.',
        parameters: { type: 'object', properties: {}, required: [] },
        requiresApproval: false,
        execute: async () => {
            // Get tenant from schemas
            const schemas = await schemaService.listSchemas({ type: 'tenant' }).catch(() => ({ results: [] }));
            const tenantSchema = schemas?.results?.[0];

            // Extract tenant ID from schema $id (format: https://ns.adobe.com/TENANT_ID/schemas/...)
            let tenantId = null;
            if (tenantSchema?.$id) {
                const match = tenantSchema.$id.match(/ns\.adobe\.com\/([^/]+)/);
                tenantId = match ? match[1] : null;
            }

            return {
                tenantId: tenantId || 'unknown',
                note: tenantId
                    ? `Your tenant ID is: ${tenantId}. Use this for building schema references.`
                    : 'Could not determine tenant ID. Check schema registry access.'
            };
        }
    },

    build_segment_payload: {
        name: 'build_segment_payload',
        description: 'Build a complete segment creation payload from natural language description. Analyzes schemas to find correct field paths.',
        parameters: {
            type: 'object',
            properties: {
                audienceDescription: { type: 'string', description: 'Natural language description of the target audience' },
                segmentName: { type: 'string', description: 'Name for the segment' }
            },
            required: ['audienceDescription', 'segmentName']
        },
        requiresApproval: false,
        execute: async ({ audienceDescription, segmentName }) => {
            // Common field mappings
            const fieldMappings = {
                'email': 'personalEmail.address',
                'first name': 'person.name.firstName',
                'last name': 'person.name.lastName',
                'city': 'homeAddress.city',
                'country': 'homeAddress.country',
                'loyalty tier': 'loyalty.tier',
                'loyalty status': 'loyalty.status',
                'purchase': 'commerce.purchases',
                'order': 'commerce.order',
                'cart': 'commerce.cart',
                'age': 'person.birthDate',
                'gender': 'person.gender',
                'phone': 'mobilePhone.number',
                'activity': '_experience.analytics.event1to100',
                'page view': 'web.webPageDetails.pageViews'
            };

            const descLower = audienceDescription.toLowerCase();
            let suggestedPql = '';
            const matchedFields = [];

            // Build PQL based on matched fields
            if (descLower.includes('email')) {
                matchedFields.push('personalEmail.address');
            }
            if (descLower.includes('purchas') || descLower.includes('bought')) {
                matchedFields.push('commerce.purchases');
                if (descLower.includes('last 30 days') || descLower.includes('recent')) {
                    suggestedPql = 'commerce.purchases.value > 0 and commerce.purchases._ts > (now() - duration("P30D"))';
                }
            }
            if (descLower.includes('loyalty') && descLower.includes('gold')) {
                suggestedPql = 'loyalty.tier = "gold"';
            }
            if (descLower.includes('active') || descLower.includes('engaged')) {
                if (descLower.includes('7 days') || descLower.includes('week')) {
                    suggestedPql = 'lastActivityDate > (now() - duration("P7D"))';
                }
            }

            if (!suggestedPql && matchedFields.length > 0) {
                suggestedPql = matchedFields.map(f => `${f} is not null`).join(' and ');
            }

            return {
                segmentName,
                audienceDescription,
                suggestedPql: suggestedPql || 'SELECT * FROM xdm.context.profile WHERE [your_condition]',
                matchedFields,
                payload: {
                    name: segmentName,
                    description: audienceDescription,
                    expression: {
                        type: 'PQL',
                        format: 'pql/text',
                        value: suggestedPql
                    },
                    schema: { name: '_xdm.context.profile' }
                },
                note: suggestedPql
                    ? 'I built a suggested PQL expression. Review it and use create_segment to create.'
                    : 'Could not auto-generate PQL. Please provide more specific criteria.',
                examples: [
                    'Users who purchased in the last 30 days',
                    'Gold loyalty tier members',
                    'Active users in the past week',
                    'Users with both email and phone'
                ]
            };
        }
    },

    // ===== ADVANCED ANALYTICAL TOOLS =====
    list_all_segments_with_counts: {
        name: 'list_all_segments_with_counts',
        description: 'List all segments with their qualified profile counts. Use this to analyze segment populations.',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum segments to return (default 100)' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ limit = 100 }) => {
            // Get all segments
            const segmentsResponse = await segmentService.listSegments({ limit: limit.toString() });
            const segments = segmentsResponse?.segments || [];

            // For each segment, try to get population from the segment data
            // Note: AEP returns population in segment definition or via estimate endpoint
            const segmentsWithCounts = segments.map(seg => ({
                id: seg.id,
                name: seg.name,
                status: seg.lifecycleState || 'unknown',
                evaluationType: seg.expression?.type || 'unknown',
                // Population may be in different fields depending on API version
                profileCount: seg.profileCount || seg.profiles || seg.population ||
                    seg._embedded?.profiles || seg.estimatedSize || 0,
                lastEvaluated: seg.lastEvaluatedTs || seg.lastModifiedAt,
                pql: seg.expression?.value?.substring(0, 100)
            }));

            // Sort by profile count descending
            segmentsWithCounts.sort((a, b) => (b.profileCount || 0) - (a.profileCount || 0));

            const totalProfiles = segmentsWithCounts.reduce((sum, s) => sum + (s.profileCount || 0), 0);
            const withProfiles = segmentsWithCounts.filter(s => (s.profileCount || 0) > 0).length;
            const empty = segmentsWithCounts.filter(s => (s.profileCount || 0) === 0).length;

            return {
                totalSegments: segments.length,
                segmentsWithProfiles: withProfiles,
                emptySegments: empty,
                totalProfilesAcrossSegments: totalProfiles,
                segments: segmentsWithCounts,
                summary: `Found ${segments.length} segments: ${withProfiles} have qualified profiles, ${empty} are empty.`
            };
        }
    },

    analyze_segments_by_population: {
        name: 'analyze_segments_by_population',
        description: 'Filter and analyze segments by profile count. Find segments with more than X profiles, empty segments, or top N segments by size.',
        parameters: {
            type: 'object',
            properties: {
                minProfiles: { type: 'number', description: 'Minimum profile count (e.g., 1 for non-empty, 1000 for large)' },
                maxProfiles: { type: 'number', description: 'Maximum profile count (optional)' },
                topN: { type: 'number', description: 'Return only top N segments by profile count' },
                status: { type: 'string', enum: ['published', 'draft', 'all'], description: 'Filter by segment status (default: all)' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ minProfiles = 0, maxProfiles, topN, status = 'all' }) => {
            // Get segments with pagination (fetch up to 500 for analysis)
            let segments = [];
            let hasMore = true;
            let start = 0;
            const batchSize = 100; // Safe limit
            const maxSegments = 500;

            while (hasMore && segments.length < maxSegments) {
                try {
                    const response = await segmentService.listSegments({
                        limit: batchSize.toString(),
                        start: start.toString()
                    });

                    const batch = response?.segments || [];
                    if (batch.length === 0) {
                        hasMore = false;
                    } else {
                        segments = [...segments, ...batch];
                        start += batchSize;
                        if (batch.length < batchSize) hasMore = false;
                    }
                } catch (e) {
                    console.error('Error fetching segments batch:', e);
                    hasMore = false;
                }
            }

            // Extract and filter segments
            let filtered = segments.map(seg => ({
                id: seg.id,
                name: seg.name,
                status: seg.lifecycleState || 'unknown',
                profileCount: seg.profileCount || seg.profiles || seg.population || 0,
                evaluationType: seg.expression?.type
            }));

            // Apply status filter
            if (status !== 'all') {
                filtered = filtered.filter(s => s.status.toLowerCase() === status.toLowerCase());
            }

            // Apply population filters
            if (minProfiles > 0) {
                filtered = filtered.filter(s => (s.profileCount || 0) >= minProfiles);
            }
            if (maxProfiles !== undefined) {
                filtered = filtered.filter(s => (s.profileCount || 0) <= maxProfiles);
            }

            // Sort by profile count descending
            filtered.sort((a, b) => (b.profileCount || 0) - (a.profileCount || 0));

            // Apply topN limit
            if (topN && topN > 0) {
                filtered = filtered.slice(0, topN);
            }

            return {
                matchingSegments: filtered.length,
                totalSearched: segments.length,
                criteria: {
                    minProfiles,
                    maxProfiles: maxProfiles || 'unlimited',
                    status,
                    topN: topN || 'all matching'
                },
                segments: filtered.slice(0, 50), // Limit response size
                insights: {
                    largestSegment: filtered[0] ? `"${filtered[0].name}" with ${filtered[0].profileCount?.toLocaleString() || 0} profiles` : 'None found',
                    averageSize: filtered.length > 0
                        ? Math.round(filtered.reduce((sum, s) => sum + (s.profileCount || 0), 0) / filtered.length)
                        : 0
                }
            };
        }
    },

    get_segment_population: {
        name: 'get_segment_population',
        description: 'Get the current qualified profile count for a specific segment by ID or name.',
        parameters: {
            type: 'object',
            properties: {
                segmentId: { type: 'string', description: 'Segment ID to check' },
                segmentName: { type: 'string', description: 'Segment name to search for (used if ID not provided)' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ segmentId, segmentName }) => {
            let segment = null;

            if (segmentId) {
                segment = await segmentService.getSegmentDetails(segmentId).catch(() => null);
            } else if (segmentName) {
                // Search for segment by name
                const allSegments = await segmentService.listSegments({ limit: '200' });
                const segments = allSegments?.segments || [];
                segment = segments.find(s =>
                    s.name?.toLowerCase().includes(segmentName.toLowerCase())
                );
                if (segment) {
                    // Get full details
                    segment = await segmentService.getSegmentDetails(segment.id).catch(() => segment);
                }
            }

            if (!segment) {
                return { found: false, error: 'Segment not found. Check the ID or name.' };
            }

            return {
                found: true,
                id: segment.id,
                name: segment.name,
                status: segment.lifecycleState,
                profileCount: segment.profileCount || segment.profiles || segment.population || 0,
                evaluationType: segment.expression?.type,
                lastEvaluated: segment.lastEvaluatedTs,
                pql: segment.expression?.value,
                isQualifying: (segment.profileCount || segment.profiles || 0) > 0
            };
        }
    },

    compare_segment_populations: {
        name: 'compare_segment_populations',
        description: 'Compare populations across multiple segments. Useful for overlap analysis.',
        parameters: {
            type: 'object',
            properties: {
                segmentIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of segment IDs to compare'
                }
            },
            required: ['segmentIds']
        },
        requiresApproval: false,
        execute: async ({ segmentIds }) => {
            const results = [];

            for (const id of segmentIds.slice(0, 10)) { // Limit to 10
                const segment = await segmentService.getSegmentDetails(id).catch(() => null);
                if (segment) {
                    results.push({
                        id: segment.id,
                        name: segment.name,
                        profileCount: segment.profileCount || segment.profiles || 0,
                        status: segment.lifecycleState
                    });
                }
            }

            results.sort((a, b) => (b.profileCount || 0) - (a.profileCount || 0));

            const total = results.reduce((sum, s) => sum + (s.profileCount || 0), 0);

            return {
                comparedSegments: results.length,
                segments: results,
                totalProfilesAcrossAll: total,
                largestByPopulation: results[0]?.name || 'N/A',
                smallestByPopulation: results[results.length - 1]?.name || 'N/A'
            };
        }
    },

    // ===== DATASET TOOLS =====
    get_dataset_details: {
        name: 'get_dataset_details',
        description: 'Get detailed information about a specific dataset by ID, including schema, labels, and configuration.',
        parameters: {
            type: 'object',
            properties: {
                datasetId: { type: 'string', description: 'The dataset ID' }
            },
            required: ['datasetId']
        },
        requiresApproval: false,
        execute: async ({ datasetId }) => {
            const dataset = await datasetService.getDatasetDetails(datasetId);
            return {
                id: datasetId,
                name: dataset[datasetId]?.name || 'Unknown',
                schemaRef: dataset[datasetId]?.schemaRef,
                state: dataset[datasetId]?.state,
                created: dataset[datasetId]?.created,
                profileEnabled: dataset[datasetId]?.tags?.['unifiedProfile']?.[0] === 'enabled',
                identityEnabled: dataset[datasetId]?.tags?.['unifiedIdentity']?.[0] === 'enabled',
                tags: dataset[datasetId]?.tags
            };
        }
    },

    get_dataset_labels: {
        name: 'get_dataset_labels',
        description: 'Get data usage labels (governance labels) applied to a dataset.',
        parameters: {
            type: 'object',
            properties: {
                datasetId: { type: 'string', description: 'The dataset ID' }
            },
            required: ['datasetId']
        },
        requiresApproval: false,
        execute: async ({ datasetId }) => {
            return datasetService.getDatasetLabels(datasetId);
        }
    },

    get_dataset_batches: {
        name: 'get_dataset_batches',
        description: 'Get all batches ingested into a specific dataset.',
        parameters: {
            type: 'object',
            properties: {
                datasetId: { type: 'string', description: 'The dataset ID' },
                status: { type: 'string', enum: ['success', 'failed', 'processing'], description: 'Filter by batch status' },
                limit: { type: 'number', description: 'Maximum batches to return' }
            },
            required: ['datasetId']
        },
        requiresApproval: false,
        execute: async ({ datasetId, status, limit = 50 }) => {
            const batches = await datasetService.getDatasetBatches(datasetId, { status, limit: limit.toString() });
            const batchList = Object.entries(batches || {}).map(([id, b]) => ({
                id,
                status: b.status,
                created: b.created,
                recordCount: b.metrics?.recordCount
            }));
            return { datasetId, batchCount: batchList.length, batches: batchList.slice(0, 20) };
        }
    },

    // ===== DATA FLOW TOOLS =====
    list_data_flows: {
        name: 'list_data_flows',
        description: 'List all data flows (ingestion pipelines) in the current sandbox.',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum flows to return' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ limit = 50 }) => {
            const flows = await flowService.listFlows({ limit: limit.toString() });
            return {
                totalFlows: flows?.items?.length || 0,
                flows: (flows?.items || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    state: f.state,
                    createdAt: f.createdAt
                }))
            };
        }
    },

    get_flow_details: {
        name: 'get_flow_details',
        description: 'Get detailed information about a specific data flow.',
        parameters: {
            type: 'object',
            properties: {
                flowId: { type: 'string', description: 'The flow ID' }
            },
            required: ['flowId']
        },
        requiresApproval: false,
        execute: async ({ flowId }) => {
            return flowService.getFlowDetails(flowId);
        }
    },

    list_flow_runs: {
        name: 'list_flow_runs',
        description: 'List execution runs for data flows. See when flows ran and their status.',
        parameters: {
            type: 'object',
            properties: {
                flowId: { type: 'string', description: 'Filter by specific flow ID (optional)' },
                limit: { type: 'number', description: 'Maximum runs to return' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ flowId, limit = 50 }) => {
            const runs = await flowService.listFlowRuns({ flowId, limit: limit.toString() });
            return {
                totalRuns: runs?.items?.length || 0,
                runs: (runs?.items || []).slice(0, 20).map(r => ({
                    id: r.id,
                    flowId: r.flowId,
                    state: r.state,
                    startedAt: r.startedAt,
                    completedAt: r.completedAt
                }))
            };
        }
    },

    trigger_flow_run: {
        name: 'trigger_flow_run',
        description: 'Manually trigger a data flow to run now.',
        parameters: {
            type: 'object',
            properties: {
                flowId: { type: 'string', description: 'The flow ID to trigger' }
            },
            required: ['flowId']
        },
        requiresApproval: true,
        execute: async ({ flowId }) => {
            const run = await flowService.triggerFlowRun(flowId);
            return { triggered: true, flowId, runId: run?.id, message: 'Flow run triggered successfully' };
        }
    },

    list_connections: {
        name: 'list_connections',
        description: 'List all source/destination connections configured in AEP.',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum connections to return' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ limit = 50 }) => {
            const connections = await flowService.listConnections({ limit: limit.toString() });
            return {
                totalConnections: connections?.items?.length || 0,
                connections: (connections?.items || []).map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.connectionSpec?.name,
                    state: c.state
                }))
            };
        }
    },

    // ===== POLICY & GOVERNANCE TOOLS =====
    list_governance_policies: {
        name: 'list_governance_policies',
        description: 'List all data governance policies (both core and custom).',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['core', 'custom', 'all'], description: 'Policy type filter' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ type = 'all' }) => {
            const results = { core: [], custom: [] };

            if (type === 'all' || type === 'core') {
                const core = await policyService.listCorePolicies().catch(() => ({ children: [] }));
                results.core = core?.children || [];
            }
            if (type === 'all' || type === 'custom') {
                const custom = await policyService.listCustomPolicies().catch(() => ({ children: [] }));
                results.custom = custom?.children || [];
            }

            return {
                corePolicies: results.core.length,
                customPolicies: results.custom.length,
                policies: [...results.core, ...results.custom].map(p => ({
                    name: p.name,
                    description: p.description,
                    status: p.status
                }))
            };
        }
    },

    list_data_labels: {
        name: 'list_data_labels',
        description: 'List all data usage labels (DULE labels) available in the organization.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        },
        requiresApproval: false,
        execute: async () => {
            const [core, custom] = await Promise.all([
                policyService.listCoreLabels().catch(() => ({ children: [] })),
                policyService.listCustomLabels().catch(() => ({ children: [] }))
            ]);

            return {
                coreLabels: (core?.children || []).map(l => ({ name: l.name, category: l.category })),
                customLabels: (custom?.children || []).map(l => ({ name: l.name, category: l.category })),
                totalLabels: (core?.children?.length || 0) + (custom?.children?.length || 0)
            };
        }
    },

    evaluate_policy_violation: {
        name: 'evaluate_policy_violation',
        description: 'Check if a marketing action would violate any policies based on data labels.',
        parameters: {
            type: 'object',
            properties: {
                marketingAction: { type: 'string', description: 'Marketing action name (e.g., "exportToThirdParty")' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Data labels to check against' }
            },
            required: ['marketingAction', 'labels']
        },
        requiresApproval: false,
        execute: async ({ marketingAction, labels }) => {
            const result = await policyService.evaluatePolicyByLabels(marketingAction, labels);
            return {
                marketingAction,
                labels,
                violationDetected: result?.violatedPolicies?.length > 0,
                violatedPolicies: result?.violatedPolicies || [],
                recommendation: result?.violatedPolicies?.length > 0
                    ? 'This action would violate data governance policies. Review the labels or choose different data.'
                    : 'No policy violations detected. This action is permitted.'
            };
        }
    },

    // ===== AUDIT LOG TOOLS =====
    get_audit_logs: {
        name: 'get_audit_logs',
        description: 'Retrieve audit logs for platform activities. Track who did what and when.',
        parameters: {
            type: 'object',
            properties: {
                resource: { type: 'string', description: 'Filter by resource type (e.g., "schema", "dataset", "segment")' },
                action: { type: 'string', description: 'Filter by action (e.g., "create", "update", "delete")' },
                user: { type: 'string', description: 'Filter by user email' },
                limit: { type: 'number', description: 'Maximum logs to return' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ resource, action, user, limit = 50 }) => {
            const logs = await auditService.getAuditLogs({ resource, action, user, limit }).catch(() => ({ children: [] }));
            return {
                totalLogs: logs?.children?.length || 0,
                logs: (logs?.children || []).slice(0, 20).map(l => ({
                    timestamp: l.timestamp,
                    user: l.user,
                    resource: l.resource,
                    action: l.action,
                    status: l.status
                }))
            };
        }
    },

    // ===== OBSERVABILITY TOOLS =====
    get_platform_health: {
        name: 'get_platform_health',
        description: 'Get the current health status of AEP platform services.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        },
        requiresApproval: false,
        execute: async () => {
            const health = await observabilityService.getSystemHealth().catch(() => ({}));
            return {
                overallStatus: health?.status || 'unknown',
                services: health?.services || {},
                lastUpdated: new Date().toISOString()
            };
        }
    },

    get_ingestion_metrics: {
        name: 'get_ingestion_metrics',
        description: 'Get ingestion metrics and throughput statistics.',
        parameters: {
            type: 'object',
            properties: {
                timeRange: { type: 'string', enum: ['1h', '6h', '24h', '7d'], description: 'Time range for metrics' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ timeRange = '24h' }) => {
            const metrics = await observabilityService.getIngestionMetrics({ timeRange }).catch(() => ({}));
            return {
                timeRange,
                ...metrics,
                summary: `Ingestion metrics for the last ${timeRange}`
            };
        }
    },

    // ===== ADVANCED VERIFICATION TOOLS =====
    // ===== ADVANCED VERIFICATION TOOLS =====
    verify_segment_count: {
        name: 'verify_segment_count',
        description: 'Verify the "True Count" of a segment by running a SQL query against the profile snapshot in the Data Lake.',
        parameters: {
            type: 'object',
            properties: {
                segmentId: { type: 'string', description: 'The Segment ID to verify' },
                snapshotDatasetName: { type: 'string', description: 'Name of the Profile Snapshot dataset (optional)' }
            },
            required: ['segmentId']
        },
        requiresApproval: false,
        execute: async ({ segmentId, snapshotDatasetName = 'Profile Snapshot Export' }) => {
            const segment = await segmentService.getSegmentDetails(segmentId);
            if (!segment) throw new Error(`Segment ${segmentId} not found`);

            const datasets = await datasetService.listDatasets({ name: snapshotDatasetName, limit: '5' });
            const foundIds = Object.keys(datasets || {});

            let snapshotId = foundIds[0];
            if (!snapshotId) {
                return { error: `Could not find a dataset named "${snapshotDatasetName}".` };
            }

            const tableName = snapshotId;
            const sql = `SELECT count(1) as actual_count FROM "${tableName}" WHERE segmentMembership.ups."${segmentId}".status = 'existing'`;

            const queryRun = await queryService.createQuery({
                dbName: 'prod:all',
                sql: sql,
                name: `Agent Verification: ${segment.name}`
            });

            return {
                analysisType: 'True Count Verification',
                segment: {
                    id: segmentId,
                    name: segment.name,
                    estimatedCount: segment.profileCount || segment.profiles || 0
                },
                verification: {
                    status: 'IN_PROGRESS',
                    queryId: queryRun.id,
                    sqlUsed: sql,
                    dataSource: tableName,
                    note: 'Query submitted. Check Query Service for results.'
                }
            };
        }
    },

    get_profile_preview_status: {
        name: 'get_profile_preview_status',
        description: 'Get a quick preview of the total profile count and system sample status.',
        parameters: { type: 'object', properties: {}, required: [] },
        requiresApproval: false,
        execute: async () => {
            const preview = await profileService.getProfilePreview();
            return {
                totalProfileCount: preview?.totalRows || 0,
                lastUpdated: preview?.lastSuccessfulSampleTimestamp,
                sampleSize: preview?.sampleSize
            };
        }
    },

    get_profile_distribution: {
        name: 'get_profile_distribution',
        description: 'Get the breakdown of profiles by Dataset or Identity Namespace.',
        parameters: {
            type: 'object',
            properties: {
                dimension: { type: 'string', enum: ['dataset', 'namespace'], description: 'Dimension to group by' }
            },
            required: ['dimension']
        },
        requiresApproval: false,
        execute: async ({ dimension }) => {
            const data = dimension === 'dataset'
                ? await profileService.getProfilesByDataset()
                : await profileService.getProfilesByNamespace();

            const distribution = Object.entries(data || {}).map(([key, value]) => ({
                id: key,
                count: value
            })).sort((a, b) => b.count - a.count);

            return {
                dimension,
                totalGroups: distribution.length,
                top10: distribution.slice(0, 10)
            };
        }
    },

    check_orphaned_profiles: {
        name: 'check_orphaned_profiles',
        description: 'Identify profiles with no recent activity (orphans) using SQL analysis.',
        parameters: {
            type: 'object',
            properties: {
                monthsInactive: { type: 'number', description: 'Number of months of inactivity (default 3)' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async ({ monthsInactive = 3 }) => {
            const datasets = await datasetService.listDatasets({ name: 'Profile Snapshot Export', limit: '1' });
            const snapshotId = Object.keys(datasets || {})[0];

            if (!snapshotId) return { error: 'Profile Snapshot dataset not found.' };

            const tableName = snapshotId;
            const days = monthsInactive * 30;
            const sql = `SELECT count(1) as orphan_count FROM "${tableName}" WHERE timestamp < date_sub(current_date(), ${days})`;

            const queryRun = await queryService.createQuery({
                dbName: 'prod:all',
                sql: sql,
                name: `Agent: Orphan Check (> ${days} days)`
            });

            return {
                analysis: 'Orphaned Profile Check',
                thresholdDays: days,
                status: 'Query Submitted',
                queryId: queryRun.id,
                sql: sql
            };
        }
    },

    build_data_dictionary: {
        name: 'build_data_dictionary',
        description: 'Generate a flattened Data Dictionary from XDM schemas for AI context.',
        parameters: {
            type: 'object',
            properties: {
                sandboxName: { type: 'string' }
            },
            required: []
        },
        requiresApproval: false,
        execute: async () => {
            const context = await schemaService.extractUnionSchemaForAI();
            const flattenProperties = (props, prefix = '') => {
                let items = [];
                for (const [key, value] of Object.entries(props)) {
                    const path = prefix ? `${prefix}.${key}` : key;
                    items.push({
                        path: path,
                        type: value.type || 'string',
                        title: value.title || key,
                        description: value.description || 'No description available',
                        sql_column: path.replace(/./g, '_')
                    });
                    if (value.properties) {
                        items = items.concat(flattenProperties(value.properties, path));
                    }
                }
                return items;
            };

            const dictionaries = context.schemas.map(schema => ({
                schemaId: schema.id,
                title: schema.title,
                fieldCount: Object.keys(schema.properties).length,
                dictionary: flattenProperties(schema.properties)
            }));

            return {
                generatedAt: new Date().toISOString(),
                totalSchemas: dictionaries.length,
                dictionaries: dictionaries
            };
        }
    },

    // ===== SPECIALIZED AGENT TOOLS =====

    /**
     * Identity Graph Doctor - Diagnose why identities aren't linked
     */
    diagnose_identity_link: {
        name: 'diagnose_identity_link',
        description: 'Diagnose why two identities are not linked in the identity graph. Checks namespace priorities, shared devices, and graph connections.',
        parameters: {
            type: 'object',
            properties: {
                namespace1: { type: 'string', description: 'First identity namespace (e.g., Email, ECID)' },
                identity1: { type: 'string', description: 'First identity value' },
                namespace2: { type: 'string', description: 'Second identity namespace' },
                identity2: { type: 'string', description: 'Second identity value' }
            },
            required: ['namespace1', 'identity1', 'namespace2', 'identity2']
        },
        requiresApproval: false,
        execute: async ({ namespace1, identity1, namespace2, identity2 }) => {
            const diagnosis = {
                analysis: 'Identity Link Diagnosis',
                identities: [
                    { namespace: namespace1, value: identity1 },
                    { namespace: namespace2, value: identity2 }
                ],
                checks: []
            };

            try {
                // 1. Get XID for both identities
                const [xid1, xid2] = await Promise.all([
                    identityService.getIdentityXID(namespace1, identity1).catch(() => null),
                    identityService.getIdentityXID(namespace2, identity2).catch(() => null)
                ]);

                diagnosis.checks.push({
                    check: 'XID Resolution',
                    identity1_xid: xid1?.xid || 'NOT_FOUND',
                    identity2_xid: xid2?.xid || 'NOT_FOUND',
                    status: xid1?.xid && xid2?.xid ? 'PASS' : 'FAIL'
                });

                if (!xid1?.xid || !xid2?.xid) {
                    diagnosis.conclusion = 'One or both identities do not exist in the identity graph.';
                    diagnosis.recommendation = 'Ensure both identities have been ingested with proper namespace configuration.';
                    return diagnosis;
                }

                // 2. Get cluster members for first identity
                const cluster1 = await identityService.getClusterMembers(xid1.xid).catch(() => null);
                const clusterXids = cluster1?.map(m => m.xid) || [];
                const areLinked = clusterXids.includes(xid2.xid);

                diagnosis.checks.push({
                    check: 'Cluster Membership',
                    cluster_size: clusterXids.length,
                    identities_linked: areLinked,
                    status: areLinked ? 'LINKED' : 'NOT_LINKED'
                });

                // 3. Check namespace priorities
                const namespaces = await identityService.listNamespaces().catch(() => []);
                const ns1Priority = namespaces.find(n => n.code === namespace1)?.idType;
                const ns2Priority = namespaces.find(n => n.code === namespace2)?.idType;

                diagnosis.checks.push({
                    check: 'Namespace Configuration',
                    namespace1_type: ns1Priority || 'UNKNOWN',
                    namespace2_type: ns2Priority || 'UNKNOWN',
                    note: 'Cookie/Device IDs may not directly link to Person IDs without cross-device data'
                });

                if (!areLinked) {
                    diagnosis.conclusion = 'Identities exist but are NOT in the same cluster.';
                    diagnosis.possibleReasons = [
                        'No cross-device or cross-channel event linking them',
                        'Different merge policy configurations',
                        'Identity graph algorithm separated them (e.g., shared device detection)',
                        'Data not yet propagated (identity stitching is near-real-time)'
                    ];
                    diagnosis.recommendation = 'Ingest an event containing both identities to create a link.';
                } else {
                    diagnosis.conclusion = 'Identities ARE linked in the same cluster.';
                    diagnosis.recommendation = 'Both identities will resolve to the same unified profile.';
                }

                return diagnosis;
            } catch (error) {
                diagnosis.error = error.message;
                return diagnosis;
            }
        }
    },

    /**
     * Segment Debugger - Diagnose why a segment has 0 or unexpected count
     */
    debug_segment: {
        name: 'debug_segment',
        description: 'Debug why a segment has 0 profiles or unexpected count. Analyzes PQL expression, merge policy, and tests against sample profiles.',
        parameters: {
            type: 'object',
            properties: {
                segmentId: { type: 'string', description: 'The segment ID to debug' }
            },
            required: ['segmentId']
        },
        requiresApproval: false,
        execute: async ({ segmentId }) => {
            const debug = {
                analysis: 'Segment Debug Report',
                segmentId,
                checks: []
            };

            try {
                // 1. Get segment details
                const segment = await segmentService.getSegmentDetails(segmentId);
                debug.segmentName = segment.name;
                debug.expression = segment.expression?.value || segment.pql?.expression;
                debug.mergePolicyId = segment.mergePolicyId;

                // 2. Get estimate
                const estimate = await segmentService.estimateSegment(segmentId).catch(() => null);
                debug.checks.push({
                    check: 'Current Estimate',
                    estimatedSize: estimate?.data?.totalRows || 0,
                    lastUpdated: estimate?.data?.lastSampledTimestamp,
                    status: (estimate?.data?.totalRows || 0) > 0 ? 'HAS_PROFILES' : 'EMPTY'
                });

                // 3. Parse PQL for common issues
                const pql = debug.expression || '';
                const pqlIssues = [];

                if (pql.includes('=') && !pql.includes('==')) {
                    pqlIssues.push('Uses single = instead of == for comparison');
                }
                if (pql.match(/\.size\s*>/)) {
                    pqlIssues.push('Uses .size > which requires array field');
                }
                if (pql.includes('null') && !pql.includes('!= null')) {
                    pqlIssues.push('Null check may exclude profiles without the attribute');
                }
                if (pql.match(/\.(Email|email)\s*=/)) {
                    pqlIssues.push('Direct email comparison may be case-sensitive');
                }

                debug.checks.push({
                    check: 'PQL Syntax Analysis',
                    issues: pqlIssues.length > 0 ? pqlIssues : ['No obvious syntax issues detected'],
                    status: pqlIssues.length > 0 ? 'POTENTIAL_ISSUES' : 'OK'
                });

                // 4. Check merge policy
                if (segment.mergePolicyId) {
                    const policy = await profileService.getMergePolicyDetails(segment.mergePolicyId).catch(() => null);
                    debug.checks.push({
                        check: 'Merge Policy',
                        policyName: policy?.name || 'UNKNOWN',
                        attributeMerge: policy?.attributeMerge?.type,
                        identityGraph: policy?.identityGraph?.type,
                        status: policy ? 'CONFIGURED' : 'NOT_FOUND'
                    });
                }

                // 5. Check if streaming or batch
                debug.checks.push({
                    check: 'Evaluation Type',
                    evaluationType: segment.evaluationInfo?.evaluationType || 'UNKNOWN',
                    note: segment.evaluationInfo?.evaluationType === 'streaming'
                        ? 'Streaming segments update in near real-time'
                        : 'Batch segments update on schedule only'
                });

                // Conclusion
                const emptyReasons = [];
                if ((estimate?.data?.totalRows || 0) === 0) {
                    emptyReasons.push('No profiles match the current PQL expression');
                    if (pqlIssues.length > 0) emptyReasons.push('PQL syntax may have issues');
                    emptyReasons.push('Merge policy may exclude relevant profiles');
                    emptyReasons.push('Data may not have been ingested yet');
                }

                debug.conclusion = emptyReasons.length > 0
                    ? `Segment appears empty. Possible reasons: ${emptyReasons.join('; ')}`
                    : `Segment has ${estimate?.data?.totalRows || 0} profiles`;

                return debug;
            } catch (error) {
                debug.error = error.message;
                return debug;
            }
        }
    },

    /**
     * SQL Generator - Generate SQL from natural language
     */
    generate_sql: {
        name: 'generate_sql',
        description: 'Generate a SQL query from natural language description. Uses available table metadata to construct valid queries.',
        parameters: {
            type: 'object',
            properties: {
                description: { type: 'string', description: 'Natural language description of the query' },
                tables: { type: 'array', items: { type: 'string' }, description: 'Optional list of table names to use' }
            },
            required: ['description']
        },
        requiresApproval: false,
        execute: async ({ description, tables = [] }) => {
            // This is a helper that provides context for the LLM to generate SQL
            // The actual generation happens in the LLM response
            const result = {
                analysis: 'SQL Generation Context',
                request: description,
                availableTables: [],
                suggestedQuery: null
            };

            try {
                // Get available datasets/tables
                const datasets = await datasetService.listAllDatasets().catch(() => []);
                result.availableTables = Object.keys(datasets).slice(0, 20).map(id => ({
                    id,
                    name: datasets[id].name,
                    schemaRef: datasets[id].schemaRef?.$id?.split('/').pop()
                }));

                // Simple pattern matching for common queries
                const desc = description.toLowerCase();

                if (desc.includes('count') && desc.includes('profile')) {
                    result.suggestedQuery = 'SELECT count(1) as profile_count FROM your_profile_snapshot_table';
                    result.note = 'Replace table name with actual Profile Snapshot Export dataset';
                } else if (desc.includes('top') && (desc.includes('city') || desc.includes('country'))) {
                    result.suggestedQuery = `SELECT address.city, count(1) as count FROM your_table GROUP BY address.city ORDER BY count DESC LIMIT 10`;
                } else if (desc.includes('segment') && desc.includes('member')) {
                    result.suggestedQuery = `SELECT count(1) FROM your_table WHERE segmentMembership.ups."YOUR_SEGMENT_ID".status = 'existing'`;
                } else {
                    result.suggestedQuery = `-- Query for: ${description}\n-- Please specify table name and columns`;
                }

                result.recommendation = 'Use the Query Service to execute. Replace placeholder table names with actual dataset IDs.';
                return result;
            } catch (error) {
                result.error = error.message;
                return result;
            }
        }
    },

    /**
     * Batch Error Analyzer - Deep analysis of batch ingestion errors
     */
    analyze_batch_errors: {
        name: 'analyze_batch_errors',
        description: 'Perform deep analysis of batch ingestion errors. Downloads error details and provides human-readable diagnosis.',
        parameters: {
            type: 'object',
            properties: {
                batchId: { type: 'string', description: 'The failed batch ID to analyze' }
            },
            required: ['batchId']
        },
        requiresApproval: false,
        execute: async ({ batchId }) => {
            const analysis = {
                analysis: 'Batch Error Forensics',
                batchId,
                findings: []
            };

            try {
                // Get batch details
                const batch = await batchService.getBatchDetails(batchId);
                analysis.status = batch.status;
                analysis.datasetId = batch.datasetId;
                analysis.created = batch.created;

                if (batch.status !== 'failed' && batch.status !== 'retrying') {
                    analysis.conclusion = `Batch is not in failed state. Current status: ${batch.status}`;
                    return analysis;
                }

                // Get error details
                const [meta, errors] = await Promise.all([
                    batchService.getBatchMeta(batchId).catch(() => null),
                    batchService.getFailedRecords(batchId).catch(() => ({ data: [] }))
                ]);

                // Analyze errors
                if (meta?.errors?.length > 0) {
                    const errorTypes = {};
                    meta.errors.forEach(e => {
                        const type = e.code || e.type || 'UNKNOWN';
                        errorTypes[type] = (errorTypes[type] || 0) + 1;
                    });

                    analysis.findings.push({
                        finding: 'Error Distribution',
                        types: errorTypes,
                        totalErrors: meta.errors.length
                    });
                }

                // Common error patterns
                const errorMessages = (meta?.errors || []).map(e => e.message || e.description || '').join(' ');

                if (errorMessages.includes('schema') || errorMessages.includes('Schema')) {
                    analysis.findings.push({
                        finding: 'Schema Mismatch Detected',
                        recommendation: 'Verify data structure matches XDM schema. Check field names and types.'
                    });
                }

                if (errorMessages.includes('required') || errorMessages.includes('null')) {
                    analysis.findings.push({
                        finding: 'Required Field Missing',
                        recommendation: 'Check that all required fields have values. Look for null in identity fields.'
                    });
                }

                if (errorMessages.includes('type') || errorMessages.includes('Type')) {
                    analysis.findings.push({
                        finding: 'Type Conversion Error',
                        recommendation: 'Data types don\'t match schema. Common: string "true" vs boolean true, string numbers vs integers.'
                    });
                }

                // Get dataset schema for context
                if (batch.datasetId) {
                    const dataset = await datasetService.getDatasetDetails(batch.datasetId).catch(() => null);
                    if (dataset?.schemaRef) {
                        analysis.schemaRef = dataset.schemaRef.$id;
                    }
                }

                analysis.conclusion = analysis.findings.length > 0
                    ? `Found ${analysis.findings.length} issue(s). See findings for details.`
                    : 'No specific errors identified. Check batch metadata in AEP console.';

                return analysis;
            } catch (error) {
                analysis.error = error.message;
                return analysis;
            }
        }
    }
};

/**
 * Get all tool definitions for Azure OpenAI function calling
 */
export function getToolDefinitions() {
    return Object.values(tools).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }));
}

/**
 * Get list of tool names and descriptions for display
 */
export function getToolList() {
    return Object.values(tools).map(tool => ({
        name: tool.name,
        description: tool.description,
        requiresApproval: tool.requiresApproval
    }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(toolName, args) {
    const tool = tools[toolName];
    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
    }
    return tool.execute(args);
}

/**
 * Check if a tool requires approval
 */
export function requiresApproval(toolName) {
    const tool = tools[toolName];
    return tool?.requiresApproval || false;
}
