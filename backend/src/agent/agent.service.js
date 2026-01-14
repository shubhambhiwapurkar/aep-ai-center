/**
 * AI Agent Service - Enhanced Version
 * Main orchestration layer for the AI Agent
 * Features: LLM-powered result summarization, creation capabilities, autonomous workflows
 */
import * as llm from './llm.service.js';
import * as toolRegistry from './tools/index.js';
import * as schemaService from '../services/schema.service.js';

// In-memory chat history (per session)
let chatHistory = [];

// Cached schema context for AI
let schemaContext = null;
let schemaContextLoaded = false;

/**
 * Load schema context for AI (field paths, common fields)
 */
async function loadSchemaContext() {
    if (schemaContextLoaded) return schemaContext;

    try {
        console.log('[Agent] Loading schema context for AI...');
        const dictionary = await schemaService.generateDataDictionary();

        // Extract common profile fields for context
        const commonPatterns = ['email', 'gender', 'birthDate', 'age', 'firstName', 'lastName', 'phone', 'address', 'city', 'country', 'loyalty', 'status', 'tier'];
        const commonFields = dictionary?.fields?.filter(f =>
            commonPatterns.some(p => f.path?.toLowerCase().includes(p.toLowerCase()))
        ).slice(0, 30) || [];

        schemaContext = {
            totalSchemas: dictionary?.totalSchemas || 0,
            totalFields: dictionary?.fields?.length || 0,
            commonFields: commonFields.map(f => ({
                path: f.path,
                type: f.type,
                title: f.title,
                enum: f.enum?.slice(0, 5)
            }))
        };

        schemaContextLoaded = true;
        console.log(`[Agent] Schema context loaded: ${schemaContext.totalFields} fields, ${schemaContext.commonFields.length} common fields`);
        return schemaContext;
    } catch (e) {
        console.error('[Agent] Failed to load schema context:', e.message);
        return null;
    }
}

// Initialize schema context on module load
loadSchemaContext().catch(console.error);

// Union Profile Schema context (for PQL queries)
let profileSchemaContext = null;

/**
 * Load Union Profile Schema context for PQL (loaded separately)
 */
async function loadProfileSchemaContext() {
    if (profileSchemaContext) return profileSchemaContext;

    try {
        console.log('[Agent] Loading union profile schema for PQL...');
        profileSchemaContext = await schemaService.getUnionProfileSchemaForPQL();
        console.log(`[Agent] Profile schema loaded: ${profileSchemaContext?.totalFields || 0} fields, ${profileSchemaContext?.commonAttributes?.length || 0} common attributes`);
        return profileSchemaContext;
    } catch (e) {
        console.error('[Agent] Failed to load profile schema:', e.message);
        return null;
    }
}

// Load profile schema context after general context
loadProfileSchemaContext().catch(console.error);

// Build dynamic system prompt with schema context
function buildSystemPrompt() {
    let schemaSection = '';
    let pqlSection = '';

    // General schema fields
    if (schemaContext && schemaContext.commonFields.length > 0) {
        const fieldList = schemaContext.commonFields.map(f =>
            `- ${f.path} (${f.type})${f.enum ? ` [values: ${f.enum.join(', ')}]` : ''}`
        ).join('\n');

        schemaSection = `
AVAILABLE SCHEMA FIELDS (Common Profile Attributes):
${fieldList}
`;
    }

    // PQL-specific profile schema fields
    if (profileSchemaContext && profileSchemaContext.commonAttributes?.length > 0) {
        const pqlFields = profileSchemaContext.commonAttributes.map(f =>
            `- ${f.path} (${f.type}): ${f.title || ''}`
        ).join('\n');

        pqlSection = `
PROFILE STORE ATTRIBUTES (for PQL queries):
${pqlFields}

When generating PQL expressions, use these EXACT profile field paths. Example:
- person.name.firstName
- personalEmail.address
- loyaltyDetails.level
`;
    }

    return `You are an expert AI assistant for Adobe Experience Platform (AEP). You help users explore, analyze, AND create/manage their AEP resources.

CAPABILITIES:
- Query and analyze batch ingestion status and errors
- Search, explore, and explain schemas
- Look up profiles by identity
- Execute SQL queries against AEP Data Lake
- View, debug, and CREATE segments/audiences
- Analyze identity graphs and detect issues
- Diagnose ingestion failures with root cause analysis
- Generate PQL expressions from natural language
- Generate SQL queries from natural language
${schemaSection}${pqlSection}
AUTONOMOUS BEHAVIOR:
1. When asked to create something (segment, query, etc.), gather all needed info first
2. Search for relevant schemas, namespaces, and reference data
3. Build the proper payload/syntax
4. Explain what you're creating before doing it
5. If something fails, diagnose and suggest fixes

RESPONSE STYLE:
- NEVER show raw JSON to users - always summarize and explain
- Use natural language to explain data and results
- Highlight key insights, anomalies, or concerns
- Suggest next steps or related actions
- Use emojis sparingly for visual cues
- Format with markdown: bullets, bold, code blocks when helpful

GUIDELINES:
1. Be conversational and helpful
2. Summarize data in plain English with key metrics
3. When showing counts/stats, explain what they mean
4. If there are issues, explain the likely cause
5. Offer to dig deeper or take related actions
6. If creating something, explain the structure you'll use

RESTRICTIONS:
- You CANNOT delete any resources
- Write operations require user approval (unless auto-mode)

Remember: You are an expert. Explain things like a helpful colleague, not a machine.`;
}

