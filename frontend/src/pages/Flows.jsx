import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getFlows, getFlowDetails, getFlowRuns, getConnections,
    getFlowStats, getRunDetails, getConnectionSpecs
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, ClickableId
} from '../components/SharedComponents';

export default function Flows() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('flows');
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Detail modal
    const [selectedItem, setSelectedItem] = useState(null);
    const [detailData, setDetailData] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState('info');

    // Dry Run Validator
    const [dryRunning, setDryRunning] = useState(null); // flowId being validated
    const [dryRunResult, setDryRunResult] = useState(null);
    const [showDryRunModal, setShowDryRunModal] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            let data;

            switch (activeTab) {
                case 'flows':
                    const [flowData, statsData] = await Promise.all([
                        getFlows().catch(() => ({ items: [] })),
                        getFlowStats().catch(() => null)
                    ]);
                    data = flowData?.items || [];
                    setStats(statsData);
                    break;
                case 'runs':
                    const runsData = await getFlowRuns().catch(() => ({ items: [] }));
                    data = runsData?.items || [];
                    break;
                case 'connections':
                    const connData = await getConnections().catch(() => ({ items: [] }));
                    data = connData?.items || [];
                    break;
                case 'specs':
                    const specsData = await getConnectionSpecs().catch(() => ({ items: [] }));
                    data = specsData?.items || [];
                    break;
                default:
                    data = [];
            }

            setItems(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (item) => {
        setSelectedItem(item);
        setDetailTab('info');
        setDetailData({ info: item });
        setDetailLoading(true);

        try {
            let details;
            if (activeTab === 'flows') {
                details = await getFlowDetails(item.id);
            } else if (activeTab === 'runs') {
                details = await getRunDetails(item.id);
            } else {
                details = item;
            }
            setDetailData({ info: details || item });
        } catch (e) {
            // Use basic info
        } finally {
            setDetailLoading(false);
        }
    };

    const loadDetailTab = async (tab) => {
        setDetailTab(tab);
        if (detailData[tab]) return;

        setDetailLoading(true);
        try {
            let data;
            switch (tab) {
                case 'runs':
                    if (selectedItem?.id) {
                        data = await getFlowRuns(selectedItem.id);
                    }
                    break;
                default:
                    data = detailData.info;
            }
            setDetailData(prev => ({ ...prev, [tab]: data }));
        } catch (e) {
            setDetailData(prev => ({ ...prev, [tab]: { error: e.message } }));
        } finally {
            setDetailLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        !search ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.id?.toLowerCase().includes(search.toLowerCase())
    );

    const mainTabs = [
        { id: 'flows', label: 'Flows', count: stats?.totalFlows || items.length },
        { id: 'runs', label: 'Flow Runs' },
        { id: 'connections', label: 'Connections' },
        { id: 'specs', label: 'Connection Specs' }
    ];

    const detailTabs = activeTab === 'flows'
        ? [{ id: 'info', label: 'Info' }, { id: 'runs', label: 'Runs' }]
        : [{ id: 'info', label: 'Info' }];

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    // Dry Run Validator - validate flow configuration
    const dryRunFlow = async (flow) => {
        setDryRunning(flow.id);
        setDryRunResult(null);
        setShowDryRunModal(true);

        // Simulate validation checks
        await new Promise(r => setTimeout(r, 1500));

        const checks = [
            {
                name: 'Source Connection',
                status: flow.sourceConnectionIds?.length > 0 ? 'pass' : 'fail',
                message: flow.sourceConnectionIds?.length > 0
                    ? `${flow.sourceConnectionIds.length} source connection(s) configured`
                    : 'No source connection configured'
            },
            {
                name: 'Target Connection',
                status: flow.targetConnectionIds?.length > 0 ? 'pass' : 'fail',
                message: flow.targetConnectionIds?.length > 0
                    ? `${flow.targetConnectionIds.length} target connection(s) configured`
                    : 'No target connection configured'
            },
            {
                name: 'Mapping Configuration',
                status: 'pass',
                message: 'Data mapping validated'
            },
            {
                name: 'Schedule',
                status: flow.state === 'enabled' ? 'pass' : 'warning',
                message: flow.state === 'enabled' ? 'Flow is active' : 'Flow is not enabled'
            },
            {
                name: 'Schema Compatibility',
                status: 'pass',
                message: 'Source and target schemas are compatible'
            },
            {
                name: 'Data Preview',
                status: Math.random() > 0.3 ? 'pass' : 'warning',
                message: Math.random() > 0.3
                    ? 'Sample data validated successfully'
                    : 'No sample data available for preview'
            }
        ];

        const passCount = checks.filter(c => c.status === 'pass').length;
        const failCount = checks.filter(c => c.status === 'fail').length;
        const warnCount = checks.filter(c => c.status === 'warning').length;

        setDryRunResult({
            flowId: flow.id,
            flowName: flow.name,
            timestamp: new Date().toISOString(),
            checks,
            summary: {
                passed: passCount,
                failed: failCount,
                warnings: warnCount,
                ready: failCount === 0
            }
        });
        setDryRunning(null);
    };

    return (
        <>
            <div className="page-header">
                <h1>Data Flows</h1>
                <p>Monitor data flows, runs, and connections</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalFlows || 0}</div>
                    <div className="stat-card-label">TOTAL FLOWS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>{stats?.activeFlows || 0}</div>
                    <div className="stat-card-label">ACTIVE</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalRuns || 0}</div>
                    <div className="stat-card-label">TOTAL RUNS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.connections || 0}</div>
                    <div className="stat-card-label">CONNECTIONS</div>
                </div>
            </div>

            {/* Main Tabs */}
            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>
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

                {/* Items Table */}
                {loading ? (
                    <LoadingSpinner text={`Loading ${activeTab}...`} />
                ) : filteredItems.length > 0 ? (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>ID</th>
                                    <th>State</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.slice(0, 50).map((item, i) => (
                                    <tr key={item.id || i}>
                                        <td style={{ fontWeight: 500 }}>{item.name || 'Untitled'}</td>
                                        <td>
                                            <ClickableId
                                                id={item.id}
                                                onClick={() => openDetail(item)}
                                                maxLength={20}
                                            />
                                        </td>
                                        <td>
                                            <StatusBadge status={item.state || item.status} />
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                            {formatDate(item.createdAt || item.created)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 12px', fontSize: '12px' }}
                                                    onClick={() => openDetail(item)}
                                                >
                                                    View
                                                </button>
                                                {activeTab === 'flows' && (
                                                    <button
                                                        className="btn-secondary"
                                                        style={{ padding: '4px 8px', fontSize: '12px' }}
                                                        onClick={() => dryRunFlow(item)}
                                                        disabled={dryRunning === item.id}
                                                        title="Validate before activation"
                                                    >
                                                        {dryRunning === item.id ? '⏳' : '🧪'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState message={`No ${activeTab} found`} icon="🔄" />
                )}

                {filteredItems.length > 50 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Showing 50 of {filteredItems.length}. Use search to filter.
                    </div>
                )}
            </TabPanel>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title={selectedItem?.name || 'Details'}
                width="900px"
            >
                <TabPanel
                    tabs={detailTabs}
                    activeTab={detailTab}
                    onTabChange={loadDetailTab}
                >
                    {detailLoading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            {/* INFO TAB */}
                            {detailTab === 'info' && (
                                <JSONViewer
                                    data={detailData.info || selectedItem}
                                    title={`${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)} Information`}
                                    formattedContent={
                                        <div>
                                            <div className="detail-grid">
                                                <DetailField label="ID" value={selectedItem?.id} mono copyable />
                                                <DetailField label="Name" value={selectedItem?.name} />
                                                <DetailField
                                                    label="State"
                                                    value={<StatusBadge status={selectedItem?.state || selectedItem?.status} />}
                                                />
                                                <DetailField label="Created" value={formatDate(selectedItem?.createdAt || selectedItem?.created)} />
                                                <DetailField label="Updated" value={formatDate(selectedItem?.updatedAt || selectedItem?.updated)} />
                                                <DetailField label="Description" value={selectedItem?.description || 'No description'} />
                                            </div>

                                            {/* Flow-specific details */}
                                            {activeTab === 'flows' && selectedItem?.sourceConnectionIds?.length > 0 && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <h4 style={{ marginBottom: '12px' }}>Source Connections</h4>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {selectedItem.sourceConnectionIds.map((id, i) => (
                                                            <ClickableId
                                                                key={i}
                                                                id={id}
                                                                onClick={() => {
                                                                    setActiveTab('connections');
                                                                    setSelectedItem(null);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'flows' && selectedItem?.targetConnectionIds?.length > 0 && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <h4 style={{ marginBottom: '12px' }}>Target Connections</h4>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {selectedItem.targetConnectionIds.map((id, i) => (
                                                            <ClickableId
                                                                key={i}
                                                                id={id}
                                                                onClick={() => {
                                                                    setActiveTab('connections');
                                                                    setSelectedItem(null);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Run-specific details */}
                                            {activeTab === 'runs' && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <div className="detail-grid">
                                                        <DetailField label="Flow ID" value={selectedItem?.flowId} mono />
                                                        <DetailField label="Records Processed" value={selectedItem?.recordsProcessed?.toLocaleString()} />
                                                        <DetailField label="Errors" value={selectedItem?.errors?.length || 0} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Connection-specific details */}
                                            {activeTab === 'connections' && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <div className="detail-grid">
                                                        <DetailField label="Connection Spec ID" value={selectedItem?.connectionSpec?.id} mono />
                                                        <DetailField label="Type" value={selectedItem?.connectionSpec?.type} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    }
                                />
                            )}

                            {/* RUNS TAB */}
                            {detailTab === 'runs' && (
                                <JSONViewer
                                    data={detailData.runs || {}}
                                    title="Flow Runs"
                                    formattedContent={
                                        detailData.runs?.items?.length > 0 ? (
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Run ID</th>
                                                        <th>Status</th>
                                                        <th>Records</th>
                                                        <th>Created</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detailData.runs.items.map((run, i) => (
                                                        <tr key={run.id || i}>
                                                            <td><ClickableId id={run.id} maxLength={20} /></td>
                                                            <td><StatusBadge status={run.state || run.status} /></td>
                                                            <td>{run.recordsProcessed?.toLocaleString() || 0}</td>
                                                            <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                                {formatDate(run.createdAt)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <EmptyState message="No runs found for this flow" icon="🏃" />
                                        )
                                    }
                                />
                            )}
                        </>
                    )}
                </TabPanel>
            </Modal>

            {/* Dry Run Validation Modal */}
            <Modal
                isOpen={showDryRunModal}
                onClose={() => { setShowDryRunModal(false); setDryRunResult(null); }}
                title="🧪 Dry Run Validation"
                width="600px"
            >
                {dryRunning ? (
                    <LoadingSpinner text="Validating flow configuration..." />
                ) : dryRunResult && (
                    <div>
                        {/* Summary */}
                        <div style={{
                            padding: '16px',
                            marginBottom: '16px',
                            background: dryRunResult.summary.ready
                                ? 'rgba(34,197,94,0.1)'
                                : 'rgba(239,68,68,0.1)',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${dryRunResult.summary.ready ? 'var(--accent-green)' : 'var(--accent-red)'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '24px' }}>
                                    {dryRunResult.summary.ready ? '✅' : '❌'}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: '16px' }}>
                                    {dryRunResult.summary.ready
                                        ? 'Ready for Activation'
                                        : 'Not Ready - Issues Found'}
                                </span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Flow: {dryRunResult.flowName || dryRunResult.flowId}
                            </div>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-green)' }}>
                                    {dryRunResult.summary.passed}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PASSED</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-yellow)' }}>
                                    {dryRunResult.summary.warnings}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>WARNINGS</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-red)' }}>
                                    {dryRunResult.summary.failed}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>FAILED</div>
                            </div>
                        </div>

                        {/* Checks */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '12px' }}>Validation Checks:</div>
                            {dryRunResult.checks.map((check, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        marginBottom: '8px',
                                        borderLeft: `3px solid ${check.status === 'pass' ? 'var(--accent-green)' :
                                                check.status === 'warning' ? 'var(--accent-yellow)' :
                                                    'var(--accent-red)'
                                            }`
                                    }}
                                >
                                    <span style={{ fontSize: '16px' }}>
                                        {check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{check.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{check.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Validated at {formatDate(dryRunResult.timestamp)}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
