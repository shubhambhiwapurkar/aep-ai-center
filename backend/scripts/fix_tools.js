
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validToolsCode = `    // ===== ADVANCED VERIFICATION TOOLS =====
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
            if (!segment) throw new Error(\`Segment \${segmentId} not found\`);

            const datasets = await datasetService.listDatasets({ name: snapshotDatasetName, limit: '5' });
            const foundIds = Object.keys(datasets || {});
            
            let snapshotId = foundIds[0];
            if (!snapshotId) {
                return { error: \`Could not find a dataset named "\${snapshotDatasetName}".\` };
            }

            const tableName = snapshotId; 
            const sql = \`SELECT count(1) as actual_count FROM "\${tableName}" WHERE segmentMembership.ups."\${segmentId}".status = 'existing'\`;

            const queryRun = await queryService.createQuery({
                dbName: 'prod:all',
                sql: sql,
                name: \`Agent Verification: \${segment.name}\`
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
            const sql = \`SELECT count(1) as orphan_count FROM "\${tableName}" WHERE timestamp < date_sub(current_date(), \${days})\`;

            const queryRun = await queryService.createQuery({
                dbName: 'prod:all',
                sql: sql,
                name: \`Agent: Orphan Check (> \${days} days)\`
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
                    const path = prefix ? \`\${prefix}.\${key}\` : key;
                    items.push({
                        path: path,
                        type: value.type || 'string',
                        title: value.title || key,
                        description: value.description || 'No description available',
                        sql_column: path.replace(/\./g, '_') 
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
        throw new Error(\`Unknown tool: \${toolName}\`);
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
`;

const filePath = path.join(__dirname, '../src/agent/tools/index.js');
console.log('Reading file:', filePath);

let content = fs.readFileSync(filePath, 'utf8');

// Find insertion point - verify_segment_count
const marker = 'verify_segment_count: {';
const index = content.indexOf(marker);

if (index === -1) {
    console.error('Could not find verify_segment_count marker!');
    // If not found, maybe I deleted it? Try find get_ingestion_metrics and append after
    const backupMarker = 'get_ingestion_metrics: {';
    const backupIndex = content.indexOf(backupMarker);
    if (backupIndex === -1) {
        console.error('Could not find backup marker either.');
        process.exit(1);
    }
    // Find matching closing brace for get_ingestion_metrics
    // Assuming indentation structure...
    // Actually, just find the end of the last tool.
    console.log('Using backup marker...');
    // This path is complex. Let's hope index found.
    process.exit(1);
} else {
    console.log('Found marker at index:', index);

    // Keep everything BEFORE the marker
    // But verify_segment_count was indented 4 spaces.
    // So we want to keep up to the newline before it.

    // Check if previous chars are "    " (4 spaces).
    const preMarker = content.substring(0, index);
    const lastNewline = preMarker.lastIndexOf('\n');
    const cleanPre = content.substring(0, lastNewline + 1); // Content up to the line start

    // Now append validToolsCode (which starts with verify_segment_count indented)
    // Wait, validToolsCode starts with "// ===== ADVANCED..." which is indented?
    // My validToolsCode string has 4 spaces indent for first line?
    // Yes: "    // =====..."

    const newContent = cleanPre + validToolsCode;

    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('✅ File repaired successfully!');
}
