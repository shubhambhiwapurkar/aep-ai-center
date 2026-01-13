import { useState, useEffect } from 'react';
import {
    getSegments, getSegmentDetails, getSegmentJobs, getExportJobs,
    getSegmentStats, estimateSegment, previewSegment, getSchedules
} from '../services/api';
import { sendAgentMessage } from '../services/agent-api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, ClickableId, CopyButton
} from '../components/SharedComponents';

export default function Segments() {
    const [activeTab, setActiveTab] = useState('segments');
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Detail modal
    const [selectedItem, setSelectedItem] = useState(null);
    const [detailData, setDetailData] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState('info');

    // Estimate/Preview results
    const [estimateResult, setEstimateResult] = useState(null);
    const [previewResult, setPreviewResult] = useState(null);

    // Natural Language Segment Builder
    const [nlInput, setNlInput] = useState('');
    const [showNLBuilder, setShowNLBuilder] = useState(false);
    const [generatedPQL, setGeneratedPQL] = useState(null);
    const [pqlLoading, setPqlLoading] = useState(false);
    const [pqlError, setPqlError] = useState(null);

    // Generate PQL from natural language
    const handleGeneratePQL = async () => {
        if (!nlInput.trim()) return;

        setPqlLoading(true);
        setPqlError(null);
        setGeneratedPQL(null);

        try {
            const response = await sendAgentMessage({
                message: `Generate a PQL expression for: ${nlInput}`,
                context: { page: 'Segments', path: '/segments' }
            });

            // Extract PQL from response
            const content = response.content || response.message || '';

            // Try to find PQL pattern in response
            const pqlMatch = content.match(/```[\s\S]*?```/) || content.match(/select\s+[\s\S]+/i);
            const extractedPQL = pqlMatch ? pqlMatch[0].replace(/```/g, '').trim() : content;

            setGeneratedPQL({
                pql: extractedPQL,
                explanation: content,
                toolsUsed: response.toolsUsed || []
            });
        } catch (error) {
            setPqlError(error.message);
        } finally {
            setPqlLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            let data;

            switch (activeTab) {
                case 'segments':
                    const [segData, statsData] = await Promise.all([
                        getSegments().catch(() => ({ segments: [] })),
                        getSegmentStats().catch(() => null)
                    ]);
                    data = segData?.segments || segData?.children || [];
                    setStats(statsData);
                    break;
                case 'jobs':
                    const jobsData = await getSegmentJobs().catch(() => ({ children: [] }));
                    data = jobsData?.children || [];
                    break;
                case 'exports':
                    const exportsData = await getExportJobs().catch(() => ({ children: [] }));
                    data = exportsData?.children || [];
                    break;
                case 'schedules':
                    const schedulesData = await getSchedules().catch(() => ({ children: [] }));
                    data = schedulesData?.children || [];
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
        setEstimateResult(null);
        setPreviewResult(null);
        setDetailLoading(true);

        try {
            if (activeTab === 'segments') {
                const details = await getSegmentDetails(item.id);
                setDetailData({ info: details || item });
            }
        } catch (e) {
            // Use basic info
        } finally {
            setDetailLoading(false);
        }
    };

    const runEstimate = async () => {
        if (!selectedItem?.id) return;
        setDetailLoading(true);

        try {
            const estimate = await estimateSegment(selectedItem.id);
            setEstimateResult(estimate);
        } catch (e) {
            setEstimateResult({ error: e.message });
        } finally {
            setDetailLoading(false);
        }
    };

    const runPreview = async () => {
        if (!selectedItem?.id) return;
        setDetailLoading(true);

        try {
            const preview = await previewSegment(selectedItem.expression?.value || '');
            setPreviewResult(preview);
        } catch (e) {
            setPreviewResult({ error: e.message });
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
        { id: 'segments', label: 'Segments', count: stats?.total || items.length },
        { id: 'jobs', label: 'Evaluation Jobs' },
        { id: 'exports', label: 'Export Jobs' },
        { id: 'schedules', label: 'Schedules' }
    ];

    const detailTabs = [
        { id: 'info', label: 'Info' },
        { id: 'expression', label: 'Expression' },
        { id: 'estimate', label: 'Estimate' }
    ];

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>Segmentation</h1>
                        <p>Manage audience segments and evaluation jobs</p>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => setShowNLBuilder(!showNLBuilder)}
                    >
                        ✨ Create from Description
                    </button>
                </div>
            </div>

            {/* Natural Language Segment Builder */}
            {showNLBuilder && (
                <div className="card" style={{ marginBottom: '24px', background: 'var(--accent-purple-glow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '20px' }}>✨</span>
                        <div>
                            <div style={{ fontWeight: 600 }}>Create Segment from Natural Language</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Describe your audience and AI will generate the PQL expression
                            </div>
                        </div>
                        <button
                            onClick={() => setShowNLBuilder(false)}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            placeholder="e.g., Users who purchased in the last 30 days but haven't returned..."
                            value={nlInput}
                            onChange={(e) => setNlInput(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '14px'
                            }}
                        />
                        <button
                            className="btn-primary"
                            onClick={handleGeneratePQL}
                            disabled={!nlInput.trim() || pqlLoading}
                        >
                            {pqlLoading ? '⏳ Generating...' : '✨ Generate PQL'}
                        </button>
                    </div>

                    {/* Error */}
                    {pqlError && (
                        <div style={{
                            marginTop: '12px', padding: '12px',
                            background: 'rgba(239,68,68,0.15)', borderRadius: '8px',
                            color: 'var(--accent-red)', fontSize: '13px'
                        }}>
                            ❌ {pqlError}
                        </div>
                    )}

                    {/* Generated PQL Result */}
                    {generatedPQL && (
                        <div style={{ marginTop: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--accent-green)' }}>✅</span>
                                <span style={{ fontWeight: 600 }}>Generated PQL Expression:</span>
                                <CopyButton text={generatedPQL.pql} />
                            </div>
                            <div style={{
                                padding: '12px', background: 'var(--bg-primary)',
                                borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px',
                                border: '1px solid var(--accent-green)', whiteSpace: 'pre-wrap'
                            }}>
                                {generatedPQL.pql}
                            </div>
                            {generatedPQL.toolsUsed?.length > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                    🔧 Tools used: {generatedPQL.toolsUsed.join(', ')}
                                </div>
                            )}
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        // Copy PQL and show success
                                        navigator.clipboard.writeText(generatedPQL.pql);
                                        alert('PQL copied! You can now use this in the AEP Segment Builder.');
                                    }}
                                >
                                    📋 Copy & Use in AEP
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setGeneratedPQL(null)}
                                >
                                    🔄 Generate Another
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Examples: "Gold loyalty members" • "Users with email who were active last week" • "High value customers over $1000"
                    </div>
                </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.total || items.length}</div>
                    <div className="stat-card-label">SEGMENTS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.evaluationJobs || 0}</div>
                    <div className="stat-card-label">EVAL JOBS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.exportJobs || 0}</div>
                    <div className="stat-card-label">EXPORT JOBS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>{stats?.completed || 0}</div>
                    <div className="stat-card-label">COMPLETED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.queued || 0}</div>
                    <div className="stat-card-label">QUEUED</div>
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
                                    <th>Status</th>
                                    <th>Type</th>
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
                                            <StatusBadge status={item.lifecycleState || item.status || item.state} />
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {item.expression?.type || item.type || '-'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 10px', fontSize: '12px' }}
                                                    onClick={() => openDetail(item)}
                                                >
                                                    Details
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent-yellow)' }}
                                                    onClick={() => {
                                                        alert(`Would call debug_segment with: "${item.id}"\n\nOpen the Agent Panel (🤖) and try: "Debug segment ${item.id}"`);
                                                    }}
                                                    title="Debug this segment"
                                                >
                                                    🐛 Debug
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState message={`No ${activeTab} found`} icon="🎯" />
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
                title={selectedItem?.name || 'Segment Details'}
                width="900px"
            >
                <TabPanel
                    tabs={activeTab === 'segments' ? detailTabs : [{ id: 'info', label: 'Info' }]}
                    activeTab={detailTab}
                    onTabChange={setDetailTab}
                >
                    {detailLoading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            {/* INFO TAB */}
                            {detailTab === 'info' && (
                                <JSONViewer
                                    data={detailData.info || selectedItem}
                                    title="Segment Information"
                                    formattedContent={
                                        <div>
                                            <div className="detail-grid">
                                                <DetailField label="Segment ID" value={selectedItem?.id} mono copyable />
                                                <DetailField label="Name" value={selectedItem?.name} />
                                                <DetailField
                                                    label="Status"
                                                    value={<StatusBadge status={selectedItem?.lifecycleState || selectedItem?.status} />}
                                                />
                                                <DetailField label="Expression Type" value={selectedItem?.expression?.type} />
                                                <DetailField label="Schema" value={selectedItem?.schema?.name} />
                                                <DetailField label="Merge Policy" value={selectedItem?.mergePolicyId} mono />
                                                <DetailField label="Created" value={formatDate(selectedItem?.creationTime)} />
                                                <DetailField label="Updated" value={formatDate(selectedItem?.updateTime)} />
                                            </div>

                                            {/* Action buttons */}
                                            {activeTab === 'segments' && (
                                                <div className="action-bar" style={{ marginTop: '20px' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Actions:</span>
                                                    <div className="action-bar-right">
                                                        <button className="btn-secondary" onClick={runEstimate}>
                                                            Estimate Size
                                                        </button>
                                                        <button className="btn-secondary" onClick={runPreview}>
                                                            Preview
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Estimate Result */}
                                            {estimateResult && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <JSONViewer
                                                        data={estimateResult}
                                                        title="Segment Estimate"
                                                        formattedContent={
                                                            estimateResult.error ? (
                                                                <div style={{ color: 'var(--accent-red)' }}>{estimateResult.error}</div>
                                                            ) : (
                                                                <div className="detail-grid">
                                                                    <DetailField label="Estimated Size" value={estimateResult.estimatedSize?.toLocaleString()} />
                                                                    <DetailField label="Confidence" value={estimateResult.confidenceInterval} />
                                                                </div>
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}

                                            {/* Preview Result */}
                                            {previewResult && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <JSONViewer
                                                        data={previewResult}
                                                        title="Segment Preview"
                                                        defaultView="json"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    }
                                />
                            )}

                            {/* EXPRESSION TAB */}
                            {detailTab === 'expression' && (
                                <JSONViewer
                                    data={selectedItem?.expression || {}}
                                    title="Segment Expression (PQL)"
                                    formattedContent={
                                        <div>
                                            <div className="action-bar" style={{ marginBottom: '16px' }}>
                                                <span>Profile Query Language (PQL)</span>
                                                <CopyButton
                                                    text={selectedItem?.expression?.value || ''}
                                                    label="Copy Expression"
                                                />
                                            </div>
                                            <pre
                                                style={{
                                                    background: 'var(--bg-primary)',
                                                    padding: '16px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    color: 'var(--accent-cyan)'
                                                }}
                                            >
                                                {selectedItem?.expression?.value || 'No expression defined'}
                                            </pre>
                                        </div>
                                    }
                                />
                            )}

                            {/* ESTIMATE TAB */}
                            {detailTab === 'estimate' && (
                                <div>
                                    <div className="action-bar">
                                        <span>Run segment estimate to see audience size</span>
                                        <button
                                            className="btn-primary"
                                            onClick={runEstimate}
                                            disabled={detailLoading}
                                        >
                                            {detailLoading ? 'Running...' : 'Run Estimate'}
                                        </button>
                                    </div>

                                    {estimateResult && (
                                        <JSONViewer
                                            data={estimateResult}
                                            title="Estimate Result"
                                            formattedContent={
                                                estimateResult.error ? (
                                                    <div style={{ color: 'var(--accent-red)', padding: '20px' }}>
                                                        {estimateResult.error}
                                                    </div>
                                                ) : (
                                                    <div className="detail-grid" style={{ padding: '20px' }}>
                                                        <DetailField label="Estimated Size" value={estimateResult.estimatedSize?.toLocaleString()} />
                                                        <DetailField label="Confidence Interval" value={estimateResult.confidenceInterval} />
                                                        <DetailField label="State" value={<StatusBadge status={estimateResult.state} />} />
                                                    </div>
                                                )
                                            }
                                        />
                                    )}

                                    {!estimateResult && !detailLoading && (
                                        <EmptyState message="Click 'Run Estimate' to get the segment size" icon="📊" />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </TabPanel>
            </Modal>
        </>
    );
}
