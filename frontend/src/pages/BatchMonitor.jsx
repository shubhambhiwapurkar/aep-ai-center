import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    getBatches, getBatchDetails, getFailedRecords,
    getBatchMeta, getBatchFiles, getBatchStats, getBatchTimeline
} from '../services/api';
import { sendAgentMessage } from '../services/agent-api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, ClickableId
} from '../components/SharedComponents';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BatchMonitor() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [batches, setBatches] = useState([]);
    const [stats, setStats] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [timeRange, setTimeRange] = useState('24h');

    // Detail modal state
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    const [detailData, setDetailData] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);

    // AI Error Analysis
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [aiError, setAiError] = useState(null);

    const runAIAnalysis = async (batchId) => {
        setAiAnalyzing(true);
        setAiError(null);
        setAiAnalysis(null);

        try {
            const response = await sendAgentMessage({
                message: `Analyze the errors in batch ${batchId}`,
                context: { page: 'BatchMonitor', path: '/batches' }
            });

            setAiAnalysis({
                content: response.content || response.message,
                data: response.data,
                toolsUsed: response.toolsUsed || []
            });
        } catch (error) {
            setAiError(error.message);
        } finally {
            setAiAnalyzing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filter, timeRange]);

    // Open batch from URL param
    useEffect(() => {
        const batchId = searchParams.get('id');
        if (batchId && batches.length > 0) {
            const batch = batches.find(b => b.id === batchId);
            if (batch) openDetail(batch);
        }
    }, [searchParams, batches]);

    const loadData = async () => {
        try {
            setLoading(true);
            const filters = filter !== 'all' ? { status: filter } : {};
            const [batchData, statsData, timelineData] = await Promise.all([
                getBatches(filters).catch(() => ({})),
                getBatchStats(timeRange).catch(() => null),
                getBatchTimeline(timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 6).catch(() => [])
            ]);
            const batchList = Object.entries(batchData).map(([id, batch]) => ({ id, ...batch }));
            setBatches(batchList);
            setStats(statsData);
            setTimeline(timelineData);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (batch) => {
        setSelectedBatch(batch);
        setActiveTab('info');
        setDetailData({});
        setDetailLoading(true);
        setAiAnalysis(null);
        setAiError(null);

        try {
            const details = await getBatchDetails(batch.id);
            setDetailData({ info: details || batch });

            // Auto-analyze failed batches
            if (batch.status === 'failed' || details?.status === 'failed') {
                runAIAnalysis(batch.id);
            }
        } catch (e) {
            setDetailData({ info: batch });
        } finally {
            setDetailLoading(false);
        }
    };

    const loadTabData = async (tab) => {
        setActiveTab(tab);
        if (detailData[tab]) return;

        setDetailLoading(true);
        try {
            let data;
            switch (tab) {
                case 'failed':
                    data = await getFailedRecords(selectedBatch.id);
                    break;
                case 'meta':
                    data = await getBatchMeta(selectedBatch.id);
                    break;
                case 'files':
                    data = await getBatchFiles(selectedBatch.id);
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

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    const formatNumber = (num) => (num || 0).toLocaleString();

    const tabs = [
        { id: 'info', label: 'Info' },
        { id: 'failed', label: 'Failed Records' },
        { id: 'meta', label: 'Metadata' },
        { id: 'files', label: 'Files' }
    ];

    return (
        <>
            <div className="page-header">
                <h1>Batch Monitor</h1>
                <p>Monitor batch ingestion status and performance</p>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.total || batches.length}</div>
                    <div className="stat-card-label">TOTAL BATCHES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>{stats?.success || 0}</div>
                    <div className="stat-card-label">SUCCESS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-red)' }}>{stats?.failed || 0}</div>
                    <div className="stat-card-label">FAILED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-yellow)' }}>{stats?.active || 0}</div>
                    <div className="stat-card-label">ACTIVE</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.successRate || 100}%</div>
                    <div className="stat-card-label">SUCCESS RATE</div>
                </div>
            </div>

            {/* Timeline Chart */}
            {timeline.length > 0 && (
                <div className="chart-section" style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>Batch Activity Timeline</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={timeline}>
                            <defs>
                                <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2ecc71" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#2ecc71" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#e74c3c" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }} />
                            <Area type="monotone" dataKey="success" stroke="#2ecc71" fill="url(#successGrad)" />
                            <Area type="monotone" dataKey="failed" stroke="#e74c3c" fill="url(#failedGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {['all', 'success', 'failed', 'active'].map(f => (
                    <button
                        key={f}
                        className={`dropdown-btn ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    {['6h', '24h', '7d'].map(t => (
                        <button
                            key={t}
                            className={`dropdown-btn ${timeRange === t ? 'active' : ''}`}
                            onClick={() => setTimeRange(t)}
                        >
                            {t}
                        </button>
                    ))}
                    <button className="btn-secondary" onClick={loadData}>Refresh</button>
                </div>
            </div>

            {/* Batches Table */}
            <div className="chart-section" style={{ padding: 0 }}>
                {loading ? (
                    <LoadingSpinner text="Loading batches..." />
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Status</th>
                                <th>Records</th>
                                <th>Failed</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.slice(0, 50).map(batch => (
                                <tr key={batch.id}>
                                    <td>
                                        <ClickableId
                                            id={batch.id}
                                            onClick={() => openDetail(batch)}
                                            maxLength={20}
                                        />
                                    </td>
                                    <td><StatusBadge status={batch.status} /></td>
                                    <td>{formatNumber(batch.recordCount)}</td>
                                    <td style={{ color: batch.failedRecordCount > 0 ? 'var(--accent-red)' : 'inherit' }}>
                                        {formatNumber(batch.failedRecordCount)}
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                        {formatDate(batch.created)}
                                    </td>
                                    <td>
                                        <button
                                            className="btn-secondary"
                                            style={{ padding: '4px 12px', fontSize: '12px' }}
                                            onClick={() => openDetail(batch)}
                                        >
                                            Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {batches.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        No batches found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedBatch}
                onClose={() => setSelectedBatch(null)}
                title="Batch Details"
                width="900px"
            >
                <TabPanel
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={loadTabData}
                >
                    {detailLoading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            {/* INFO TAB */}
                            {activeTab === 'info' && (
                                <JSONViewer
                                    data={detailData.info || selectedBatch}
                                    title="Batch Information"
                                    formattedContent={
                                        <div>
                                            <div className="detail-grid">
                                                <DetailField
                                                    label="Batch ID"
                                                    value={selectedBatch?.id}
                                                    mono
                                                    copyable
                                                />
                                                <DetailField
                                                    label="Status"
                                                    value={<StatusBadge status={selectedBatch?.status} />}
                                                />
                                                <DetailField
                                                    label="Records Ingested"
                                                    value={formatNumber(selectedBatch?.recordCount)}
                                                />
                                                <DetailField
                                                    label="Failed Records"
                                                    value={
                                                        <span style={{ color: selectedBatch?.failedRecordCount > 0 ? 'var(--accent-red)' : 'inherit' }}>
                                                            {formatNumber(selectedBatch?.failedRecordCount)}
                                                        </span>
                                                    }
                                                />
                                                <DetailField
                                                    label="Created"
                                                    value={formatDate(selectedBatch?.created)}
                                                />
                                                <DetailField
                                                    label="Updated"
                                                    value={formatDate(selectedBatch?.updated)}
                                                />
                                                {selectedBatch?.datasetId && (
                                                    <DetailField
                                                        label="Dataset"
                                                        value={
                                                            <ClickableId
                                                                id={selectedBatch.datasetId}
                                                                onClick={() => navigate(`/datasets?id=${selectedBatch.datasetId}`)}
                                                            />
                                                        }
                                                    />
                                                )}
                                            </div>

                                            {/* Action buttons for batch operations */}
                                            {selectedBatch?.status === 'active' && (
                                                <div className="action-bar" style={{ marginTop: '20px' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Batch Actions:</span>
                                                    <div className="action-bar-right">
                                                        <button className="btn-secondary">Complete Batch</button>
                                                        <button className="btn-secondary" style={{ color: 'var(--accent-red)' }}>Abort Batch</button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Analysis for failed batches */}
                                            {(selectedBatch?.status === 'failed' || selectedBatch?.failedRecordCount > 0) && (
                                                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--accent-purple-glow)', borderRadius: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '18px' }}>🔍</span>
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>AI Error Diagnosis</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                Let AI analyze the errors and provide human-readable explanations
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn-primary"
                                                            onClick={() => runAIAnalysis(selectedBatch.id)}
                                                            disabled={aiAnalyzing}
                                                            style={{ marginLeft: 'auto' }}
                                                        >
                                                            {aiAnalyzing ? '⏳ Analyzing...' : '🤖 Analyze Errors'}
                                                        </button>
                                                    </div>

                                                    {/* AI Error */}
                                                    {aiError && (
                                                        <div style={{
                                                            padding: '12px', background: 'rgba(239,68,68,0.15)',
                                                            borderRadius: '8px', color: 'var(--accent-red)', fontSize: '13px'
                                                        }}>
                                                            ❌ {aiError}
                                                        </div>
                                                    )}

                                                    {/* AI Analysis Result */}
                                                    {aiAnalysis && (
                                                        <div style={{
                                                            padding: '16px', background: 'var(--bg-primary)',
                                                            borderRadius: '8px', border: '1px solid var(--accent-green)'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                                <span style={{ color: 'var(--accent-green)' }}>✅</span>
                                                                <span style={{ fontWeight: 600 }}>Analysis Complete</span>
                                                                {aiAnalysis.toolsUsed?.length > 0 && (
                                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                                        🔧 {aiAnalysis.toolsUsed.join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.6 }}>
                                                                {aiAnalysis.content}
                                                            </div>

                                                            {aiAnalysis.data?.findings?.length > 0 && (
                                                                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                                                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>Key Findings:</div>
                                                                    {aiAnalysis.data.findings.map((finding, i) => (
                                                                        <div key={i} style={{
                                                                            padding: '8px 12px', marginBottom: '8px',
                                                                            background: 'var(--bg-secondary)', borderRadius: '6px',
                                                                            borderLeft: '3px solid var(--accent-yellow)'
                                                                        }}>
                                                                            <div style={{ fontWeight: 500 }}>{finding.finding}</div>
                                                                            {finding.recommendation && (
                                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                                                    💡 {finding.recommendation}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    }
                                />
                            )}

                            {/* FAILED RECORDS TAB */}
                            {activeTab === 'failed' && (
                                <JSONViewer
                                    data={detailData.failed || {}}
                                    title="Failed Records"
                                    formattedContent={
                                        detailData.failed?.records?.length > 0 ? (
                                            <div>
                                                <div style={{ marginBottom: '16px', color: 'var(--accent-red)' }}>
                                                    {detailData.failed.records.length} failed record(s) found
                                                </div>
                                                {detailData.failed.records.slice(0, 10).map((record, i) => (
                                                    <div key={i} className="file-item" style={{ marginBottom: '8px' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>Record {i + 1}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--accent-red)' }}>
                                                                {record.error || record.message || 'Unknown error'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message="No failed records" icon="✅" />
                                        )
                                    }
                                />
                            )}

                            {/* META TAB */}
                            {activeTab === 'meta' && (
                                <JSONViewer
                                    data={detailData.meta || {}}
                                    title="Batch Metadata"
                                    formattedContent={
                                        <div className="detail-grid">
                                            <DetailField label="Format" value={detailData.meta?.inputFormat || 'N/A'} />
                                            <DetailField label="Source" value={detailData.meta?.source?.type || 'N/A'} />
                                            <DetailField label="Encoding" value={detailData.meta?.encoding || 'N/A'} />
                                        </div>
                                    }
                                />
                            )}

                            {/* FILES TAB */}
                            {activeTab === 'files' && (
                                <JSONViewer
                                    data={detailData.files || {}}
                                    title="Batch Files"
                                    formattedContent={
                                        detailData.files?.data?.length > 0 ? (
                                            <div className="file-list">
                                                {detailData.files.data.map((file, i) => (
                                                    <div key={i} className="file-item">
                                                        <div className="file-info">
                                                            <span className="file-icon">📄</span>
                                                            <div>
                                                                <div className="file-name">{file.name || `File ${i + 1}`}</div>
                                                                <div className="file-meta">{file.length ? `${(file.length / 1024).toFixed(2)} KB` : ''}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message="No files found for this batch" icon="📁" />
                                        )
                                    }
                                />
                            )}
                        </>
                    )}
                </TabPanel>
            </Modal>
        </>
    );
}
