import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    getSchemas, getAllSchemas, getSchemaStats, getSchemaDetails, getSchemaSampleData,
    exportSchema, getFieldGroups, getClasses, getDataTypes, getUnionSchemas,
    extractSchemaForAI, getBehaviors, getDescriptors, generateDataDictionary
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, ClickableId, CopyButton
} from '../components/SharedComponents';

export default function SchemaBrowser() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('tenant');
    const [search, setSearch] = useState('');

    // Detail modal state
    const [selectedItem, setSelectedItem] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    const [detailData, setDetailData] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);
    const [aiExport, setAiExport] = useState(null);
    const [dictionary, setDictionary] = useState(null);
    const [generatingDict, setGeneratingDict] = useState(false);

    // Track real counts from paginated API
    const [tenantCount, setTenantCount] = useState(0);
    const [globalCount, setGlobalCount] = useState(0);

    useEffect(() => {
        loadData();
    }, [activeCategory]);

    const loadData = async () => {
        try {
            setLoading(true);
            let data;

            switch (activeCategory) {
                case 'tenant':
                case 'global':
                    // Use getAllSchemas to get ALL schemas with pagination
                    const [schemaData, statsData] = await Promise.all([
                        getAllSchemas(activeCategory).catch(() => ({ results: [], total: 0 })),
                        activeCategory === 'tenant' ? getSchemaStats().catch(() => null) : Promise.resolve(null)
                    ]);
                    data = schemaData.results || [];
                    // Save real count
                    if (activeCategory === 'tenant') {
                        setTenantCount(data.length);
                    } else {
                        setGlobalCount(data.length);
                    }
                    if (statsData) setStats(statsData);
                    break;
                case 'unions':
                    const unions = await getUnionSchemas().catch(() => ({ results: [] }));
                    data = unions.results || [];
                    break;
                case 'fieldgroups':
                    const fgs = await getFieldGroups('tenant').catch(() => ({ results: [] }));
                    data = fgs.results || [];
                    break;
                case 'classes':
                    const cls = await getClasses('tenant').catch(() => ({ results: [] }));
                    data = cls.results || [];
                    break;
                case 'datatypes':
                    const dts = await getDataTypes('tenant').catch(() => ({ results: [] }));
                    data = dts.results || [];
                    break;
                case 'behaviors':
                    const bhv = await getBehaviors().catch(() => ({ results: [] }));
                    data = bhv.results || [];
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
        setActiveTab('info');
        setDetailData({});
        setDetailLoading(true);

        try {
            const container = activeCategory === 'global' ? 'global' : 'tenant';
            const details = await getSchemaDetails(item['meta:altId'] || item.$id, container);
            setDetailData({ info: details });
        } catch (e) {
            setDetailData({ info: item });
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
                case 'sample':
                    data = await getSchemaSampleData(selectedItem['meta:altId'] || selectedItem.$id);
                    break;
                case 'descriptors':
                    data = await getDescriptors(selectedItem.$id);
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

    const handleExport = async () => {
        if (!selectedItem) return;
        try {
            const exported = await exportSchema(selectedItem['meta:altId'] || selectedItem.$id);
            const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schema-${selectedItem.title || 'export'}.json`;
            a.click();
        } catch (e) {
            console.error('Export error:', e);
        }
    };

    const splitDictionary = async () => {
        setGeneratingDict(true);
        try {
            const result = await generateDataDictionary();
            setDictionary(result);
        } catch (e) {
            console.error('Dictionary error:', e);
        } finally {
            setGeneratingDict(false);
        }
    };

    const extractForAI = async () => {
        try {
            setLoading(true);
            const extracted = await extractSchemaForAI();
            setAiExport(extracted);
        } catch (e) {
            console.error('AI export error:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(s =>
        !search || s.title?.toLowerCase().includes(search.toLowerCase())
    );

    const categories = [
        { id: 'tenant', label: 'Tenant Schemas' },
        { id: 'global', label: 'Global Schemas' },
        { id: 'unions', label: 'Union Schemas' },
        { id: 'fieldgroups', label: 'Field Groups' },
        { id: 'classes', label: 'Classes' },
        { id: 'datatypes', label: 'Data Types' },
        { id: 'behaviors', label: 'Behaviors' }
    ];

    const tabs = [
        { id: 'info', label: 'Info' },
        { id: 'properties', label: 'Properties' },
        { id: 'sample', label: 'Sample Data' },
        { id: 'descriptors', label: 'Descriptors' }
    ];

    // Parse schema properties into a tree
    const getPropertiesTree = (schema) => {
        if (!schema?.properties) return [];
        return Object.entries(schema.properties).map(([key, prop]) => ({
            name: key,
            type: prop.type || (prop.$ref ? 'reference' : 'object'),
            title: prop.title,
            description: prop.description,
            ref: prop.$ref,
            items: prop.items,
            properties: prop.properties
        }));
    };

    return (
        <>
            <div className="page-header">
                <h1>Schema Registry</h1>
                <p>Browse schemas, field groups, classes, and data types</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{tenantCount || items.length || stats?.totalSchemas || 0}</div>
                    <div className="stat-card-label">SCHEMAS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.unions || 0}</div>
                    <div className="stat-card-label">UNIONS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.fieldGroups || 0}</div>
                    <div className="stat-card-label">FIELD GROUPS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.classes || 0}</div>
                    <div className="stat-card-label">CLASSES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.dataTypes || 0}</div>
                    <div className="stat-card-label">DATA TYPES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ fontSize: '14px' }}>{stats?.tenantId?.substring(0, 12) || 'N/A'}</div>
                    <div className="stat-card-label">TENANT</div>
                </div>
            </div>

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`dropdown-btn ${activeCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                    >
                        {cat.label}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button
                        className="btn-secondary"
                        onClick={splitDictionary}
                        disabled={generatingDict}
                    >
                        {generatingDict ? 'Building...' : '📖 Data Dictionary'}
                    </button>
                    <button className="btn-secondary" onClick={extractForAI}>
                        Extract for AI
                    </button>
                </div>
            </div>

            {/* Dictionary View */}
            {dictionary && (
                <div className="chart-section" style={{ marginBottom: '24px', border: '1px solid var(--accent-purple)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3>📖 AI Data Dictionary</h3>
                        <button className="btn-secondary" onClick={() => setDictionary(null)}>✕</button>
                    </div>
                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                        {dictionary.dictionaries.map(d => (
                            <div key={d.schemaId} style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '8px' }}>{d.title}</div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Path</th>
                                            <th>Type</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.dictionary.map((f, i) => (
                                            <tr key={i}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent-cyan)' }}>{f.path}</td>
                                                <td><StatusBadge status={f.type} size="small" /></td>
                                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.description.substring(0, 50)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: '16px' }}>
                <input
                    type="text"
                    placeholder="Search by title..."
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
            </div>

            {/* AI Export Result */}
            {aiExport && (
                <div className="chart-section" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3>AI Schema Export</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <CopyButton text={JSON.stringify(aiExport, null, 2)} label="Copy" />
                            <button className="btn-secondary" onClick={() => setAiExport(null)}>✕</button>
                        </div>
                    </div>
                    <pre style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', overflow: 'auto', maxHeight: '300px' }}>
                        {JSON.stringify(aiExport, null, 2)}
                    </pre>
                </div>
            )}

            {/* Table */}
            <div className="chart-section" style={{ padding: 0 }}>
                {loading ? (
                    <LoadingSpinner text={`Loading ${activeCategory}...`} />
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>ID</th>
                                <th>Version</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.slice(0, 50).map((item, idx) => (
                                <tr key={item.$id || idx}>
                                    <td style={{ fontWeight: 500 }}>{item.title || 'Untitled'}</td>
                                    <td>
                                        <ClickableId
                                            id={item['meta:altId'] || item.$id}
                                            onClick={() => openDetail(item)}
                                            maxLength={35}
                                        />
                                    </td>
                                    <td>{item.version || 'N/A'}</td>
                                    <td>
                                        <button
                                            className="btn-secondary"
                                            style={{ padding: '4px 12px', fontSize: '12px' }}
                                            onClick={() => openDetail(item)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan="4">
                                        <EmptyState message={`No ${activeCategory} found`} />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
                {filteredItems.length > 50 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Showing 50 of {filteredItems.length}. Use search to filter.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title={selectedItem?.title || 'Schema Details'}
                width="1000px"
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
                                    data={detailData.info || selectedItem}
                                    title="Schema Information"
                                    formattedContent={
                                        <div>
                                            <div className="action-bar">
                                                <span style={{ fontWeight: 500 }}>{selectedItem?.title}</span>
                                                <div className="action-bar-right">
                                                    <button className="btn-secondary" onClick={() => loadTabData('sample')}>
                                                        Generate Sample
                                                    </button>
                                                    <button className="btn-secondary" onClick={handleExport}>
                                                        Export JSON
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="detail-grid">
                                                <DetailField
                                                    label="Schema ID"
                                                    value={selectedItem?.$id}
                                                    mono
                                                    copyable
                                                />
                                                <DetailField
                                                    label="Alt ID"
                                                    value={selectedItem?.['meta:altId']}
                                                    mono
                                                    copyable
                                                />
                                                <DetailField
                                                    label="Version"
                                                    value={selectedItem?.version}
                                                />
                                                <DetailField
                                                    label="Type"
                                                    value={selectedItem?.type}
                                                />
                                                <DetailField
                                                    label="Extends"
                                                    value={
                                                        selectedItem?.['meta:extends']?.length > 0
                                                            ? selectedItem['meta:extends'].join(', ').substring(0, 50) + '...'
                                                            : 'N/A'
                                                    }
                                                />
                                                <DetailField
                                                    label="Description"
                                                    value={selectedItem?.description || 'No description'}
                                                />
                                            </div>

                                            {/* Related Field Groups */}
                                            {selectedItem?.allOf?.length > 0 && (
                                                <div style={{ marginTop: '20px' }}>
                                                    <h4 style={{ marginBottom: '12px' }}>Field Groups (allOf)</h4>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {selectedItem.allOf.slice(0, 10).map((ref, i) => (
                                                            <span
                                                                key={i}
                                                                className="status-badge info"
                                                                style={{ cursor: 'pointer' }}
                                                                title={ref.$ref}
                                                            >
                                                                {ref.$ref?.split('/').pop()?.substring(0, 30) || `Ref ${i + 1}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    }
                                />
                            )}

                            {/* PROPERTIES TAB */}
                            {activeTab === 'properties' && (
                                <JSONViewer
                                    data={detailData.info?.properties || selectedItem?.properties || {}}
                                    title="Schema Properties"
                                    formattedContent={
                                        <div>
                                            {getPropertiesTree(detailData.info || selectedItem).length > 0 ? (
                                                <table className="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Property</th>
                                                            <th>Type</th>
                                                            <th>Title</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {getPropertiesTree(detailData.info || selectedItem).map((prop, i) => (
                                                            <tr key={i}>
                                                                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{prop.name}</td>
                                                                <td><StatusBadge status={prop.type} /></td>
                                                                <td style={{ color: 'var(--text-muted)' }}>{prop.title || prop.description?.substring(0, 50) || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <EmptyState message="No properties defined" icon="📋" />
                                            )}
                                        </div>
                                    }
                                />
                            )}

                            {/* SAMPLE TAB */}
                            {activeTab === 'sample' && (
                                <JSONViewer
                                    data={detailData.sample || {}}
                                    title="Sample Data"
                                    defaultView="json"
                                    formattedContent={
                                        detailData.sample ? (
                                            <pre className="json-code" style={{ maxHeight: '400px', overflow: 'auto' }}>
                                                {JSON.stringify(detailData.sample, null, 2)}
                                            </pre>
                                        ) : (
                                            <EmptyState message="Click 'Generate Sample' to create sample data" icon="🎲" />
                                        )
                                    }
                                />
                            )}

                            {/* DESCRIPTORS TAB */}
                            {activeTab === 'descriptors' && (
                                <JSONViewer
                                    data={detailData.descriptors || {}}
                                    title="Schema Descriptors"
                                    formattedContent={
                                        detailData.descriptors?.results?.length > 0 ? (
                                            <div className="file-list">
                                                {detailData.descriptors.results.map((desc, i) => (
                                                    <div key={i} className="file-item">
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{desc['@type']?.split('/').pop() || 'Descriptor'}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                                {desc['xdm:sourceProperty'] || desc['xdm:sourceSchema']}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message="No descriptors found" icon="🏷️" />
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