// Summarization prompt for tool results
const SUMMARIZATION_PROMPT = `You are an AI assistant that explains AEP data clearly. Given the following tool result, provide a natural language summary.

RULES:
1. DO NOT show raw JSON - summarize the key information
2. Use conversational language
3. Highlight important numbers, status, or concerns
4. If there are issues/failures, explain what they mean
5. Suggest next steps if relevant
6. Keep it concise but informative
7. Use markdown formatting (bullets, bold) for clarity

TOOL: {toolName}
RAW RESULT:
{result}

Provide a helpful summary:`;

/**
 * Process a message from the user
 */
export async function processMessage({ message, autoMode = false, history = [], approvedAction = null }) {
    // Handle approved action execution
    if (approvedAction) {
        return executeApprovedAction(approvedAction);
    }

    // Update chat history
    chatHistory = history.slice(-20);

    // Build messages array for LLM
    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        ...chatHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
    ];

    // Get tool definitions
    const tools = toolRegistry.getToolDefinitions();

    try {
        // Check if LLM is configured
        if (!llm.isConfigured()) {
            return handleWithRules(message);
        }

        // Call Gemini
        const response = await llm.chatCompletion(messages, tools, {
            temperature: 0.7,
            maxTokens: 4096
        });

        // Check for tool calls
        const toolCalls = llm.parseToolCalls(response);

        if (toolCalls && toolCalls.length > 0) {
            // Process tool calls with LLM summarization
            return handleToolCalls(toolCalls, autoMode, message);
        }

        // Return plain text response
        return {
            content: llm.getContent(response),
            toolsUsed: []
        };

    } catch (error) {
        console.error('Agent error:', error);

        // If LLM fails, try rule-based
        if (error.message) {
            return handleWithRules(message);
        }

        throw error;
    }
}

/**
 * Handle tool calls from the LLM with intelligent summarization
 */
async function handleToolCalls(toolCalls, autoMode, originalMessage) {
    const results = [];
    const toolsUsed = [];
    let requiresApproval = false;
    let pendingTool = null;

    for (const call of toolCalls) {
        toolsUsed.push(call.name);

        // Check if this tool requires approval
        if (toolRegistry.requiresApproval(call.name) && !autoMode) {
            requiresApproval = true;
            pendingTool = call;
            break;
        }

        try {
            const result = await toolRegistry.executeTool(call.name, call.arguments);
            results.push({ tool: call.name, data: result, args: call.arguments });
        } catch (error) {
            results.push({ tool: call.name, error: error.message });
        }
    }

    // If requires approval, return pending action
    if (requiresApproval && pendingTool) {
        return {
            requiresApproval: true,
            toolName: pendingTool.name,
            toolArguments: pendingTool.arguments,
            actionDescription: getActionDescription(pendingTool.name, pendingTool.arguments)
        };
    }

    // Use LLM to summarize results intelligently
    return summarizeResultsWithLLM(results, toolsUsed, originalMessage);
}

