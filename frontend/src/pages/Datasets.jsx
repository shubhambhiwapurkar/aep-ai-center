import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    getAllDatasets, getDatasetStats, getDatasetDetails,
    getDatasetLabels, getDatasetFiles, getDatasetBatches,
    previewFile, downloadFile
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, CopyButton, ClickableId
} from '../components/SharedComponents';

export default function Datasets() {
    const navigate = useNavigate();
    const [datasets, setDatasets] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDataset, setSelectedDataset] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Detail view state
    const [activeTab, setActiveTab] = useState('info');
    const [detailData, setDetailData] = useState({});
    const [filePreview, setFilePreview] = useState(null);

    // Bulk operations state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkProcessing, setBulkProcessing] = useState(false);

    useEffect(() => {
        loadDatasets();
    }, []);

    const loadDatasets = async () => {
        try {
            setLoading(true);
            const [data, statsData] = await Promise.all([
                getAllDatasets().catch(() => ({})),
                getDatasetStats().catch(() => null)
            ]);
            const datasetList = Object.entries(data).map(([id, ds]) => ({ id, ...ds }));
            setDatasets(datasetList);
            setStats(statsData);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (dataset) => {
        setSelectedDataset(dataset);
        setActiveTab('info');
        setDetailData({});
        setFilePreview(null);
        setDetailLoading(true);

        try {
            const details = await getDatasetDetails(dataset.id);
            setDetailData({ info: details });
        } catch (e) {
            setDetailData({ info: dataset });
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
                case 'labels':
                    data = await getDatasetLabels(selectedDataset.id);
                    break;
                case 'files':
                    data = await getDatasetFiles(selectedDataset.id);
                    break;
                case 'batches':
                    data = await getDatasetBatches(selectedDataset.id);
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

    const handlePreviewFile = async (fileId) => {
        try {
            const preview = await previewFile(fileId);
            setFilePreview({ id: fileId, data: preview });
        } catch (e) {
            setFilePreview({ id: fileId, error: e.message });
        }
    };

    const handleDownloadFile = async (fileId) => {
        try {
            const result = await downloadFile(fileId);
            // Open download link if available
            if (result.href) {
                window.open(result.href, '_blank');
            }
        } catch (e) {
            console.error('Download error:', e);
        }
    };

    const filteredDatasets = datasets.filter(ds =>
        !search ||
        ds.name?.toLowerCase().includes(search.toLowerCase()) ||
        ds.id?.toLowerCase().includes(search.toLowerCase())
    );

    const tabs = [
        { id: 'info', label: 'Info' },
        { id: 'labels', label: 'Labels' },
        { id: 'files', label: 'Files' },
        { id: 'batches', label: 'Batches' }
    ];

    // Extract files from response
    const getFilesArray = (filesData) => {
        if (!filesData) return [];
        if (filesData.data) return filesData.data;
        if (Array.isArray(filesData)) return filesData;
        return Object.entries(filesData).map(([id, file]) => ({ id, ...file }));
    };

    // Extract batches from response
    const getBatchesArray = (batchesData) => {
        if (!batchesData) return [];
        if (Array.isArray(batchesData)) return batchesData;
        return Object.entries(batchesData).map(([id, batch]) => ({ id, ...batch }));
    };

    // Bulk operations handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredDatasets.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredDatasets.map(ds => ds.id)));
        }
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBulkAction = async (action) => {
        if (selectedIds.size === 0) return;
        setBulkProcessing(true);

        try {
            const ids = Array.from(selectedIds);
            // In real implementation, call backend bulk endpoints
            // await bulkOperation(action, ids);
            alert(`${action} for ${ids.length} datasets - This would call backend bulk API`);
            setSelectedIds(new Set());
        } catch (e) {
            console.error('Bulk operation failed', e);
        } finally {
            setBulkProcessing(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <h1>Datasets</h1>
                <p>Manage and monitor your datasets ({stats?.total || datasets.length} total)</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.total || datasets.length}</div>
                    <div className="stat-card-label">TOTAL DATASETS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.enabledForProfile || 0}</div>
                    <div className="stat-card-label">PROFILE ENABLED</div>
                    <div className="stat-card-sub success">Real-time Customer Profile</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.enabledForIdentity || 0}</div>
                    <div className="stat-card-label">IDENTITY ENABLED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{Object.keys(stats?.byState || {}).length}</div>
                    <div className="stat-card-label">STATES</div>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '16px' }}>
                <input
                    type="text"
                    placeholder="Search datasets by name or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '400px', padding: '10px 16px', background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-default)', borderRadius: '8px',
                        color: 'var(--text-primary)', background: 'var(--bg-secondary)'
                    }}
                />
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="bulk-actions-bar">
                    <span className="count">{selectedIds.size} selected</span>
                    <button
                        className="btn-secondary"
                        onClick={() => setSelectedIds(new Set())}
                        style={{ fontSize: '12px' }}
                    >
                        Clear
                    </button>
                    <div className="actions">
                        <button
                            className="btn-secondary"
                            onClick={() => handleBulkAction('enable_profile')}
                            disabled={bulkProcessing}
                            style={{ fontSize: '12px' }}
                        >
                            👤 Enable Profile
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => handleBulkAction('re_ingest')}
                            disabled={bulkProcessing}
                            style={{ fontSize: '12px' }}
                        >
                            🔄 Re-ingest
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => handleBulkAction('add_labels')}
                            disabled={bulkProcessing}
                            style={{ fontSize: '12px' }}
                        >
                            🏷️ Add Labels
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="chart-section" style={{ padding: 0 }}>
                {loading ? (
                    <LoadingSpinner text="Loading datasets..." />
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <div className="checkbox-wrapper">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredDatasets.length && filteredDatasets.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </div>
                                </th>
                                <th>Name</th>
                                <th>ID</th>
                                <th>State</th>
                                <th>Profile</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDatasets.slice(0, 100).map(ds => (
                                <tr key={ds.id} style={{ background: selectedIds.has(ds.id) ? 'var(--accent-purple-glow)' : undefined }}>
                                    <td>
                                        <div className="checkbox-wrapper">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(ds.id)}
                                                onChange={() => toggleSelect(ds.id)}
                                            />
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{ds.name || 'Untitled'}</td>
                                    <td>
                                        <ClickableId
                                            id={ds.id}
                                            onClick={() => openDetail(ds)}
                                            maxLength={20}
                                        />
                                    </td>
                                    <td>
                                        <StatusBadge status={ds.state} />
                                    </td>
                                    <td>
                                        {ds.tags?.['unifiedProfile']?.[0] === 'enabled' && (
                                            <StatusBadge status="enabled" />
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="btn-secondary"
                                            style={{ padding: '4px 12px', fontSize: '12px' }}
                                            onClick={() => openDetail(ds)}
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {filteredDatasets.length > 100 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Showing 100 of {filteredDatasets.length} datasets. Use search to filter.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedDataset}
                onClose={() => setSelectedDataset(null)}
                title={selectedDataset?.name || 'Dataset Details'}
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
                                    data={detailData.info || selectedDataset}
                                    title="Dataset Information"
                                    formattedContent={
                                        <div className="detail-grid">
                                            <DetailField
                                                label="Dataset ID"
                                                value={selectedDataset?.id}
                                                mono
                                                copyable
                                            />
                                            <DetailField
                                                label="State"
                                                value={<StatusBadge status={selectedDataset?.state} />}
                                            />
                                            <DetailField
                                                label="Name"
                                                value={selectedDataset?.name}
                                            />
                                            <DetailField
                                                label="Created"
                                                value={selectedDataset?.created ? new Date(selectedDataset.created).toLocaleString() : 'N/A'}
                                            />
                                            <DetailField
                                                label="Schema Reference"
                                                value={
                                                    selectedDataset?.schemaRef?.id ? (
                                                        <ClickableId
                                                            id={selectedDataset.schemaRef.id}
                                                            onClick={() => navigate(`/schemas?id=${encodeURIComponent(selectedDataset.schemaRef.id)}`)}
                                                        />
                                                    ) : 'N/A'
                                                }
                                            />
                                            <DetailField
                                                label="Profile Enabled"
                                                value={selectedDataset?.tags?.['unifiedProfile']?.[0] === 'enabled' ? 'Yes' : 'No'}
                                            />
                                            <DetailField
                                                label="Identity Enabled"
                                                value={selectedDataset?.tags?.['unifiedIdentity']?.[0] === 'enabled' ? 'Yes' : 'No'}
                                            />
                                            <DetailField
                                                label="Description"
                                                value={detailData.info?.description || selectedDataset?.description || 'No description'}
                                            />
                                        </div>
                                    }
                                />
                            )}

                            {/* LABELS TAB */}
                            {activeTab === 'labels' && (
                                <JSONViewer
                                    data={detailData.labels || {}}
                                    title="Data Usage Labels"
                                    formattedContent={
                                        detailData.labels?.labels?.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {detailData.labels.labels.map((label, i) => (
                                                    <span key={i} className="status-badge info">{label}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message="No data usage labels applied" icon="🏷️" />
                                        )
                                    }
                                />
                            )}

                            {/* FILES TAB */}
                            {activeTab === 'files' && (
                                <JSONViewer
                                    data={detailData.files || {}}
                                    title="Dataset Files"
                                    formattedContent={
                                        <div>
                                            {getFilesArray(detailData.files).length > 0 ? (
                                                <div className="file-list">
                                                    {getFilesArray(detailData.files).slice(0, 20).map((file, i) => (
                                                        <div key={file.dataSetFileId || i} className="file-item">
                                                            <div className="file-info">
                                                                <span className="file-icon">📄</span>
                                                                <div>
                                                                    <div className="file-name">{file.name || file.dataSetFileId}</div>
                                                                    <div className="file-meta">
                                                                        {file.length && `${(file.length / 1024).toFixed(2)} KB`}
                                                                        {file.records && ` • ${file.records} records`}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="file-actions">
                                                                <button
                                                                    className="btn-secondary"
                                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                                    onClick={() => handlePreviewFile(file.dataSetFileId)}
                                                                >
                                                                    Preview
                                                                </button>
                                                                <button
                                                                    className="btn-secondary"
                                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                                    onClick={() => handleDownloadFile(file.dataSetFileId)}
                                                                >
                                                                    Download
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyState message="No files in this dataset" icon="📁" />
                                            )}

                                            {/* File Preview */}
                                            {filePreview && (
                                                <div className="preview-panel" style={{ marginTop: '20px' }}>
                                                    <div className="preview-header">
                                                        <span>File Preview: {filePreview.id}</span>
                                                        <button
                                                            className="btn-secondary"
                                                            style={{ padding: '4px 8px', fontSize: '11px' }}
                                                            onClick={() => setFilePreview(null)}
                                                        >
                                                            Close
                                                        </button>
                                                    </div>
                                                    <div className="preview-content">
                                                        {filePreview.error ? (
                                                            <div style={{ color: 'var(--accent-red)' }}>{filePreview.error}</div>
                                                        ) : (
                                                            <pre className="json-code">
                                                                {JSON.stringify(filePreview.data, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    }
                                />
                            )}

                            {/* BATCHES TAB */}
                            {activeTab === 'batches' && (
                                <JSONViewer
                                    data={detailData.batches || {}}
                                    title="Dataset Batches"
                                    formattedContent={
                                        getBatchesArray(detailData.batches).length > 0 ? (
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Batch ID</th>
                                                        <th>Status</th>
                                                        <th>Records</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {getBatchesArray(detailData.batches).slice(0, 20).map((batch, i) => (
                                                        <tr key={batch.id || i}>
                                                            <td>
                                                                <ClickableId
                                                                    id={batch.id}
                                                                    onClick={() => navigate(`/batches?id=${batch.id}`)}
                                                                    maxLength={20}
                                                                />
                                                            </td>
                                                            <td><StatusBadge status={batch.status} /></td>
                                                            <td>{batch.recordCount?.toLocaleString() || 0}</td>
                                                            <td>
                                                                <button
                                                                    className="btn-secondary"
                                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                                    onClick={() => navigate(`/batches?id=${batch.id}`)}
                                                                >
                                                                    View
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <EmptyState message="No batches found for this dataset" icon="📦" />
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
