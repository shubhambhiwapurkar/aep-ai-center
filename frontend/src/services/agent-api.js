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