/**
 * Use LLM to create a natural language summary of tool results
 */
async function summarizeResultsWithLLM(results, toolsUsed, originalMessage) {
    // If LLM not configured, use basic formatting
    if (!llm.isConfigured()) {
        return formatResultsBasic(results, toolsUsed);
    }

    try {
        // Build context for summarization
        let resultContext = '';
        for (const result of results) {
            if (result.error) {
                resultContext += `\nTool ${result.tool} failed: ${result.error}\n`;
            } else {
                // Truncate very large results
                const dataStr = JSON.stringify(result.data, null, 2);
                const truncated = dataStr.length > 3000 ? dataStr.substring(0, 3000) + '...' : dataStr;
                resultContext += `\n=== ${result.tool} Result ===\n${truncated}\n`;
            }
        }

        // Ask LLM to summarize
        const summaryMessages = [
            {
                role: 'system',
                content: `You are an expert at explaining Adobe Experience Platform data. Summarize tool results in clear, natural language. Never show raw JSON. Focus on key insights and actionable information. Be conversational but concise. Use markdown formatting.`
            },
            {
                role: 'user',
                content: `The user asked: "${originalMessage}"

The following tools were called and returned data:

${resultContext}

Provide a helpful, natural language response that answers the user's question. Highlight key metrics, any issues found, and suggest next steps if relevant. Do NOT show raw JSON - explain the data in plain English.`
            }
        ];

        const summaryResponse = await llm.chatCompletion(summaryMessages, null, {
            temperature: 0.5,
            maxTokens: 1024
        });

        const summary = llm.getContent(summaryResponse);

        return {
            content: summary || formatResultsBasic(results, toolsUsed).content,
            data: results.length === 1 ? results[0].data : results.map(r => r.data),
            toolsUsed
        };

    } catch (error) {
        console.error('Summarization failed, using basic format:', error);
        return formatResultsBasic(results, toolsUsed);
    }
}

/**
 * Basic result formatting (fallback)
 */
function formatResultsBasic(results, toolsUsed) {
    let content = '';
    let data = null;

    for (const result of results) {
        if (result.error) {
            content += `⚠️ ${result.tool} failed: ${result.error}\n\n`;
        } else {
            content += formatToolResult(result.tool, result.data);
            data = result.data;
        }
    }

    return { content, data, toolsUsed };
}

/**
 * Execute an approved action
 */
async function executeApprovedAction(action) {
    try {
        const result = await toolRegistry.executeTool(action.toolName, action.toolArguments);
        return summarizeResultsWithLLM(
            [{ tool: action.toolName, data: result }],
            [action.toolName],
            `Execute ${action.toolName}`
        );
    } catch (error) {
        return {
            content: `❌ Error executing ${action.toolName}: ${error.message}`,
            toolsUsed: [action.toolName]
        };
    }
}

/**
 * Format a single tool result (basic, used as fallback)
 */
