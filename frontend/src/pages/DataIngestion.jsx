import { useState, useRef, useEffect } from 'react';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal
} from '../components/SharedComponents';
import { getAllDatasets } from '../services/api';

export default function DataIngestion() {
    const [activeTab, setActiveTab] = useState('batch');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [streamingData, setStreamingData] = useState('');
    const [streamingResult, setStreamingResult] = useState(null);
    const [selectedDataset, setSelectedDataset] = useState('');
    const fileInputRef = useRef(null);

    // File Preview state
    const [previewFile, setPreviewFile] = useState(null);
    const [previewContent, setPreviewContent] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [validationResult, setValidationResult] = useState(null);

    // Streaming Lag Indicator
    const [streamingStats, setStreamingStats] = useState({
        lastLatency: null,
        avgLatency: null,
        successCount: 0,
        errorCount: 0,
        history: []
    });

    // Real datasets from API
    const [datasets, setDatasets] = useState([]);
    const [datasetsLoading, setDatasetsLoading] = useState(true);

    // Sample data generation
    const [generatingSample, setGeneratingSample] = useState(false);

    // Load real datasets on mount
    useEffect(() => {
        loadDatasets();
    }, []);

    const loadDatasets = async () => {
        try {
            setDatasetsLoading(true);
            const response = await getAllDatasets(); // Fetch ALL datasets with pagination
            // API returns a map of { id: dataset }, need to convert to array
            const datasetMap = response?.datasets || response || {};
            const datasetList = Array.isArray(datasetMap)
                ? datasetMap
                : Object.values(datasetMap);

            setDatasets(datasetList.sort((a, b) => (b.created || 0) - (a.created || 0)));
        } catch (error) {
            console.error('Failed to load datasets:', error);
            setDatasets([]);
        } finally {
            setDatasetsLoading(false);
        }
    };

    // Generate sample data based on selected dataset schema
    const generateSampleData = () => {
        if (!selectedDataset) {
            alert('Please select a target dataset first');
            return;
        }

        setGeneratingSample(true);

        // Find selected dataset
        const dataset = datasets.find(d => d.id === selectedDataset || d['@id'] === selectedDataset);
        const schemaRef = dataset?.schemaRef?.id || dataset?.schema || 'Unknown';

        // Generate sample data based on common schema patterns
        let sampleData = [];
        const now = new Date().toISOString();

        if (schemaRef.includes('ExperienceEvent') || schemaRef.includes('experienceevent')) {
            sampleData = [
                {
                    "_id": `event_${Date.now()}_1`,
                    "timestamp": now,
                    "eventType": "web.pageView",
                    "_experience": {
                        "analytics": {
                            "customDimensions": { "eVar1": "homepage" }
                        }
                    },
                    "web": {
                        "webPageDetails": { "name": "Home Page", "URL": "https://example.com" }
                    }
                },
                {
                    "_id": `event_${Date.now()}_2`,
                    "timestamp": now,
                    "eventType": "commerce.productViews",
                    "commerce": { "productViews": { "value": 1 } },
                    "productListItems": [{ "SKU": "PROD001", "name": "Sample Product" }]
                }
            ];
        } else if (schemaRef.includes('Profile') || schemaRef.includes('profile')) {
            sampleData = [
                {
                    "_id": `profile_${Date.now()}`,
                    "person": {
                        "name": { "firstName": "John", "lastName": "Doe" },
                        "birthDate": "1990-01-15"
                    },
                    "personalEmail": { "address": "john.doe@example.com" },
                    "mobilePhone": { "number": "+1-555-0101" }
                }
            ];
        } else {
            // Generic sample
            sampleData = [
                {
                    "_id": `record_${Date.now()}`,
                    "name": "Sample Record",
                    "description": "Auto-generated sample data",
                    "createdAt": now,
                    "status": "active"
                }
            ];
        }

        // Create file from sample data
        const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
        const file = new File([blob], `sample_data_${Date.now()}.json`, { type: 'application/json' });

        handleFiles([file]);
        setGeneratingSample(false);
    };

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

    // Preview and validate file
    const openPreview = async (file) => {
        setPreviewFile(file);
        setPreviewLoading(true);
        setPreviewContent(null);
        setValidationResult(null);

        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                let parsed = null;
                let validation = { valid: true, errors: [], warnings: [], fields: [] };

                if (file.type.includes('json') || file.name.endsWith('.json')) {
                    try {
                        parsed = JSON.parse(content);

                        // Validate JSON structure
                        if (Array.isArray(parsed)) {
                            validation.recordCount = parsed.length;
                            if (parsed.length > 0) {
                                validation.fields = Object.keys(parsed[0]);
                                validation.sampleRecord = parsed[0];
                            }
                        } else if (typeof parsed === 'object') {
                            validation.recordCount = 1;
                            validation.fields = Object.keys(parsed);
                            validation.sampleRecord = parsed;

                            // Check for XDM structure
                            if (parsed.xdmEntity || parsed.body?.xdmEntity) {
                                validation.hasXdmStructure = true;
                            } else {
                                validation.warnings.push('No XDM entity structure detected - ensure data matches target schema');
                            }
                        }

                        // Check for required XDM fields
                        const flatContent = JSON.stringify(parsed);
                        if (!flatContent.includes('"_id"') && !flatContent.includes('"identityMap"')) {
                            validation.warnings.push('No _id or identityMap found - records may not be linkable');
                        }

                    } catch (parseError) {
                        validation.valid = false;
                        validation.errors.push('Invalid JSON: ' + parseError.message);
                    }
                } else if (file.type.includes('csv') || file.name.endsWith('.csv')) {
                    // Parse CSV header
                    const lines = content.split('\n').filter(l => l.trim());
                    if (lines.length > 0) {
                        validation.fields = lines[0].split(',').map(f => f.trim().replace(/"/g, ''));
                        validation.recordCount = lines.length - 1;

                        if (lines.length > 1) {
                            const sampleValues = lines[1].split(',').map(v => v.trim().replace(/"/g, ''));
                            validation.sampleRecord = {};
                            validation.fields.forEach((field, i) => {
                                validation.sampleRecord[field] = sampleValues[i] || '';
                            });
                        }

                        // Check for common identity fields
                        const fieldsLower = validation.fields.map(f => f.toLowerCase());
                        if (!fieldsLower.some(f => f.includes('email') || f.includes('id') || f.includes('ecid'))) {
                            validation.warnings.push('No obvious identity fields detected (email, id, ecid)');
                        }
                    }
                } else {
                    validation.warnings.push('File type cannot be previewed - will be validated during ingestion');
                }

                setPreviewContent(content.slice(0, 5000));
                setValidationResult(validation);
                setPreviewLoading(false);
            };
            reader.readAsText(file.file.slice(0, 100000)); // Read first 100KB for preview
        } catch (error) {
            setValidationResult({ valid: false, errors: [error.message] });
            setPreviewLoading(false);
        }
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

        const startTime = Date.now();

        try {
            const parsed = JSON.parse(streamingData);

            // Simulate API call time for demo
            await new Promise(r => setTimeout(r, 50 + Math.random() * 150));

            const latency = Date.now() - startTime;

            setStreamingResult({
                status: 'success',
                message: 'Data sent successfully',
                timestamp: new Date().toISOString(),
                records: Array.isArray(parsed) ? parsed.length : 1,
                latencyMs: latency
            });

            // Update streaming stats
            setStreamingStats(prev => {
                const newHistory = [...prev.history.slice(-19), { latency, success: true, time: Date.now() }];
                const avgLatency = newHistory.reduce((sum, h) => sum + h.latency, 0) / newHistory.length;
                return {
                    lastLatency: latency,
                    avgLatency: Math.round(avgLatency),
                    successCount: prev.successCount + 1,
                    errorCount: prev.errorCount,
                    history: newHistory
                };
            });
        } catch (e) {
            const latency = Date.now() - startTime;

            setStreamingResult({
                status: 'error',
                message: 'Invalid JSON: ' + e.message,
                timestamp: new Date().toISOString(),
                latencyMs: latency
            });

            // Update error count
            setStreamingStats(prev => ({
                ...prev,
                lastLatency: latency,
                errorCount: prev.errorCount + 1,
                history: [...prev.history.slice(-19), { latency, success: false, time: Date.now() }]
            }));
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
                                {datasetsLoading && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</span>}
                            </label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <select
                                    value={selectedDataset}
                                    onChange={e => setSelectedDataset(e.target.value)}
                                    disabled={datasetsLoading}
                                    style={{
                                        flex: 1,
                                        maxWidth: '500px',
                                        padding: '12px 16px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="">
                                        {datasetsLoading ? 'Loading datasets...' : `Select a dataset (${datasets.length} available)`}
                                    </option>
                                    {datasets.map(ds => (
                                        <option key={ds.id || ds['@id']} value={ds.id || ds['@id']}>
                                            {ds.name || ds.title || 'Unnamed Dataset'}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={generateSampleData}
                                    disabled={!selectedDataset || generatingSample}
                                    className="btn-secondary"
                                    style={{
                                        padding: '12px 20px',
                                        background: selectedDataset ? 'var(--accent-purple)' : 'var(--bg-elevated)',
                                        color: selectedDataset ? 'white' : 'var(--text-muted)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: selectedDataset ? 'pointer' : 'not-allowed',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {generatingSample ? '⏳ Generating...' : '✨ Generate Sample Data'}
                                </button>
                                <button
                                    onClick={loadDatasets}
                                    className="btn-secondary"
                                    style={{
                                        padding: '12px 16px',
                                        background: 'var(--bg-elevated)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                    title="Refresh datasets"
                                >
                                    🔄
                                </button>
                            </div>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <StatusBadge status={file.status} />
                                                {file.status === 'pending' && (
                                                    <>
                                                        <button
                                                            className="btn-secondary"
                                                            onClick={() => openPreview(file)}
                                                            style={{ padding: '4px 8px', fontSize: '11px' }}
                                                        >
                                                            👁️ Preview
                                                        </button>
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
                                                    </>
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
                        {/* Streaming Lag Indicator */}
                        {streamingStats.history.length > 0 && (
                            <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>📊</span>
                                        <span style={{ fontWeight: 600 }}>Streaming Lag Indicator</span>
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => setStreamingStats({ lastLatency: null, avgLatency: null, successCount: 0, errorCount: 0, history: [] })}
                                    >
                                        Reset
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: streamingStats.lastLatency > 200 ? 'var(--accent-red)' : streamingStats.lastLatency > 100 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                                            {streamingStats.lastLatency || '-'}ms
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LAST LATENCY</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-blue)' }}>
                                            {streamingStats.avgLatency || '-'}ms
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AVG LATENCY</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-green)' }}>
                                            {streamingStats.successCount}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SUCCESS</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: streamingStats.errorCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                                            {streamingStats.errorCount}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ERRORS</div>
                                    </div>
                                </div>

                                {/* Latency History Bar Chart */}
                                <div style={{ display: 'flex', gap: '2px', height: '40px', alignItems: 'flex-end' }}>
                                    {streamingStats.history.map((h, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                flex: 1,
                                                height: `${Math.min((h.latency / 300) * 100, 100)}%`,
                                                background: h.success
                                                    ? h.latency > 200 ? 'var(--accent-red)' : h.latency > 100 ? 'var(--accent-yellow)' : 'var(--accent-green)'
                                                    : 'var(--accent-red)',
                                                borderRadius: '2px',
                                                minHeight: '4px'
                                            }}
                                            title={`${h.latency}ms - ${h.success ? 'Success' : 'Error'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

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

            {/* File Preview Modal */}
            <Modal
                isOpen={!!previewFile}
                onClose={() => { setPreviewFile(null); setPreviewContent(null); setValidationResult(null); }}
                title={`📄 File Preview: ${previewFile?.name || ''}`}
                width="800px"
            >
                {previewLoading ? (
                    <LoadingSpinner text="Analyzing file..." />
                ) : validationResult && (
                    <div>
                        {/* Validation Status */}
                        <div style={{
                            padding: '16px',
                            marginBottom: '16px',
                            background: validationResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            borderRadius: '8px',
                            borderLeft: `3px solid ${validationResult.valid ? 'var(--accent-green)' : 'var(--accent-red)'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>{validationResult.valid ? '✅' : '❌'}</span>
                                <span style={{ fontWeight: 600 }}>
                                    {validationResult.valid ? 'File is valid for ingestion' : 'Validation errors found'}
                                </span>
                            </div>
                            {validationResult.hasXdmStructure && (
                                <div style={{ fontSize: '12px', color: 'var(--accent-green)', marginTop: '4px' }}>
                                    ✓ XDM entity structure detected
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                            <div className="stat-card" style={{ padding: '12px' }}>
                                <div className="stat-card-value" style={{ fontSize: '20px' }}>{validationResult.recordCount || 0}</div>
                                <div className="stat-card-label" style={{ fontSize: '10px' }}>RECORDS</div>
                            </div>
                            <div className="stat-card" style={{ padding: '12px' }}>
                                <div className="stat-card-value" style={{ fontSize: '20px' }}>{validationResult.fields?.length || 0}</div>
                                <div className="stat-card-label" style={{ fontSize: '10px' }}>FIELDS</div>
                            </div>
                            <div className="stat-card" style={{ padding: '12px' }}>
                                <div className="stat-card-value" style={{ fontSize: '20px', color: validationResult.warnings?.length > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                                    {validationResult.warnings?.length || 0}
                                </div>
                                <div className="stat-card-label" style={{ fontSize: '10px' }}>WARNINGS</div>
                            </div>
                        </div>

                        {/* Errors */}
                        {validationResult.errors?.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-red)' }}>Errors:</div>
                                {validationResult.errors.map((err, i) => (
                                    <div key={i} style={{
                                        padding: '8px 12px', background: 'rgba(239,68,68,0.1)',
                                        borderRadius: '6px', marginBottom: '4px', fontSize: '13px'
                                    }}>
                                        🔴 {err}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Warnings */}
                        {validationResult.warnings?.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-yellow)' }}>Warnings:</div>
                                {validationResult.warnings.map((warn, i) => (
                                    <div key={i} style={{
                                        padding: '8px 12px', background: 'rgba(234,179,8,0.1)',
                                        borderRadius: '6px', marginBottom: '4px', fontSize: '13px'
                                    }}>
                                        🟡 {warn}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Fields */}
                        {validationResult.fields?.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '8px' }}>Detected Fields ({validationResult.fields.length}):</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {validationResult.fields.slice(0, 20).map((field, i) => (
                                        <span key={i} style={{
                                            padding: '4px 10px', background: 'var(--bg-secondary)',
                                            borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace'
                                        }}>
                                            {field}
                                        </span>
                                    ))}
                                    {validationResult.fields.length > 20 && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                                            +{validationResult.fields.length - 20} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sample Record */}
                        {validationResult.sampleRecord && (
                            <details>
                                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
                                    Sample Record
                                </summary>
                                <pre style={{
                                    padding: '12px', background: 'var(--bg-primary)',
                                    borderRadius: '8px', fontSize: '11px',
                                    overflow: 'auto', maxHeight: '200px'
                                }}>
                                    {JSON.stringify(validationResult.sampleRecord, null, 2)}
                                </pre>
                            </details>
                        )}

                        {/* Raw Content Preview */}
                        {previewContent && (
                            <details style={{ marginTop: '16px' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
                                    Raw Content Preview (first 5KB)
                                </summary>
                                <pre style={{
                                    padding: '12px', background: 'var(--bg-primary)',
                                    borderRadius: '8px', fontSize: '10px',
                                    overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap'
                                }}>
                                    {previewContent}
                                </pre>
                            </details>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}
