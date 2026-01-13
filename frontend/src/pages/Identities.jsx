import { useState, useEffect } from 'react';
import {
    getNamespaces, getIdentityStats, getXID, getClusterMembers,
    getClusterHistory, getIdentityMappings, getNamespaceDetails
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, ClickableId, CopyButton
} from '../components/SharedComponents';

export default function Identities() {
    const [namespaces, setNamespaces] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('namespaces');
    const [search, setSearch] = useState('');

    // Detail modal
    const [selectedNs, setSelectedNs] = useState(null);
    const [detailData, setDetailData] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);

    // XID Lookup
    const [xidNamespace, setXidNamespace] = useState('Email');
    const [xidId, setXidId] = useState('');
    const [xidResult, setXidResult] = useState(null);
    const [xidLoading, setXidLoading] = useState(false);

    // Cluster
    const [clusterXid, setClusterXid] = useState('');
    const [clusterResult, setClusterResult] = useState(null);
    const [clusterLoading, setClusterLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [nsData, statsData] = await Promise.all([
                getNamespaces().catch(() => []),
                getIdentityStats().catch(() => null)
            ]);
            setNamespaces(nsData);
            setStats(statsData);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (ns) => {
        setSelectedNs(ns);
        setDetailData({ info: ns });
        setDetailLoading(true);

        try {
            const details = await getNamespaceDetails(ns.id);
            setDetailData({ info: details || ns });
        } catch (e) {
            // Use basic info
        } finally {
            setDetailLoading(false);
        }
    };

    const lookupXID = async () => {
        if (!xidId) return;
        setXidLoading(true);
        setXidResult(null);

        try {
            const result = await getXID(xidNamespace, xidId);
            setXidResult(result);
        } catch (e) {
            setXidResult({ error: e.message });
        } finally {
            setXidLoading(false);
        }
    };

    const lookupCluster = async () => {
        if (!clusterXid) return;
        setClusterLoading(true);
        setClusterResult(null);

        try {
            const [members, history] = await Promise.all([
                getClusterMembers(clusterXid).catch(() => null),
                getClusterHistory(clusterXid).catch(() => null)
            ]);
            setClusterResult({ members, history });
        } catch (e) {
            setClusterResult({ error: e.message });
        } finally {
            setClusterLoading(false);
        }
    };

    const filteredNamespaces = namespaces.filter(ns =>
        !search ||
        ns.name?.toLowerCase().includes(search.toLowerCase()) ||
        ns.code?.toLowerCase().includes(search.toLowerCase())
    );

    const mainTabs = [
        { id: 'namespaces', label: 'Namespaces', count: namespaces.length },
        { id: 'xid', label: 'XID Lookup' },
        { id: 'cluster', label: 'Identity Cluster' }
    ];

    return (
        <>
            <div className="page-header">
                <h1>Identity Service</h1>
                <p>Manage identity namespaces and explore identity graphs</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalNamespaces || namespaces.length}</div>
                    <div className="stat-card-label">NAMESPACES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.customNamespaces || 0}</div>
                    <div className="stat-card-label">CUSTOM</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.standardNamespaces || 0}</div>
                    <div className="stat-card-label">STANDARD</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalIdentities?.toLocaleString() || 'N/A'}</div>
                    <div className="stat-card-label">TOTAL IDENTITIES</div>
                </div>
            </div>

            {/* Main Tab Panel */}
            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>

                {/* NAMESPACES TAB */}
                {activeTab === 'namespaces' && (
                    <div>
                        <div style={{ marginBottom: '16px' }}>
                            <input
                                type="text"
                                placeholder="Search namespaces..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    width: '300px', padding: '10px 16px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px', color: 'var(--text-primary)'
                                }}
                            />
                        </div>

                        {loading ? (
                            <LoadingSpinner text="Loading namespaces..." />
                        ) : (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Code</th>
                                            <th>ID</th>
                                            <th>Type</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredNamespaces.map(ns => (
                                            <tr key={ns.id}>
                                                <td style={{ fontWeight: 500 }}>{ns.name}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{ns.code}</td>
                                                <td>{ns.id}</td>
                                                <td>
                                                    <StatusBadge status={ns.custom ? 'custom' : 'standard'} />
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn-secondary"
                                                        style={{ padding: '4px 12px', fontSize: '12px' }}
                                                        onClick={() => openDetail(ns)}
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
                    </div>
                )}

                {/* XID LOOKUP TAB */}
                {activeTab === 'xid' && (
                    <div>
                        <div className="action-bar">
                            <div className="action-bar-left">
                                <select
                                    value={xidNamespace}
                                    onChange={e => setXidNamespace(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    {namespaces.map(ns => (
                                        <option key={ns.code} value={ns.code}>{ns.name} ({ns.code})</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="Enter identity value..."
                                    value={xidId}
                                    onChange={e => setXidId(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && lookupXID()}
                                    style={{
                                        width: '300px', padding: '10px 16px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            <button
                                className="btn-primary"
                                onClick={lookupXID}
                                disabled={xidLoading}
                            >
                                {xidLoading ? 'Looking up...' : 'Get XID'}
                            </button>
                        </div>

                        {xidResult && (
                            <JSONViewer
                                data={xidResult}
                                title="XID Result"
                                formattedContent={
                                    xidResult.error ? (
                                        <div style={{ color: 'var(--accent-red)', padding: '20px' }}>
                                            {xidResult.error}
                                        </div>
                                    ) : (
                                        <div className="detail-grid">
                                            <DetailField label="XID" value={xidResult.xid} mono copyable />
                                            <DetailField label="Namespace" value={xidResult.namespace?.code || xidNamespace} />
                                            <DetailField label="ID" value={xidResult.id || xidId} mono copyable />
                                        </div>
                                    )
                                }
                            />
                        )}
                    </div>
                )}

                {/* CLUSTER TAB */}
                {activeTab === 'cluster' && (
                    <div>
                        <div className="action-bar">
                            <div className="action-bar-left">
                                <input
                                    type="text"
                                    placeholder="Enter XID to explore cluster..."
                                    value={clusterXid}
                                    onChange={e => setClusterXid(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && lookupCluster()}
                                    style={{
                                        width: '400px', padding: '10px 16px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            <button
                                className="btn-primary"
                                onClick={lookupCluster}
                                disabled={clusterLoading}
                            >
                                {clusterLoading ? 'Loading...' : 'Get Cluster'}
                            </button>
                        </div>

                        {clusterResult && (
                            <div style={{ marginTop: '20px' }}>
                                {clusterResult.error ? (
                                    <div style={{ color: 'var(--accent-red)', padding: '20px' }}>
                                        {clusterResult.error}
                                    </div>
                                ) : (
                                    <>
                                        <JSONViewer
                                            data={clusterResult.members}
                                            title={`Cluster Members (${clusterResult.members?.members?.length || 0} identities)`}
                                            formattedContent={
                                                clusterResult.members?.members?.length > 0 ? (
                                                    <div className="file-list">
                                                        {clusterResult.members.members.map((member, i) => (
                                                            <div key={i} className="file-item">
                                                                <div className="file-info">
                                                                    <span className="file-icon">👤</span>
                                                                    <div>
                                                                        <div className="file-name">{member.nsid?.namespace || member.namespace}</div>
                                                                        <div className="file-meta" style={{ fontFamily: 'monospace' }}>
                                                                            {member.xid || member.id}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <CopyButton text={member.xid || member.id} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyState message="No cluster members found" icon="👥" />
                                                )
                                            }
                                        />

                                        {clusterResult.history && (
                                            <JSONViewer
                                                data={clusterResult.history}
                                                title="Cluster History"
                                                defaultView="json"
                                                formattedContent={
                                                    <pre className="json-code">
                                                        {JSON.stringify(clusterResult.history, null, 2)}
                                                    </pre>
                                                }
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </TabPanel>

            {/* Namespace Detail Modal */}
            <Modal
                isOpen={!!selectedNs}
                onClose={() => setSelectedNs(null)}
                title={selectedNs?.name || 'Namespace Details'}
                width="700px"
            >
                {detailLoading ? (
                    <LoadingSpinner />
                ) : (
                    <JSONViewer
                        data={detailData.info || selectedNs}
                        title="Namespace Information"
                        formattedContent={
                            <div className="detail-grid">
                                <DetailField label="ID" value={selectedNs?.id} mono />
                                <DetailField label="Code" value={selectedNs?.code} mono copyable />
                                <DetailField label="Name" value={selectedNs?.name} />
                                <DetailField label="Description" value={selectedNs?.description || 'N/A'} />
                                <DetailField label="Type" value={<StatusBadge status={selectedNs?.custom ? 'custom' : 'standard'} />} />
                                <DetailField label="ID Type" value={selectedNs?.idType} />
                            </div>
                        }
                    />
                )}
            </Modal>
        </>
    );
}
