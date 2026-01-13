import { useState, useEffect } from 'react';
import {
    getCoreLabels, getCustomLabels, getCorePolicies, getCustomPolicies,
    getCoreMarketingActions, getCustomMarketingActions, getEnabledPolicies,
    getPolicyStats, getCoreLabelDetails, getCorePolicyDetails
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, CopyButton
} from '../components/SharedComponents';

export default function Policies() {
    const [activeTab, setActiveTab] = useState('labels');
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [subTab, setSubTab] = useState('core');

    // Detail modal
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        loadData();
    }, [activeTab, subTab]);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const statsData = await getPolicyStats().catch(() => null);
            setStats(statsData);
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            let data;

            switch (activeTab) {
                case 'labels':
                    data = subTab === 'core'
                        ? await getCoreLabels().catch(() => ({ children: [] }))
                        : await getCustomLabels().catch(() => ({ children: [] }));
                    break;
                case 'policies':
                    data = subTab === 'core'
                        ? await getCorePolicies().catch(() => ({ children: [] }))
                        : await getCustomPolicies().catch(() => ({ children: [] }));
                    break;
                case 'actions':
                    data = subTab === 'core'
                        ? await getCoreMarketingActions().catch(() => ({ children: [] }))
                        : await getCustomMarketingActions().catch(() => ({ children: [] }));
                    break;
                case 'enabled':
                    data = await getEnabledPolicies().catch(() => ({ children: [] }));
                    break;
                default:
                    data = { children: [] };
            }

            setItems(data?.children || data?.results || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (item) => {
        setSelectedItem(item);
    };

    const filteredItems = items.filter(item =>
        !search ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.displayName?.toLowerCase().includes(search.toLowerCase())
    );

    const mainTabs = [
        { id: 'labels', label: 'Data Labels' },
        { id: 'policies', label: 'Policies' },
        { id: 'actions', label: 'Marketing Actions' },
        { id: 'enabled', label: 'Enabled Policies' }
    ];

    const getLabelColor = (category) => {
        const colors = {
            'C': 'var(--accent-purple)',
            'I': 'var(--accent-blue)',
            'S': 'var(--accent-cyan)',
        };
        return colors[category?.charAt(0)] || 'var(--text-muted)';
    };

    return (
        <>
            <div className="page-header">
                <h1>Policies & Governance</h1>
                <p>Manage data usage labels, policies, and marketing actions</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalLabels || 0}</div>
                    <div className="stat-card-label">TOTAL LABELS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalPolicies || 0}</div>
                    <div className="stat-card-label">TOTAL POLICIES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.enabledPolicies || 0}</div>
                    <div className="stat-card-label">ENABLED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.marketingActions || 0}</div>
                    <div className="stat-card-label">MARKETING ACTIONS</div>
                </div>
            </div>

            {/* Main Tabs */}
            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>
                {/* Sub-tabs for Core/Custom */}
                {activeTab !== 'enabled' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                            className={`dropdown-btn ${subTab === 'core' ? 'active' : ''}`}
                            onClick={() => setSubTab('core')}
                        >
                            Core (Adobe)
                        </button>
                        <button
                            className={`dropdown-btn ${subTab === 'custom' ? 'active' : ''}`}
                            onClick={() => setSubTab('custom')}
                        >
                            Custom (Tenant)
                        </button>
                    </div>
                )}

                {/* Search */}
                <div style={{ marginBottom: '16px' }}>
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '400px', padding: '10px 16px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)'
                        }}
                    />
                    <button className="btn-secondary" style={{ marginLeft: '8px' }} onClick={loadData}>
                        Refresh
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <LoadingSpinner text={`Loading ${activeTab}...`} />
                ) : filteredItems.length > 0 ? (
                    <>
                        {/* LABELS VIEW */}
                        {activeTab === 'labels' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {filteredItems.map((label, i) => (
                                    <div
                                        key={label.name || i}
                                        className="stat-card"
                                        style={{ cursor: 'pointer', borderLeft: `3px solid ${getLabelColor(label.name)}` }}
                                        onClick={() => openDetail(label)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                                                    {label.name}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                                    {label.friendlyName || label.displayName}
                                                </div>
                                            </div>
                                            <StatusBadge status={subTab} />
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {label.description?.substring(0, 100) || 'No description'}...
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* POLICIES VIEW */}
                        {activeTab === 'policies' && (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Policy Name</th>
                                            <th>Status</th>
                                            <th>Marketing Action</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map((policy, i) => (
                                            <tr key={policy.id || i}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{policy.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {policy.description?.substring(0, 60)}...
                                                    </div>
                                                </td>
                                                <td>
                                                    <StatusBadge status={policy.status || (policy.enabled ? 'enabled' : 'disabled')} />
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                                    {policy.marketingActionRefs?.[0]?.split('/').pop() || 'N/A'}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn-secondary"
                                                        style={{ padding: '4px 12px', fontSize: '12px' }}
                                                        onClick={() => openDetail(policy)}
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* MARKETING ACTIONS VIEW */}
                        {activeTab === 'actions' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {filteredItems.map((action, i) => (
                                    <div
                                        key={action.name || i}
                                        className="file-item"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => openDetail(action)}
                                    >
                                        <div className="file-info">
                                            <span style={{ fontSize: '24px' }}>🎯</span>
                                            <div>
                                                <div className="file-name">{action.name}</div>
                                                <div className="file-meta">
                                                    {action.description?.substring(0, 50) || 'Marketing action'}...
                                                </div>
                                            </div>
                                        </div>
                                        <StatusBadge status={subTab} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ENABLED POLICIES VIEW */}
                        {activeTab === 'enabled' && (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Policy ID</th>
                                            <th>Name</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map((policy, i) => (
                                            <tr key={policy.id || i}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{policy.id}</td>
                                                <td style={{ fontWeight: 500 }}>{policy.name}</td>
                                                <td><StatusBadge status="enabled" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <EmptyState message={`No ${activeTab} found`} icon="📋" />
                )}
            </TabPanel>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title={selectedItem?.name || selectedItem?.displayName || 'Details'}
                width="700px"
            >
                <JSONViewer
                    data={selectedItem || {}}
                    title={activeTab === 'labels' ? 'Label Details' : activeTab === 'policies' ? 'Policy Details' : 'Action Details'}
                    formattedContent={
                        <div className="detail-grid">
                            <DetailField label="Name" value={selectedItem?.name} mono copyable />
                            <DetailField label="Display Name" value={selectedItem?.friendlyName || selectedItem?.displayName} />
                            <DetailField label="Type" value={<StatusBadge status={subTab} />} />
                            <DetailField label="Description" value={selectedItem?.description || 'No description'} />

                            {activeTab === 'labels' && (
                                <>
                                    <DetailField label="Category" value={selectedItem?.category} />
                                    <DetailField label="Parent Category" value={selectedItem?.parentCategory} />
                                </>
                            )}

                            {activeTab === 'policies' && selectedItem?.deny && (
                                <DetailField
                                    label="Deny Labels"
                                    value={
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {selectedItem.deny?.label?.or?.map((l, i) => (
                                                <span key={i} className="status-badge warning">{l}</span>
                                            )) || 'N/A'}
                                        </div>
                                    }
                                />
                            )}
                        </div>
                    }
                />
            </Modal>
        </>
    );
}
