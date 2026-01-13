import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { sendAgentMessage, getAgentTools } from '../services/agent-api';
import { getDashboardSummary, getBatches, getRecentQueries } from '../services/api';

// Get context description based on current page
const getPageContext = (pathname) => {
    const contexts = {
        '/': { name: 'Dashboard', hint: 'I can help with system overview and health status' },
        '/batches': { name: 'Batch Monitor', hint: 'Ask me about failed batches, errors, or ingestion issues' },
        '/schemas': { name: 'Schema Registry', hint: 'I can search schemas, explain XDM types, and suggest field groups' },
        '/datasets': { name: 'Datasets', hint: 'Need help with datasets, files, or data labels?' },
        '/identities': { name: 'Identity Service', hint: 'Ask about identity graphs, namespaces, or XID lookups' },
        '/profiles': { name: 'Profiles', hint: 'I can help lookup profiles and explain merge policies' },
        '/segments': { name: 'Segments', hint: 'Want to debug a segment or create one from description?' },
        '/queries': { name: 'Query Service', hint: 'I can help write SQL, optimize queries, or explain errors' },
        '/flows': { name: 'Data Flows', hint: 'Ask about flow runs, connections, or pipeline issues' },
        '/policies': { name: 'Governance', hint: 'I can explain data labels and policies' },
        '/sandboxes': { name: 'Sandboxes', hint: 'Need help comparing or managing sandboxes?' },
        '/ingestion': { name: 'Data Ingestion', hint: 'I can help with uploads and streaming' },
        '/data-prep': { name: 'Data Prep', hint: 'Ask me to suggest mappings or transformations' },
    };
    return contexts[pathname] || { name: 'AEP', hint: 'How can I assist you?' };
};

// Alert Item Component
const AlertItem = ({ alert, onClick }) => (
    <div
        className="alert-item"
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '10px 12px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            marginBottom: '8px',
            cursor: 'pointer',
            transition: 'background 0.2s',
            borderLeft: `3px solid ${alert.severity === 'critical' ? 'var(--accent-red)' :
                alert.severity === 'warning' ? 'var(--accent-yellow)' : 'var(--accent-blue)'}`
        }}
    >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{alert.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '2px' }}>
                {alert.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                {alert.message}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {alert.time}
            </div>
        </div>
    </div>
);

