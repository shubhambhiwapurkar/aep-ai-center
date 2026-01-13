import { useState, useEffect } from 'react';
import {
    getSandboxes, getSandboxStats, getSandboxTypes,
    getCurrentSandbox, getSandboxDetails
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal
} from '../components/SharedComponents';

export default function Sandboxes() {
    const [sandboxes, setSandboxes] = useState([]);
    const [stats, setStats] = useState(null);
    const [types, setTypes] = useState([]);
    const [current, setCurrent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Detail modal
    const [selectedSandbox, setSelectedSandbox] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            const [sandboxData, statsData, typesData, currentData] = await Promise.all([
                getSandboxes().catch(() => ({ sandboxes: [] })),
                getSandboxStats().catch(() => null),
                getSandboxTypes().catch(() => ({ sandboxTypes: [] })),
                getCurrentSandbox().catch(() => null)
            ]);

            setSandboxes(sandboxData?.sandboxes || []);
            setStats(statsData);
            setTypes(typesData?.sandboxTypes || []);
            setCurrent(currentData);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    const getSandboxIcon = (type) => {
        const icons = {
            'production': '🏭',
            'development': '🔧',
            'staging': '🎭'
        };
        return icons[type?.toLowerCase()] || '📦';
    };

    const filteredSandboxes = sandboxes.filter(sb => {
        if (filter === 'all') return true;
        return sb.type?.toLowerCase() === filter || sb.state?.toLowerCase() === filter;
    });

    return (
        <>
            <div className="page-header">
                <h1>Sandbox Manager</h1>
                <p>Manage and switch between AEP sandboxes</p>
            </div>

            {/* Current Sandbox Banner */}
            {current && (
                <div style={{
                    background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>CURRENT SANDBOX</div>
                        <div style={{ fontSize: '24px', fontWeight: 600 }}>{current.name}</div>
                        <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
                            {current.type} • {current.region || 'VA7'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <StatusBadge status={current.state || 'active'} />
                        <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.8 }}>
                            Region: {current.region || 'VA7'}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.total || sandboxes.length}</div>
                    <div className="stat-card-label">TOTAL SANDBOXES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>
                        {stats?.production || sandboxes.filter(s => s.type === 'production').length}
                    </div>
                    <div className="stat-card-label">PRODUCTION</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>
                        {stats?.development || sandboxes.filter(s => s.type === 'development').length}
                    </div>
                    <div className="stat-card-label">DEVELOPMENT</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-cyan)' }}>
                        {types.length}
                    </div>
                    <div className="stat-card-label">SANDBOX TYPES</div>
                </div>
            </div>

            {/* Filters */}
            <div className="action-bar" style={{ marginBottom: '24px' }}>
                <div className="action-bar-left" style={{ display: 'flex', gap: '8px' }}>
                    {['all', 'production', 'development', 'active', 'deleted'].map(f => (
                        <button
                            key={f}
                            className={`dropdown-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <button className="btn-secondary" onClick={loadData}>
                    Refresh
                </button>
            </div>

            {/* Sandboxes Grid */}
            {loading ? (
                <LoadingSpinner text="Loading sandboxes..." />
            ) : filteredSandboxes.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {filteredSandboxes.map((sandbox, i) => (
                        <div
                            key={sandbox.name || i}
                            className="stat-card"
                            style={{
                                cursor: 'pointer',
                                border: current?.name === sandbox.name ? '2px solid var(--accent-blue)' : undefined
                            }}
                            onClick={() => setSelectedSandbox(sandbox)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '32px' }}>{getSandboxIcon(sandbox.type)}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '16px' }}>{sandbox.title || sandbox.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            {sandbox.name}
                                        </div>
                                    </div>
                                </div>
                                {current?.name === sandbox.name && (
                                    <span style={{
                                        background: 'var(--accent-green)',
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: 600
                                    }}>
                                        CURRENT
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Type</div>
                                    <div style={{ textTransform: 'capitalize' }}>{sandbox.type}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>State</div>
                                    <StatusBadge status={sandbox.state} />
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Region</div>
                                    <div>{sandbox.region || 'VA7'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Created</div>
                                    <div>{formatDate(sandbox.createdDate)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message="No sandboxes found" icon="📦" />
            )}

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedSandbox}
                onClose={() => setSelectedSandbox(null)}
                title={`Sandbox: ${selectedSandbox?.title || selectedSandbox?.name}`}
                width="700px"
            >
                <JSONViewer
                    data={selectedSandbox || {}}
                    title="Sandbox Details"
                    formattedContent={
                        <div>
                            <div className="detail-grid">
                                <DetailField label="Name" value={selectedSandbox?.name} mono copyable />
                                <DetailField label="Title" value={selectedSandbox?.title} />
                                <DetailField label="Type" value={selectedSandbox?.type} />
                                <DetailField label="State" value={<StatusBadge status={selectedSandbox?.state} />} />
                                <DetailField label="Region" value={selectedSandbox?.region || 'VA7'} />
                                <DetailField label="IMS Org" value={selectedSandbox?.imsOrgId} mono />
                                <DetailField label="Created By" value={selectedSandbox?.createdBy} />
                                <DetailField label="Created" value={formatDate(selectedSandbox?.createdDate)} />
                                <DetailField label="Modified By" value={selectedSandbox?.modifiedBy} />
                                <DetailField label="Modified" value={formatDate(selectedSandbox?.modifiedDate)} />
                            </div>

                            {/* Switch Sandbox Action */}
                            {selectedSandbox?.name !== current?.name && selectedSandbox?.state === 'active' && (
                                <div className="action-bar" style={{ marginTop: '20px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        Switch to this sandbox to work with its resources
                                    </span>
                                    <button className="btn-primary" disabled>
                                        Switch Sandbox (Requires Backend)
                                    </button>
                                </div>
                            )}
                        </div>
                    }
                />
            </Modal>
        </>
    );
}
