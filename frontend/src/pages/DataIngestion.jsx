import { useState, useRef } from 'react';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState
} from '../components/SharedComponents';

export default function DataIngestion() {
    const [activeTab, setActiveTab] = useState('batch');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [streamingData, setStreamingData] = useState('');
    const [streamingResult, setStreamingResult] = useState(null);
    const [selectedDataset, setSelectedDataset] = useState('');
    const fileInputRef = useRef(null);

    // Simulated datasets for selection
    const datasets = [
        { id: 'ds001', name: 'Customer Profiles', schema: 'Profile' },
        { id: 'ds002', name: 'Experience Events', schema: 'ExperienceEvent' },
        { id: 'ds003', name: 'Product Catalog', schema: 'Product' }
    ];

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer?.files || []);
        handleFiles(droppedFiles);
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        handleFiles(selectedFiles);
    };

    const handleFiles = (newFiles) => {
        const fileObjects = newFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            file: file
        }));
        setFiles(prev => [...prev, ...fileObjects]);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const removeFile = (id) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const uploadFiles = async () => {
        if (!selectedDataset) {
            alert('Please select a target dataset');
            return;
        }

        setUploading(true);

        for (const file of files) {
            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'uploading' } : f
            ));

            // Simulate upload progress
            for (let i = 0; i <= 100; i += 10) {
                setUploadProgress(prev => ({ ...prev, [file.id]: i }));
                await new Promise(r => setTimeout(r, 100));
            }

            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'success' } : f
            ));
        }

        setUploading(false);
        alert('Upload complete! Files have been queued for batch ingestion.');
    };

    const sendStreamingData = async () => {
        if (!streamingData.trim()) {
            alert('Please enter JSON data to stream');
            return;
        }

        try {
            const parsed = JSON.parse(streamingData);
            setStreamingResult({
                status: 'success',
                message: 'Data sent successfully',
                timestamp: new Date().toISOString(),
                records: Array.isArray(parsed) ? parsed.length : 1
            });
        } catch (e) {
            setStreamingResult({
                status: 'error',
                message: 'Invalid JSON: ' + e.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    const sampleStreamingData = `{
  "header": {
    "schemaRef": {
      "id": "https://ns.adobe.com/xdm/context/profile",
      "contentType": "application/vnd.adobe.xed-full+json;version=1"
    },
    "imsOrgId": "YOUR_ORG_ID",
    "datasetId": "YOUR_DATASET_ID",
    "source": { "name": "AEP Monitor" }
  },
  "body": {
    "xdmMeta": {
      "schemaRef": { "id": "https://ns.adobe.com/xdm/context/profile" }
    },
    "xdmEntity": {
      "_id": "customer-123",
      "person": {
        "name": { "firstName": "John", "lastName": "Doe" }
      },
      "personalEmail": {
        "address": "john.doe@example.com"
      }
    }
  }
}`;

    const mainTabs = [
        { id: 'batch', label: 'Batch Upload' },
        { id: 'streaming', label: 'Streaming Test' },
        { id: 'history', label: 'Upload History' }
    ];

    return (
        <>
            <div className="page-header">
                <h1>Data Ingestion Console</h1>
                <p>Upload files or stream data directly into AEP datasets</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{files.length}</div>
                    <div className="stat-card-label">FILES QUEUED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>
                        {files.filter(f => f.status === 'success').length}
                    </div>
                    <div className="stat-card-label">UPLOADED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>
                        {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
                    </div>
                    <div className="stat-card-label">TOTAL SIZE</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{datasets.length}</div>
                    <div className="stat-card-label">DATASETS</div>
                </div>
            </div>

            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>
                {/* BATCH UPLOAD TAB */}
                {activeTab === 'batch' && (
                    <div>
                        {/* Dataset Selector */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                Target Dataset
                            </label>
                            <select
                                value={selectedDataset}
                                onChange={e => setSelectedDataset(e.target.value)}
                                style={{
                                    width: '100%',
                                    maxWidth: '400px',
                                    padding: '12px 16px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">Select a dataset...</option>
                                {datasets.map(ds => (
                                    <option key={ds.id} value={ds.id}>
                                        {ds.name} ({ds.schema})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Drop Zone */}
                        <div
                            onDrop={handleFileDrop}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border-default)',
                                borderRadius: '12px',
                                padding: '60px 40px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: 'var(--bg-secondary)'
                            }}
                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                accept=".json,.csv,.parquet"
                                style={{ display: 'none' }}
                            />
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                            <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
                                Drop files here or click to browse
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                Supports JSON, CSV, and Parquet files up to 256MB
                            </div>
                        </div>

                        {/* File List */}
                        {files.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h3 style={{ margin: 0 }}>Files ({files.length})</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => setFiles([])}
                                        >
                                            Clear All
                                        </button>
                                        <button
                                            className="btn-primary"
                                            onClick={uploadFiles}
                                            disabled={uploading || !selectedDataset}
                                        >
                                            {uploading ? 'Uploading...' : `Upload ${files.length} Files`}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                    {files.map(file => (
                                        <div
                                            key={file.id}
                                            className="file-item"
                                            style={{ margin: 0, borderRadius: 0, borderBottom: '1px solid var(--border-subtle)' }}
                                        >
                                            <div className="file-info">
                                                <span style={{ fontSize: '24px' }}>
                                                    {file.type.includes('json') ? '📄' : file.type.includes('csv') ? '📊' : '📦'}
                                                </span>
                                                <div style={{ flex: 1 }}>
                                                    <div className="file-name">{file.name}</div>
                                                    <div className="file-meta">{formatFileSize(file.size)}</div>
                                                    {file.status === 'uploading' && (
                                                        <div style={{
                                                            height: '4px',
                                                            background: 'var(--bg-primary)',
                                                            borderRadius: '2px',
                                                            marginTop: '8px',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                height: '100%',
                                                                width: `${uploadProgress[file.id] || 0}%`,
                                                                background: 'var(--accent-blue)',
                                                                transition: 'width 0.2s ease'
                                                            }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <StatusBadge status={file.status} />
                                                {file.status === 'pending' && (
                                                    <button
                                                        onClick={() => removeFile(file.id)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'var(--text-muted)',
                                                            cursor: 'pointer',
                                                            fontSize: '18px'
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STREAMING TAB */}
                {activeTab === 'streaming' && (
                    <div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                JSON Payload
                            </label>
                            <textarea
                                value={streamingData}
                                onChange={e => setStreamingData(e.target.value)}
                                placeholder="Enter JSON data to stream..."
                                style={{
                                    width: '100%',
                                    minHeight: '300px',
                                    padding: '16px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                            <button
                                className="btn-secondary"
                                onClick={() => setStreamingData(sampleStreamingData)}
                            >
                                Load Sample
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => setStreamingData('')}
                            >
                                Clear
                            </button>
                            <button
                                className="btn-primary"
                                onClick={sendStreamingData}
                            >
                                Send to AEP
                            </button>
                        </div>

                        {streamingResult && (
                            <JSONViewer
                                data={streamingResult}
                                title="Response"
                                formattedContent={
                                    <div className="detail-grid">
                                        <DetailField label="Status" value={<StatusBadge status={streamingResult.status} />} />
                                        <DetailField label="Message" value={streamingResult.message} />
                                        <DetailField label="Timestamp" value={streamingResult.timestamp} />
                                        {streamingResult.records && (
                                            <DetailField label="Records" value={streamingResult.records} />
                                        )}
                                    </div>
                                }
                            />
                        )}
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                    <EmptyState
                        message="No upload history"
                        icon="📋"
                        subtext="Upload history will appear here after files are processed"
                    />
                )}
            </TabPanel>
        </>
    );
}