export default function AgentPanel({ isOpen, onToggle, currentPath }) {
    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [autoMode, setAutoMode] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [tools, setTools] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [showAlerts, setShowAlerts] = useState(true);
    const messagesEndRef = useRef(null);

    const context = getPageContext(location.pathname);

    useEffect(() => {
        loadTools();
        loadAlerts();
        // Initialize with context-aware welcome
        setMessages([{
            id: 1,
            role: 'assistant',
            content: `👋 Welcome to **${context.name}**!\n\n${context.hint}`,
            timestamp: new Date().toISOString()
        }]);
    }, []);

    useEffect(() => {
        // Update context when page changes
        if (messages.length > 0) {
            setMessages(prev => [{
                ...prev[0],
                content: `👋 Now viewing **${context.name}**\n\n${context.hint}`
            }, ...prev.slice(1)]);
        }
    }, [location.pathname]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadTools = async () => {
        try {
            const toolList = await getAgentTools();
            setTools(toolList || []);
        } catch (e) {
            console.error('Failed to load tools', e);
        }
    };

    const loadAlerts = async () => {
        setAlertsLoading(true);
        try {
            const [summary, failedBatches, queries] = await Promise.all([
                getDashboardSummary('24h').catch(() => null),
                getBatches({ status: 'failed', limit: 5 }).catch(() => ({ batches: [] })),
                getRecentQueries({ limit: 10 }).catch(() => ({ queries: [] }))
            ]);

            const newAlerts = [];

            // Failed batches alerts
            const failedCount = summary?.batches?.failed || failedBatches?.batches?.length || 0;
            if (failedCount > 0) {
                newAlerts.push({
                    id: 'failed-batches',
                    icon: '❌',
                    severity: failedCount > 5 ? 'critical' : 'warning',
                    title: `${failedCount} Failed Batches`,
                    message: 'Ingestion errors detected in the last 24 hours',
                    time: 'Last 24h',
                    action: 'Analyze batch errors'
                });
            }

            // Failed queries
            const failedQueries = (queries?.queries || []).filter(q =>
                q.state === 'FAILED' || q.state === 'ERROR'
            );
            if (failedQueries.length > 0) {
                newAlerts.push({
                    id: 'failed-queries',
                    icon: '📋',
                    severity: 'warning',
                    title: `${failedQueries.length} Failed Queries`,
                    message: 'SQL queries failed execution',
                    time: 'Recent',
                    action: 'Show failed queries'
                });
            }

            // Processing batches
            const activeBatches = summary?.batches?.active || 0;
            if (activeBatches > 0) {
                newAlerts.push({
                    id: 'active-batches',
                    icon: '⏳',
                    severity: 'info',
                    title: `${activeBatches} Active Jobs`,
                    message: 'Batch ingestion currently in progress',
                    time: 'Now',
                    action: 'Show processing batches'
                });
            }

            // Low success rate
            const successRate = summary?.batches?.successRate || 100;
            if (successRate < 90) {
                newAlerts.push({
                    id: 'low-success',
                    icon: '⚠️',
                    severity: 'warning',
                    title: 'Low Success Rate',
                    message: `Ingestion success rate at ${successRate.toFixed(1)}%`,
                    time: 'Last 24h',
                    action: 'Diagnose ingestion issues'
                });
            }

            // If no issues, show healthy status
            if (newAlerts.length === 0) {
                newAlerts.push({
                    id: 'healthy',
                    icon: '✅',
                    severity: 'healthy',
                    title: 'All Systems Healthy',
                    message: 'No issues detected in the last 24 hours',
                    time: 'Now'
                });
            }

            setAlerts(newAlerts);
        } catch (e) {
            console.error('Failed to load alerts', e);
            setAlerts([{
                id: 'error',
                icon: '⚠️',
                severity: 'warning',
                title: 'Could not load alerts',
                message: 'Click to retry',
                time: 'Now'
            }]);
        } finally {
            setAlertsLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleAlertClick = (alert) => {
        if (alert.action) {
            setInput(alert.action);
            setShowAlerts(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        // Hide alerts when user starts chatting
        setShowAlerts(false);

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await sendAgentMessage({
                message: input.trim(),
                autoMode,
                history: messages.slice(-10),
                context: { page: context.name, path: location.pathname }
            });

            if (response.requiresApproval && !autoMode) {
                setPendingAction(response);
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'assistant',
                    content: `🔔 **Action Required**\n\n${response.actionDescription}`,
                    timestamp: new Date().toISOString(),
                    isPending: true,
                    actions: [
                        { label: '✓ Approve', action: 'approve', variant: 'primary' },
                        { label: '✕ Cancel', action: 'cancel', variant: 'secondary' }
                    ]
                }]);
            } else {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'assistant',
                    content: response.content || response.message,
                    timestamp: new Date().toISOString(),
                    data: response.data,
                    toolsUsed: response.toolsUsed,
                    actions: response.suggestedActions
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: `❌ ${error.message}`,
                timestamp: new Date().toISOString(),
                isError: true
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (action === 'approve' && pendingAction) {
            setLoading(true);
            try {
                const response = await sendAgentMessage({
                    message: '__EXECUTE_APPROVED__',
                    approvedAction: pendingAction,
                    autoMode: true
                });
                setMessages(prev => [
                    ...prev.filter(m => !m.isPending),
                    {
                        id: Date.now(),
                        role: 'assistant',
                        content: response.content || response.message,
                        data: response.data,
                        toolsUsed: response.toolsUsed
                    }
                ]);
            } catch (error) {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'assistant',
                    content: `❌ ${error.message}`,
                    isError: true
                }]);
            } finally {
                setPendingAction(null);
                setLoading(false);
            }
        } else if (action === 'cancel') {
            setMessages(prev => [
                ...prev.filter(m => !m.isPending),
                { id: Date.now(), role: 'assistant', content: '👍 Action cancelled.' }
            ]);
            setPendingAction(null);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Quick prompts based on current page
    const getQuickPrompts = () => {
        const prompts = {
            '/batches': ['Show failed batches', 'Analyze recent errors', 'Get batch stats'],
            '/schemas': ['List tenant schemas', 'Get schema stats', 'Find profile schemas'],
            '/datasets': ['List datasets', 'Get dataset stats', 'Show large datasets'],
            '/segments': ['List segments', 'Debug empty segments', 'Get segment stats'],
            '/queries': ['Recent queries', 'Query statistics', 'Failed queries'],
            '/profiles': ['Profile stats', 'Lookup by email', 'Merge policies'],
            '/': ['System health', 'Failed batches', 'Recent activity']
        };
        return prompts[location.pathname] || ['Get failed batches', 'Schema stats', 'List datasets'];
    };

    // Minimized state (floating button)
    if (!isOpen) {
        return (
            <div className="agent-panel-minimized">
                <button className="agent-fab" onClick={onToggle}>
                    🤖
                    {alerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length > 0 && (
                        <span className="notification-badge">
                            {alerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length}
                        </span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="agent-panel-wrapper">
            {/* Header with context */}
            <div className="agent-header">
                <div className="agent-header-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>🤖</span>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>AEP Copilot</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {tools.length} tools • Gemini 3 Pro
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={autoMode}
                                onChange={(e) => setAutoMode(e.target.checked)}
                            />
                            <span style={{ color: autoMode ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                {autoMode ? '🚀 Auto' : '🛡️ Safe'}
                            </span>
                        </label>
                        <button
                            onClick={onToggle}
                            style={{
                                background: 'none', border: 'none',
                                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px'
                            }}
                        >✕</button>
                    </div>
                </div>

                {/* Context Banner */}
                <div className="agent-context-banner">
                    📍 Viewing <span className="context-page">{context.name}</span>
                </div>
            </div>

            {/* Alerts Card - Shows by default */}
            {showAlerts && (
                <div className="alerts-card">
                    <div className="alerts-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🔔</span>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>Alerts</span>
                            <span className="alerts-badge">
                                {alerts.filter(a => a.severity !== 'healthy').length}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowAlerts(false)}
                            style={{
                                background: 'none', border: 'none',
                                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px'
                            }}
                        >✕</button>
                    </div>
                    <div className="alerts-list">
                        {alertsLoading ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div className="spinner" style={{ width: '16px', height: '16px', margin: '0 auto' }} />
                                <div style={{ marginTop: '8px', fontSize: '11px' }}>Loading alerts...</div>
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <AlertItem
                                    key={alert.id}
                                    alert={alert}
                                    onClick={() => handleAlertClick(alert)}
                                />
                            ))
                        )}
                    </div>
                    <button
                        onClick={loadAlerts}
                        style={{
                            width: '100%', padding: '8px', fontSize: '11px',
                            background: 'none', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer'
                        }}
                    >
                        🔄 Refresh Alerts
                    </button>
                </div>
            )}

            {/* Messages */}
            <div className="agent-messages">
                {messages.map(msg => (
                    <div key={msg.id} className={`agent-message ${msg.role}`}>
                        <div className="message-content" style={{
                            background: msg.role === 'user' ? 'var(--accent-blue)' :
                                msg.isError ? 'rgba(239,68,68,0.15)' :
                                    msg.isPending ? 'rgba(234,179,8,0.15)' : 'var(--bg-card)',
                            border: msg.isPending ? '1px solid var(--accent-yellow)' : 'none'
                        }}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                            {/* Data Preview */}
                            {msg.data && (
                                <div style={{
                                    marginTop: '12px', padding: '10px',
                                    background: 'var(--bg-primary)', borderRadius: '8px',
                                    fontSize: '11px', fontFamily: 'monospace',
                                    maxHeight: '150px', overflow: 'auto'
                                }}>
                                    <pre style={{ margin: 0 }}>
                                        {JSON.stringify(msg.data, null, 2).substring(0, 400)}
                                        {JSON.stringify(msg.data).length > 400 && '...'}
                                    </pre>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {msg.actions && (
                                <div className="action-block">
                                    {msg.actions.map((action, i) => (
                                        <button
                                            key={i}
                                            className="action-btn"
                                            onClick={() => handleAction(action.action)}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Tools Used */}
                            {msg.toolsUsed?.length > 0 && (
                                <div style={{
                                    marginTop: '8px', fontSize: '10px',
                                    color: 'var(--text-muted)'
                                }}>
                                    🔧 {msg.toolsUsed.join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={{ padding: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="spinner" style={{ width: '14px', height: '14px' }} />
                        Thinking...
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts (show when few messages and alerts hidden) */}
            {messages.length <= 2 && !showAlerts && (
                <div style={{
                    padding: '8px 16px', borderTop: '1px solid var(--border-subtle)',
                    display: 'flex', gap: '6px', flexWrap: 'wrap'
                }}>
                    {getQuickPrompts().map((prompt, i) => (
                        <button
                            key={i}
                            onClick={() => setInput(prompt)}
                            style={{
                                padding: '5px 10px', fontSize: '11px',
                                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                                borderRadius: '12px', color: 'var(--text-secondary)', cursor: 'pointer'
                            }}
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="agent-input-area">
                <div className="agent-input-wrapper">
                    <textarea
                        className="agent-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={`Ask about ${context.name.toLowerCase()}...`}
                        disabled={loading || !!pendingAction}
                        rows={1}
                    />
                    <button
                        className="agent-send-btn"
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                    >
                        ➤
                    </button>
                </div>
                <div style={{
                    marginTop: '8px', fontSize: '10px',
                    color: 'var(--text-muted)', textAlign: 'center'
                }}>
                    {autoMode ? '🚀 Auto mode' : '🛡️ Actions require approval'}
                </div>
            </div>
        </div>
    );
}
