/**
 * Chat History Service
 * Stores and retrieves agent chat conversations
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store chats in a JSON file (can be replaced with database)
const CHAT_HISTORY_FILE = path.join(__dirname, '../../data/chat_history.json');

// Ensure data directory exists
const dataDir = path.dirname(CHAT_HISTORY_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize chat history file if it doesn't exist
if (!fs.existsSync(CHAT_HISTORY_FILE)) {
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify({ conversations: [] }, null, 2));
}

/**
 * Load all chat history from storage
 */
function loadChatHistory() {
    try {
        const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading chat history:', error);
        return { conversations: [] };
    }
}

/**
 * Save chat history to storage
 */
function saveChatHistory(history) {
    try {
        fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving chat history:', error);
        return false;
    }
}

/**
 * Get all conversations (summary only)
 */
function getConversations() {
    const history = loadChatHistory();
    return history.conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages?.length || 0,
        preview: conv.messages?.[conv.messages.length - 1]?.content?.substring(0, 100) || ''
    })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Get a specific conversation by ID
 */
function getConversation(conversationId) {
    const history = loadChatHistory();
    return history.conversations.find(c => c.id === conversationId) || null;
}

/**
 * Create a new conversation
 */
function createConversation(title = 'New Conversation') {
    const history = loadChatHistory();
    const newConversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
    };
    history.conversations.push(newConversation);
    saveChatHistory(history);
    return newConversation;
}

/**
 * Save messages to a conversation
 */
function saveMessages(conversationId, messages) {
    const history = loadChatHistory();
    const convIndex = history.conversations.findIndex(c => c.id === conversationId);

    if (convIndex === -1) {
        // Create new conversation if doesn't exist
        const newConv = createConversation('Chat Session');
        newConv.messages = messages;
        newConv.updatedAt = new Date().toISOString();
        // Auto-generate title from first user message
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
            newConv.title = firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
        }
        return newConv;
    }

    history.conversations[convIndex].messages = messages;
    history.conversations[convIndex].updatedAt = new Date().toISOString();

    // Auto-generate title from first user message if title is default
    if (history.conversations[convIndex].title === 'New Conversation' ||
        history.conversations[convIndex].title === 'Chat Session') {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
            history.conversations[convIndex].title = firstUserMsg.content.substring(0, 50) +
                (firstUserMsg.content.length > 50 ? '...' : '');
        }
    }

    saveChatHistory(history);
    return history.conversations[convIndex];
}

/**
 * Delete a conversation
 */
function deleteConversation(conversationId) {
    const history = loadChatHistory();
    history.conversations = history.conversations.filter(c => c.id !== conversationId);
    saveChatHistory(history);
    return true;
}

/**
 * Clear all conversations
 */
function clearAllConversations() {
    saveChatHistory({ conversations: [] });
    return true;
}

export {
    getConversations,
    getConversation,
    createConversation,
    saveMessages,
    deleteConversation,
    clearAllConversations
};
