const API_BASE = 'http://localhost:3001/api';

async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
}

/**
 * Send a message to the AI Agent
 */
export const sendAgentMessage = (payload) =>
    fetchAPI('/agent/chat', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

/**
 * Get list of available agent tools
 */
export const getAgentTools = () =>
    fetchAPI('/agent/tools');

/**
 * Get chat history
 */
export const getAgentHistory = () =>
    fetchAPI('/agent/history');

/**
 * Clear chat history
 */
export const clearAgentHistory = () =>
    fetchAPI('/agent/history', { method: 'DELETE' });

// ===== CHAT HISTORY (RECALL) =====

/**
 * Get all saved conversations
 */
export const getConversations = () =>
    fetchAPI('/chat/conversations');

/**
 * Get a specific conversation by ID
 */
export const getConversation = (conversationId) =>
    fetchAPI(`/chat/conversations/${conversationId}`);

/**
 * Create a new conversation
 */
export const createConversation = (title) =>
    fetchAPI('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title })
    });

/**
 * Save messages to a conversation
 */
export const saveConversation = (conversationId, messages) =>
    fetchAPI(`/chat/conversations/${conversationId}`, {
        method: 'PUT',
        body: JSON.stringify({ messages })
    });

/**
 * Delete a conversation
 */
export const deleteConversation = (conversationId) =>
    fetchAPI(`/chat/conversations/${conversationId}`, { method: 'DELETE' });

/**
 * Get schema context for agent (field paths, common fields)
 */
export const getSchemaContext = () =>
    fetchAPI('/agent/schema-context');
