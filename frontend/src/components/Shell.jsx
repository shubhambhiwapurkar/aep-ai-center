import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { checkConnection, refreshConnection, getSandboxes, getCurrentSandbox, switchSandbox, setCurrentSandbox as setGlobalSandbox } from '../services/api';
import AgentPanel from './AgentPanel';

// Icons as simple SVG components
const DashboardIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
);

const BatchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

const SchemaIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
);

const DatasetIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);

const IdentityIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const ProfileIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const FlowIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const SegmentIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <path d="M2 12h20" />
    </svg>
);

const QueryIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
    </svg>
);

const APIIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 17l6-6-6-6M12 19h8" />
    </svg>
);

const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

export default function Shell({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [connection, setConnection] = useState({ connected: false, checking: true });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [sandboxes, setSandboxes] = useState([]);
    const [currentSandboxState, setCurrentSandboxState] = useState(null);
    const [showSandboxDropdown, setShowSandboxDropdown] = useState(false);
    const [switchingTo, setSwitchingTo] = useState(null);
    const [isAgentOpen, setIsAgentOpen] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('aep_theme') || 'dark');
    const location = useLocation();

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('aep_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        checkConnectionStatus();
        loadSandboxes();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const loadSandboxes = async () => {
        try {
            const [sbList, current] = await Promise.all([
                getSandboxes().catch(() => ({ sandboxes: [] })),
                getCurrentSandbox().catch(() => null)
            ]);
            setSandboxes(sbList?.sandboxes || []);
            setCurrentSandboxState(current);
            // Initialize global sandbox from stored preference
            const storedSandbox = localStorage.getItem('aep_sandbox');
            if (storedSandbox) {
                setGlobalSandbox(storedSandbox);
            } else if (current?.name) {
                setGlobalSandbox(current.name);
            }
        } catch (e) {
            console.error('Failed to load sandboxes', e);
        }
    };

    const handleSandboxSwitch = async (sandbox) => {
        setSwitchingTo(sandbox.name);
        try {
            // Call backend to switch sandbox
            await switchSandbox(sandbox.name);

            // Update local state
            setGlobalSandbox(sandbox.name);
            setCurrentSandboxState(sandbox);
            setShowSandboxDropdown(false);

            // Refresh connection to verify new sandbox
            await checkConnectionStatus();

            // Reload page to refresh all data with new sandbox context
            window.location.reload();
        } catch (e) {
            console.error('Failed to switch sandbox', e);
            alert(`Failed to switch sandbox: ${e.message}`);
        } finally {
            setSwitchingTo(null);
        }
    };

    const checkConnectionStatus = async () => {
        setConnection(prev => ({ ...prev, checking: true }));
        try {
            const status = await checkConnection();
            setConnection({ ...status, checking: false });
        } catch (error) {
            setConnection({ connected: false, error: error.message, checking: false });
        }
    };

    const handleRefresh = async () => {
        setConnection(prev => ({ ...prev, checking: true }));
        try {
            const status = await refreshConnection();
            setConnection({ ...status, checking: false });
        } catch (error) {
            setConnection({ connected: false, error: error.message, checking: false });
        }
    };

    const getConnectionClass = () => {
        if (connection.checking) return 'connecting';
        if (connection.connected) return 'connected';
        return 'error';
    };

    const getConnectionText = () => {
        if (connection.checking) return 'CONNECTING';
        if (connection.connected) return 'CONNECTED';
        return 'DISCONNECTED';
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getPageTitle = () => {
        const titles = {
            '/': 'Command Center',
            '/batches': 'Batch Monitor',
            '/schemas': 'Schema Registry',
            '/datasets': 'Datasets',
            '/identities': 'Identity Service',
            '/profiles': 'Real-time Profiles',
            '/flows': 'Data Flows',
            '/segments': 'Segmentation',
            '/queries': 'Query Service',
            '/policies': 'Policies & Governance',
            '/privacy': 'Privacy Jobs',
            '/audit': 'Audit Log',
            '/sandboxes': 'Sandboxes',
            '/sandbox-compare': 'Sandbox Comparison',
            '/ingestion': 'Data Ingestion',
            '/data-prep': 'Data Prep',
            '/data-lineage': 'Data Lineage',
            '/api-browser': 'API Browser'
        };
        return titles[location.pathname] || 'Dashboard';
    };

    return (
        <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${isAgentOpen ? 'agent-open' : ''}`}>
            {/* Sidebar */}
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ gridArea: 'nav' }}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon" style={{ background: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="40" height="40" rx="8" fill="#FA0F00" />
                            <path d="M24 29H30V9H24.5L20.5 20L16.5 9H11V29H15.5L18.5 19L21.5 29H24ZM18.5 19L20.5 13.5L22.5 19H18.5Z" fill="white" fillOpacity="0.2" />
                            <path d="M23 7H29V29H24.5L20 17L15.5 29H11V7H17L20 15L23 7Z" fill="white" />
                        </svg>
                    </div>
                    {!collapsed && (
                        <div className="sidebar-logo-text">
                            <h1>AEP MONITOR</h1>
                            <span>Enterprise Platform</span>
                        </div>
                    )}
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">MAIN</div>
                    <nav className="sidebar-nav">
                        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <DashboardIcon /> {!collapsed && 'Dashboard'}
                        </NavLink>
                        <NavLink to="/batches" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <BatchIcon /> {!collapsed && 'Batch Monitor'}
                        </NavLink>
                        <NavLink to="/schemas" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <SchemaIcon /> {!collapsed && 'Schema Registry'}
                        </NavLink>
                        <NavLink to="/schema-dictionary" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">📚</span> {!collapsed && 'Schema Dictionary'}
                        </NavLink>
                        <NavLink to="/datasets" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <DatasetIcon /> {!collapsed && 'Datasets'}
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">CUSTOMER DATA</div>
                    <nav className="sidebar-nav">
                        <NavLink to="/identities" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <IdentityIcon /> {!collapsed && 'Identities'}
                        </NavLink>
                        <NavLink to="/profiles" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <ProfileIcon /> {!collapsed && 'Profiles'}
                        </NavLink>
                        <NavLink to="/segments" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <SegmentIcon /> {!collapsed && 'Segments'}
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">DATA MANAGEMENT</div>
                    <nav className="sidebar-nav">
                        <NavLink to="/flows" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <FlowIcon /> {!collapsed && 'Data Flows'}
                        </NavLink>
                        <NavLink to="/queries" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <QueryIcon /> {!collapsed && 'Query Service'}
                        </NavLink>
                        <NavLink to="/ingestion" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">📥</span> {!collapsed && 'Data Ingestion'}
                        </NavLink>
                        <NavLink to="/data-prep" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">🔀</span> {!collapsed && 'Data Prep'}
                        </NavLink>
                        <NavLink to="/data-lineage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">🔗</span> {!collapsed && 'Data Lineage'}
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">DEVELOPER</div>
                    <nav className="sidebar-nav">
                        <NavLink to="/api-browser" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <APIIcon /> {!collapsed && 'API Browser'}
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">GOVERNANCE</div>
                    <nav className="sidebar-nav">
                        <NavLink to="/policies" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">📋</span> {!collapsed && 'Policies'}
                        </NavLink>
                        <NavLink to="/privacy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">🔒</span> {!collapsed && 'Privacy Jobs'}
                        </NavLink>
                        <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">📜</span> {!collapsed && 'Audit Log'}
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">PLATFORM</div>
                    <nav className="sidebar-nav">
                        <NavLink to="/sandboxes" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">📦</span> {!collapsed && 'Sandboxes'}
                        </NavLink>
                        <NavLink to="/sandbox-compare" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-icon-text">🔀</span> {!collapsed && 'Compare'}
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-footer">
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {!collapsed && (
                            <>
                                <div>v2.0.0</div>
                                <div>{connection.sandboxName || 'No Sandbox'}</div>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content" style={{
                gridArea: 'main',
                marginLeft: 0,
                marginRight: isAgentOpen ? '500px' : 0,
                transition: 'margin-right 0.3s ease'
            }}>
                <header className="header">
                    <div className="header-title">
                        <h1>{getPageTitle()}</h1>
                        <span>AEP Monitoring System</span>
                    </div>

                    <div className="header-actions">
                        {/* Sandbox Switcher */}
                        <div style={{ position: 'relative' }}>
                            <button
                                className="sandbox-switcher"
                                onClick={() => setShowSandboxDropdown(!showSandboxDropdown)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                <span>📦</span>
                                <span>{currentSandboxState?.name || connection.sandboxName || 'Select Sandbox'}</span>
                                <span style={{ fontSize: '10px', opacity: 0.5 }}>▼</span>
                            </button>

                            {showSandboxDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    minWidth: '220px',
                                    zIndex: 1000,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px' }}>
                                        AVAILABLE SANDBOXES
                                    </div>
                                    {sandboxes.length > 0 ? sandboxes.filter(s => s.state === 'active').map(sb => (
                                        <div
                                            key={sb.name}
                                            onClick={() => handleSandboxSwitch(sb)}
                                            style={{
                                                padding: '10px 12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                background: currentSandboxState?.name === sb.name ? 'var(--bg-tertiary)' : 'transparent',
                                                borderLeft: currentSandboxState?.name === sb.name ? '2px solid var(--accent-blue)' : '2px solid transparent'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = currentSandboxState?.name === sb.name ? 'var(--bg-tertiary)' : 'transparent'}
                                        >
                                            <span>{sb.type === 'production' ? '🏭' : '🔧'}</span>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{sb.title || sb.name}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    {sb.type} • {sb.region || 'VA7'}
                                                </div>
                                            </div>
                                            {currentSandboxState?.name === sb.name && (
                                                <span style={{ marginLeft: 'auto', color: 'var(--accent-green)', fontSize: '12px' }}>✓</span>
                                            )}
                                        </div>
                                    )) : (
                                        <div style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            No sandboxes found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="live-indicator">
                            <span className="live-dot"></span>
                            <span>LIVE</span>
                            <span style={{ fontFamily: 'monospace' }}>{formatTime(currentTime)}</span>
                        </div>

                        <button
                            className={`connection-btn ${getConnectionClass()}`}
                            onClick={handleRefresh}
                            title={connection.error || 'Click to refresh'}
                        >
                            <span className="connection-dot"></span>
                            <span>{getConnectionText()}</span>
                        </button>

                        <button
                            className="btn-secondary"
                            onClick={toggleTheme}
                            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>

                        <button
                            className="btn-secondary"
                            onClick={handleRefresh}
                            style={{ padding: '8px', borderRadius: 'var(--radius-md)' }}
                        >
                            <RefreshIcon />
                        </button>
                    </div>
                </header>

                <div className="dashboard-content">
                    {children}
                </div>
            </main>

            {/* AI Agent Panel */}
            <AgentPanel
                isOpen={isAgentOpen}
                onToggle={() => setIsAgentOpen(!isAgentOpen)}
            />
        </div>
    );
}
