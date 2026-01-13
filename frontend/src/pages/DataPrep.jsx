import { useState, useEffect } from 'react';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal
} from '../components/SharedComponents';

export default function DataPrep() {
    const [activeTab, setActiveTab] = useState('mappings');
    const [mappings, setMappings] = useState([]);
    const [functions, setFunctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMapping, setSelectedMapping] = useState(null);
    const [showEditor, setShowEditor] = useState(false);

    // Editor state
    const [editorSource, setEditorSource] = useState('');
    const [editorTarget, setEditorTarget] = useState('');
    const [editorTransform, setEditorTransform] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        // Simulated data - would come from backend
        await new Promise(r => setTimeout(r, 500));

        setMappings([
            {
                id: 'map1',
                name: 'CRM to Profile',
                source: 'CRM_Export',
                target: 'Profile Schema',
                fields: 12,
                status: 'active',
                lastRun: '2026-01-13T10:30:00Z'
            },
            {
                id: 'map2',
                name: 'Analytics Events',
                source: 'Analytics_Stream',
                target: 'ExperienceEvent',
                fields: 24,
                status: 'active',
                lastRun: '2026-01-13T09:15:00Z'
            },
            {
                id: 'map3',
                name: 'Product Catalog Sync',
                source: 'Product_API',
                target: 'Product Schema',
                fields: 8,
                status: 'draft',
                lastRun: null
            }
        ]);

        setFunctions([
            { name: 'concat', description: 'Concatenate strings', example: 'concat(firstName, " ", lastName)' },
            { name: 'upper', description: 'Convert to uppercase', example: 'upper(email)' },
            { name: 'lower', description: 'Convert to lowercase', example: 'lower(country)' },
            { name: 'trim', description: 'Remove whitespace', example: 'trim(address)' },
            { name: 'split', description: 'Split string by delimiter', example: 'split(fullName, " ")' },
            { name: 'coalesce', description: 'Return first non-null value', example: 'coalesce(mobile, phone, email)' },
            { name: 'date_format', description: 'Format date', example: 'date_format(birthDate, "yyyy-MM-dd")' },
            { name: 'hash', description: 'Hash value (SHA256)', example: 'hash(email)' },
            { name: 'iif', description: 'Conditional logic', example: 'iif(age >= 18, "adult", "minor")' },
            { name: 'map_get', description: 'Get value from map', example: 'map_get(attributes, "key")' }
        ]);

        setLoading(false);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Never';
        return new Date(timestamp).toLocaleString();
    };

    // Sample mapping fields for visual editor
    const sampleSourceFields = [
        'customer_id', 'first_name', 'last_name', 'email_address',
        'phone_number', 'street_address', 'city', 'state', 'zip_code', 'country'
    ];

    const sampleTargetFields = [
        'person.name.firstName', 'person.name.lastName', 'personalEmail.address',
        'mobilePhone.number', 'homeAddress.street1', 'homeAddress.city',
        'homeAddress.stateProvince', 'homeAddress.postalCode', 'homeAddress.country'
    ];

    const mainTabs = [
        { id: 'mappings', label: 'Mapping Sets' },
        { id: 'editor', label: 'Visual Editor' },
        { id: 'functions', label: 'Functions' }
    ];

    return (
        <>
            <div className="page-header">
                <h1>Data Prep</h1>
                <p>Transform and map source data to XDM schemas</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{mappings.length}</div>
                    <div className="stat-card-label">MAPPING SETS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>
                        {mappings.filter(m => m.status === 'active').length}
                    </div>
                    <div className="stat-card-label">ACTIVE</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-yellow)' }}>
                        {mappings.filter(m => m.status === 'draft').length}
                    </div>
                    <div className="stat-card-label">DRAFTS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{functions.length}</div>
                    <div className="stat-card-label">FUNCTIONS</div>
                </div>
            </div>

            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>
                {/* MAPPING SETS TAB */}
                {activeTab === 'mappings' && (
                    loading ? <LoadingSpinner text="Loading mapping sets..." /> : (
                        <div style={{ display: 'grid', gap: '16px' }}>
                            {mappings.map(mapping => (
                                <div
                                    key={mapping.id}
                                    className="stat-card"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedMapping(mapping)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                                                {mapping.name}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                {mapping.source} → {mapping.target}
                                            </div>
                                        </div>
                                        <StatusBadge status={mapping.status} />
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '16px',
                                        marginTop: '16px',
                                        padding: '12px',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '8px'
                                    }}>
                                        <div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>FIELDS</div>
                                            <div style={{ fontSize: '16px', fontWeight: 500 }}>{mapping.fields}</div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>LAST RUN</div>
                                            <div style={{ fontSize: '14px' }}>{formatDate(mapping.lastRun)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                                Edit Mapping
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* VISUAL EDITOR TAB */}
                {activeTab === 'editor' && (
                    <div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 1fr',
                            gap: '16px',
                            marginBottom: '24px'
                        }}>
                            {/* Source Fields */}
                            <div className="chart-section" style={{ padding: '16px' }}>
                                <h4 style={{ marginBottom: '12px' }}>Source Fields</h4>
                                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    {sampleSourceFields.map(field => (
                                        <div
                                            key={field}
                                            onClick={() => setEditorSource(field)}
                                            style={{
                                                padding: '10px 12px',
                                                background: editorSource === field ? 'var(--accent-blue)' : 'var(--bg-primary)',
                                                borderRadius: '6px',
                                                marginBottom: '4px',
                                                cursor: 'pointer',
                                                fontFamily: 'monospace',
                                                fontSize: '13px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {field}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                color: 'var(--text-muted)'
                            }}>
                                →
                            </div>

                            {/* Target Fields */}
                            <div className="chart-section" style={{ padding: '16px' }}>
                                <h4 style={{ marginBottom: '12px' }}>Target Fields (XDM)</h4>
                                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    {sampleTargetFields.map(field => (
                                        <div
                                            key={field}
                                            onClick={() => setEditorTarget(field)}
                                            style={{
                                                padding: '10px 12px',
                                                background: editorTarget === field ? 'var(--accent-green)' : 'var(--bg-primary)',
                                                borderRadius: '6px',
                                                marginBottom: '4px',
                                                cursor: 'pointer',
                                                fontFamily: 'monospace',
                                                fontSize: '13px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {field}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Transformation */}
                        {(editorSource || editorTarget) && (
                            <div className="chart-section" style={{ padding: '16px' }}>
                                <h4 style={{ marginBottom: '12px' }}>Transformation</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                            SOURCE
                                        </label>
                                        <input
                                            value={editorSource}
                                            onChange={e => setEditorSource(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-default)',
                                                borderRadius: '6px',
                                                color: 'var(--text-primary)',
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                            TARGET
                                        </label>
                                        <input
                                            value={editorTarget}
                                            onChange={e => setEditorTarget(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-default)',
                                                borderRadius: '6px',
                                                color: 'var(--text-primary)',
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                        TRANSFORM EXPRESSION (optional)
                                    </label>
                                    <input
                                        value={editorTransform}
                                        onChange={e => setEditorTransform(e.target.value)}
                                        placeholder="e.g., upper(source_field) or concat(field1, field2)"
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-default)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'monospace'
                                        }}
                                    />
                                </div>
                                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                    <button className="btn-primary">
                                        Add Mapping
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* FUNCTIONS TAB */}
                {activeTab === 'functions' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                        {functions.map(fn => (
                            <div key={fn.name} className="stat-card">
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '8px'
                                }}>
                                    <span style={{ fontSize: '20px' }}>ƒ</span>
                                    <span style={{
                                        fontFamily: 'monospace',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: 'var(--accent-blue)'
                                    }}>
                                        {fn.name}()
                                    </span>
                                </div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    {fn.description}
                                </div>
                                <div style={{
                                    background: 'var(--bg-primary)',
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    color: 'var(--text-muted)'
                                }}>
                                    {fn.example}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </TabPanel>

            {/* Mapping Detail Modal */}
            <Modal
                isOpen={!!selectedMapping}
                onClose={() => setSelectedMapping(null)}
                title={selectedMapping?.name || 'Mapping Details'}
                width="700px"
            >
                <JSONViewer
                    data={selectedMapping || {}}
                    title="Mapping Configuration"
                    formattedContent={
                        <div className="detail-grid">
                            <DetailField label="Name" value={selectedMapping?.name} />
                            <DetailField label="Source" value={selectedMapping?.source} />
                            <DetailField label="Target" value={selectedMapping?.target} />
                            <DetailField label="Fields Mapped" value={selectedMapping?.fields} />
                            <DetailField label="Status" value={<StatusBadge status={selectedMapping?.status} />} />
                            <DetailField label="Last Run" value={formatDate(selectedMapping?.lastRun)} />
                        </div>
                    }
                />
            </Modal>
        </>
    );
}
