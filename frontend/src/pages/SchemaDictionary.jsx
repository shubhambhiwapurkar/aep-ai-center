import { useState, useEffect } from 'react';
import { generateDataDictionary, extractSchemaForAI, getSchemaStats, getSandboxes } from '../services/api';

export default function SchemaDictionary() {
    const [dictionary, setDictionary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [expandedSchemas, setExpandedSchemas] = useState({});

    // Progress tracking
    const [progress, setProgress] = useState({
        step: 0,
        steps: [
            { id: 'connect', label: 'Connecting to AEP...', status: 'pending', detail: '' },
            { id: 'schemas', label: 'Fetching schemas...', status: 'pending', detail: '' },
            { id: 'fields', label: 'Extracting field paths...', status: 'pending', detail: '' },
            { id: 'build', label: 'Building dictionary...', status: 'pending', detail: '' }
        ]
    });

    useEffect(() => {
        loadDictionary();
    }, []);

    const updateStep = (stepId, status, detail = '') => {
        setProgress(prev => ({
            ...prev,
            steps: prev.steps.map(s =>
                s.id === stepId ? { ...s, status, detail } : s
            )
        }));
    };

    const loadDictionary = async () => {
        setLoading(true);
        setError(null);

        // Reset progress
        setProgress(prev => ({
            step: 0,
            steps: prev.steps.map(s => ({ ...s, status: 'pending', detail: '' }))
        }));

        try {
            // Step 1: Connect and get sandbox info
            updateStep('connect', 'active');
            const sandboxInfo = await getSandboxes().catch(() => ({ sandboxes: [] }));
            const sandboxCount = sandboxInfo?.sandboxes?.length || 0;
            updateStep('connect', 'complete', `${sandboxCount} sandbox${sandboxCount !== 1 ? 'es' : ''} available`);

            // Step 2: Get schema stats
            updateStep('schemas', 'active');
            const schemaStats = await getSchemaStats().catch(() => ({}));
            const schemaCount = schemaStats?.total || schemaStats?.totalSchemas || 0;
            updateStep('schemas', 'complete', `${schemaCount} schemas found`);

            // Step 3: Extract fields
            updateStep('fields', 'active');
            await new Promise(r => setTimeout(r, 300)); // Brief pause for UX
            updateStep('fields', 'complete', 'Parsing field groups...');

            // Step 4: Build dictionary
            updateStep('build', 'active');
            const data = await generateDataDictionary();
            const fieldCount = data?.fields?.length || 0;
            updateStep('build', 'complete', `${fieldCount} fields extracted`);

            setDictionary(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Computed values
    const filteredFields = dictionary?.fields?.filter(field => {
        const matchesSearch = !searchTerm ||
            field.path?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = selectedType === 'all' || field.type === selectedType;

        return matchesSearch && matchesType;
    }) || [];

    const types = [...new Set(dictionary?.fields?.map(f => f.type) || [])].filter(Boolean);

    const toggleSchema = (schemaName) => {
        setExpandedSchemas(prev => ({
            ...prev,
            [schemaName]: !prev[schemaName]
        }));
    };

    const groupedBySchema = filteredFields.reduce((acc, field) => {
        const schema = field.schema || 'Unknown Schema';
        if (!acc[schema]) acc[schema] = [];
        acc[schema].push(field);
        return acc;
    }, {});

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    if (loading) {
        return (
            <div style={{ padding: '60px 40px', maxWidth: '500px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                        Extracting Schema Dictionary
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Analyzing your AEP schemas and field structures
                    </div>
                </div>

                {/* Progress Steps */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid var(--border-default)'
                }}>
                    {progress.steps.map((step, idx) => (
                        <div key={step.id} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '12px 0',
                            borderBottom: idx < progress.steps.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                        }}>
                            {/* Status Icon */}
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                flexShrink: 0,
                                background: step.status === 'complete' ? 'var(--accent-green)' :
                                    step.status === 'active' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                color: step.status === 'pending' ? 'var(--text-muted)' : 'white'
                            }}>
                                {step.status === 'complete' ? '✓' :
                                    step.status === 'active' ? (
                                        <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                                    ) : idx + 1}
                            </div>

                            {/* Label and Detail */}
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontWeight: step.status === 'active' ? 600 : 400,
                                    color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                                    fontSize: '14px'
                                }}>
                                    {step.label}
                                </div>
                                {step.detail && (
                                    <div style={{
                                        fontSize: '12px',
                                        color: step.status === 'complete' ? 'var(--accent-green)' : 'var(--text-muted)',
                                        marginTop: '2px'
                                    }}>
                                        {step.detail}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{
                    textAlign: 'center',
                    marginTop: '20px',
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                }}>
                    This may take a moment for large schemas
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                <div style={{ color: 'var(--accent-red)', marginBottom: '8px' }}>Failed to load dictionary</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{error}</div>
                <button
                    onClick={loadDictionary}
                    style={{
                        marginTop: '16px',
                        padding: '8px 24px',
                        background: 'var(--accent-blue)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="schema-dictionary-page">
            {/* Header Stats */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-value">{dictionary?.totalSchemas || 0}</div>
                    <div className="stat-label">Schemas</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{dictionary?.fields?.length || 0}</div>
                    <div className="stat-label">Total Fields</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{types.length}</div>
                    <div className="stat-label">Field Types</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{filteredFields.length}</div>
                    <div className="stat-label">Matching</div>
                </div>
            </div>

            {/* Search and Filter */}
            <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                flexWrap: 'wrap'
            }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Search fields by path, title, or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '14px'
                        }}
                    />
                </div>
                <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    style={{
                        padding: '12px 16px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        minWidth: '150px'
                    }}
                >
                    <option value="all">All Types</option>
                    {types.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
                <button
                    onClick={loadDictionary}
                    style={{
                        padding: '12px 20px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Info Banner */}
            <div style={{
                padding: '16px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <span style={{ fontSize: '24px' }}>💡</span>
                <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>AI Context Ready</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        This dictionary is used by the AI Agent to understand your schema structure.
                        Click on any field path to copy it for use in segments or queries.
                    </div>
                </div>
            </div>

            {/* Fields grouped by Schema */}
            {Object.entries(groupedBySchema).map(([schemaName, fields]) => (
                <div
                    key={schemaName}
                    style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        marginBottom: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-default)'
                    }}
                >
                    {/* Schema Header */}
                    <div
                        onClick={() => toggleSchema(schemaName)}
                        style={{
                            padding: '16px 20px',
                            background: 'var(--bg-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: expandedSchemas[schemaName] ? '1px solid var(--border-default)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>📋</span>
                            <div>
                                <div style={{ fontWeight: 600 }}>{schemaName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {fields.length} fields
                                </div>
                            </div>
                        </div>
                        <span style={{
                            transform: expandedSchemas[schemaName] ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                        }}>▼</span>
                    </div>

                    {/* Fields List */}
                    {expandedSchemas[schemaName] && (
                        <div style={{ padding: '8px' }}>
                            {fields.map((field, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        marginBottom: '4px',
                                        background: 'var(--bg-primary)',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto',
                                        gap: '16px',
                                        alignItems: 'start'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <code
                                                onClick={() => copyToClipboard(field.path)}
                                                style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '13px',
                                                    color: 'var(--accent-cyan)',
                                                    cursor: 'pointer',
                                                    padding: '2px 6px',
                                                    background: 'rgba(34, 211, 238, 0.1)',
                                                    borderRadius: '4px'
                                                }}
                                                title="Click to copy"
                                            >
                                                {field.path}
                                            </code>
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '2px 8px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '4px',
                                                color: 'var(--text-muted)'
                                            }}>
                                                {field.type}
                                            </span>
                                        </div>
                                        {field.title && field.title !== field.path && (
                                            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>
                                                {field.title}
                                            </div>
                                        )}
                                        {field.description && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {field.description}
                                            </div>
                                        )}
                                        {field.enum && (
                                            <div style={{
                                                marginTop: '8px',
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '4px'
                                            }}>
                                                {field.enum.slice(0, 5).map((val, i) => (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            fontSize: '10px',
                                                            padding: '2px 6px',
                                                            background: 'rgba(34, 197, 94, 0.15)',
                                                            color: 'var(--accent-green)',
                                                            borderRadius: '4px'
                                                        }}
                                                    >
                                                        {val}
                                                    </span>
                                                ))}
                                                {field.enum.length > 5 && (
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                        +{field.enum.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(field.path)}
                                        style={{
                                            padding: '6px 12px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-default)',
                                            borderRadius: '6px',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            fontSize: '11px'
                                        }}
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {filteredFields.length === 0 && (
                <div style={{
                    padding: '60px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                    <div>No fields match your search criteria</div>
                </div>
            )}
        </div>
    );
}