function formatToolResult(toolName, data) {
    switch (toolName) {
        case 'get_failed_batches':
            const batches = data?.batches || [];
            if (batches.length === 0) {
                return '✅ **Great news!** No failed batches found. Your ingestion is running smoothly!\n';
            }
            let msg = `📊 I found **${batches.length} failed batches** that need attention:\n\n`;
            batches.slice(0, 5).forEach((b, i) => {
                msg += `${i + 1}. Batch \`${b.id?.substring(0, 12)}...\` - Failed at ${new Date(b.created).toLocaleString()}\n`;
            });
            if (batches.length > 5) {
                msg += `\n...and ${batches.length - 5} more. Would you like me to analyze any specific batch?\n`;
            }
            return msg;

        case 'get_segment_stats':
            const total = data?.total || data?.totalSegments || 0;
            const published = data?.byState?.published || data?.published || 0;
            const draft = data?.byState?.draft || data?.draft || 0;
            return `🎯 **Segment Overview:**\n` +
                `• **${total}** total segments in this sandbox\n` +
                `• **${published}** are published and active\n` +
                `• **${draft}** are in draft status\n\n` +
                `Would you like me to show specific segments or help create a new one?\n`;

        case 'analyze_batch_errors':
            const totalErrors = data?.totalErrors || 0;
            const topError = data?.topError;
            if (totalErrors === 0) {
                return '✅ No errors found in this batch.\n';
            }
            let errMsg = `🔬 **Error Analysis for batch ${data?.batchId?.substring(0, 12)}...**\n\n`;
            errMsg += `Found **${totalErrors} errors** total.\n\n`;
            if (topError) {
                errMsg += `**Most common issue:** \`${topError.errorCode}\` (${topError.percentage}% of errors)\n`;
                errMsg += `This typically means: ${data?.recommendation || 'Check the source data format.'}\n`;
            }
            return errMsg;

        case 'get_identity_graph':
            const members = data?.members || [];
            let graphMsg = `🔗 **Identity Graph for ${data?.inputIdentity?.namespace}:${data?.inputIdentity?.identity?.substring(0, 15)}...**\n\n`;
            graphMsg += `This identity is linked to **${members.length} other identities**:\n`;
            if (data?.isSharedDevice) {
                graphMsg += `\n⚠️ **Warning:** Large cluster detected - this might be a shared device!\n`;
            }
            return graphMsg;

        default:
            // For unhandled tools, create a simple summary
            if (typeof data === 'object' && data !== null) {
                const keys = Object.keys(data);
                if (keys.length <= 5) {
                    let summary = `📦 **${toolName} completed:**\n`;
                    for (const key of keys.slice(0, 5)) {
                        const val = data[key];
                        if (typeof val !== 'object') {
                            summary += `• ${key}: ${val}\n`;
                        }
                    }
                    return summary;
                }
            }
            return `✅ **${toolName}** completed successfully.\n`;
    }
}

/**
 * Get human-readable description of an action
 */
function getActionDescription(toolName, args) {
    switch (toolName) {
        case 'execute_sql_query':
            return `Execute SQL query:\n\`\`\`sql\n${args.sql?.substring(0, 100)}...\n\`\`\``;
        case 'generate_pql_from_description':
            return `Generate PQL segment expression for: "${args.description}"`;
        case 'generate_sql_from_intent':
            return `Generate SQL query for: "${args.intent}"`;
        default:
            return `Execute ${toolName}`;
    }
}

/**
 * Rule-based fallback when LLM is not available
 */
async function handleWithRules(message) {
    const lowerMsg = message.toLowerCase();

    const patterns = [
        { match: /(failed|error|fail).*(batch|ingestion)/i, tool: 'get_failed_batches', args: { limit: 10 } },
        { match: /batch.*(stat|stats|statistic)/i, tool: 'get_batch_stats', args: { timeRange: '24h' } },
        { match: /schema.*(stat|stats|registry)/i, tool: 'get_schema_stats', args: {} },
        { match: /(list|show|get).*(dataset|data set)/i, tool: 'list_datasets', args: { limit: 10 } },
        { match: /(segment|audience).*(stat|stats|count|how many)/i, tool: 'get_segment_stats', args: {} },
        { match: /(list|show|get).*(sandbox|environment)/i, tool: 'list_sandboxes', args: {} },
        { match: /identity.*(graph|link)/i, tool: 'list_namespaces', args: {} }
    ];

    for (const pattern of patterns) {
        if (pattern.match.test(message)) {
            try {
                const data = await toolRegistry.executeTool(pattern.tool, pattern.args);
                return {
                    content: formatToolResult(pattern.tool, data),
                    data,
                    toolsUsed: [pattern.tool]
                };
            } catch (error) {
                return { content: `❌ Error: ${error.message}`, toolsUsed: [pattern.tool] };
            }
        }
    }

    return {
        content: `👋 I can help you with AEP! Try asking:\n\n` +
            `• "Show me failed batches"\n` +
            `• "How many segments are there?"\n` +
            `• "Analyze batch errors for [batch-id]"\n` +
            `• "Create a segment for users who purchased last week"\n` +
            `• "Generate SQL for top 10 orders by revenue"\n`,
        toolsUsed: []
    };
}

/**
 * Get the tool list for display
 */
export function getTools() {
    return toolRegistry.getToolList();
}

/**
 * Get chat history
 */
export function getHistory() {
    return chatHistory;
}

/**
 * Clear chat history
 */
export function clearHistory() {
    chatHistory = [];
}
