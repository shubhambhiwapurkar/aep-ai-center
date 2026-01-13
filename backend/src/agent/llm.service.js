/**
 * Google Gemini 3 LLM Service
 * Handles LLM interactions for the AI Agent using Google's Gemini 3 API
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini configuration from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

let genAI = null;
let model = null;

/**
 * Initialize Gemini client
 */
function initClient() {
    if (!genAI && GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                maxOutputTokens: 4096
            }
        });
    }
    return model;
}

/**
 * Check if Gemini is configured
 */
export function isConfigured() {
    return Boolean(GEMINI_API_KEY);
}

/**
 * Convert tools to Gemini function declarations format
 */
function convertToolsToGeminiFunctions(tools) {
    if (!tools || tools.length === 0) return null;

    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }));
}

/**
 * Build chat history for Gemini
 * IMPORTANT: Gemini requires first message to be from 'user' role
 */
function buildHistory(messages) {
    const history = [];
    let systemPrompt = '';

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemPrompt = msg.content;
        } else if (msg.role === 'user') {
            history.push({
                role: 'user',
                parts: [{ text: msg.content }]
            });
        } else if (msg.role === 'assistant') {
            history.push({
                role: 'model',
                parts: [{ text: msg.content }]
            });
        }
    }

    // Gemini requires history to start with 'user' role
    // Remove any leading 'model' messages
    while (history.length > 0 && history[0].role === 'model') {
        history.shift();
    }

    // Ensure alternating pattern (user, model, user, model...)
    // Gemini is strict about this
    const cleanHistory = [];
    let lastRole = null;

    for (const msg of history) {
        // Skip if same role as previous (shouldn't happen but safety check)
        if (msg.role === lastRole) {
            continue;
        }
        cleanHistory.push(msg);
        lastRole = msg.role;
    }

    // If history ends with 'user', we need to remove it as we'll send a new user message
    if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
        cleanHistory.pop();
    }

    return { history: cleanHistory, systemPrompt };
}

/**
 * Send a chat completion request to Gemini
 */
export async function chatCompletion(messages, tools = null, options = {}) {
    if (!isConfigured()) {
        throw new Error('Gemini not configured. Please set GEMINI_API_KEY in .env');
    }

    try {
        const client = initClient();
        const { history, systemPrompt } = buildHistory(messages.slice(0, -1));
        const lastMessage = messages[messages.length - 1];

        // Create model with tools if provided
        let chatModel = client;
        if (tools && tools.length > 0) {
            const functionDeclarations = convertToolsToGeminiFunctions(tools);
            chatModel = genAI.getGenerativeModel({
                model: GEMINI_MODEL,
                tools: [{ functionDeclarations }],
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.maxTokens || 4096
                }
            });
        }

        // Start chat with history
        // Note: systemInstruction can be a string or Content object depending on SDK version
        const chatConfig = {
            history: history.length > 0 ? history : undefined
        };

        // Add system instruction if present - try as string first (newer SDK versions)
        if (systemPrompt) {
            chatConfig.systemInstruction = {
                role: 'user',
                parts: [{ text: systemPrompt }]
            };
        }

        const chat = chatModel.startChat(chatConfig);

        // Send the last message
        const result = await chat.sendMessage(lastMessage.content);
        const response = result.response;

        return {
            choices: [{
                message: {
                    content: response.text(),
                    tool_calls: extractFunctionCalls(response)
                }
            }]
        };
    } catch (error) {
        console.error('Gemini request failed:', error);
        throw error;
    }
}

/**
 * Extract function calls from Gemini response
 */
function extractFunctionCalls(response) {
    const calls = [];

    try {
        const candidates = response.candidates || [];
        for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
                if (part.functionCall) {
                    calls.push({
                        id: `call_${calls.length}`,
                        type: 'function',
                        function: {
                            name: part.functionCall.name,
                            arguments: JSON.stringify(part.functionCall.args || {})
                        }
                    });
                }
            }
        }
    } catch (e) {
        // No function calls
    }

    return calls.length > 0 ? calls : null;
}

/**
 * Parse tool calls from the response (OpenAI-compatible format)
 */
export function parseToolCalls(response) {
    const message = response.choices?.[0]?.message;

    if (!message) return null;

    if (message.tool_calls && message.tool_calls.length > 0) {
        return message.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}')
        }));
    }

    return null;
}

/**
 * Get the text content from a response
 */
export function getContent(response) {
    return response.choices?.[0]?.message?.content || '';
}

/**
 * Get model info
 */
export function getModelInfo() {
    return {
        provider: 'Google Gemini',
        model: GEMINI_MODEL,
        configured: isConfigured()
    };
}
