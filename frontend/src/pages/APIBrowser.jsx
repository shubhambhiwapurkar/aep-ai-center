import { useState, useEffect, useMemo } from 'react';
import { getAPICatalog } from '../services/api';

const MethodBadge = ({ method }) => (
    <span className={`api-item-method ${method}`}>{method}</span>
);

export default function APIBrowser() {
    const [catalog, setCatalog] = useState({ categories: [], allApis: [] });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterMethod, setFilterMethod] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [selectedApi, setSelectedApi] = useState(null);

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        try {
            setLoading(true);
            const data = await getAPICatalog();
            setCatalog(data);
        } catch (error) {
            console.error('Error loading API catalog:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredApis = useMemo(() => {
        return catalog.allApis.filter(api => {
            const matchesSearch = !search ||
                api.name.toLowerCase().includes(search.toLowerCase()) ||
                api.url.toLowerCase().includes(search.toLowerCase()) ||
                api.category.toLowerCase().includes(search.toLowerCase());

            const matchesMethod = filterMethod === 'all' || api.method === filterMethod;
            const matchesCategory = filterCategory === 'all' || api.category.includes(filterCategory);

            return matchesSearch && matchesMethod && matchesCategory;
        });
    }, [catalog.allApis, search, filterMethod, filterCategory]);

    const methods = ['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const categories = ['all', ...catalog.categories.map(c => c.name)];

    if (loading) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    return (
        <>
            <div className="page-header">
                <h1>API Browser</h1>
                <p>Explore {catalog.totalEndpoints || catalog.allApis.length} AEP API endpoints</p>
            </div>

            <div className="api-browser">
                {/* API List */}
                <div className="api-list">
                    <div className="api-list-header">
                        <div className="search-input" style={{ marginBottom: '12px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search APIs..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <select
                                value={filterMethod}
                                onChange={e => setFilterMethod(e.target.value)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '6px 10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px'
                                }}
                            >
                                {methods.map(m => (
                                    <option key={m} value={m}>{m === 'all' ? 'All Methods' : m}</option>
                                ))}
                            </select>

                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '6px 10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    maxWidth: '150px'
                                }}
                            >
                                {categories.map(c => (
                                    <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                            Showing {filteredApis.length} of {catalog.allApis.length} APIs
                        </div>
                    </div>

                    <div className="api-list-items">
                        {filteredApis.map((api, index) => (
                            <div
                                key={`${api.category}-${api.name}-${index}`}
                                className={`api-item ${selectedApi === api ? 'active' : ''}`}
                                onClick={() => setSelectedApi(api)}
                            >
                                <div>
                                    <MethodBadge method={api.method} />
                                    <span className="api-item-name">{api.name}</span>
                                </div>
                                <div className="api-item-category">{api.category}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* API Detail */}
                <div className="api-detail">
                    {selectedApi ? (
                        <>
                            <h2 style={{ marginBottom: '8px' }}>{selectedApi.name}</h2>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                                {selectedApi.category}
                            </div>

                            <div className="api-detail-url">
                                <MethodBadge method={selectedApi.method} />
                                <span style={{ marginLeft: '10px' }}>{selectedApi.url}</span>
                            </div>

                            {selectedApi.description && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>DESCRIPTION</h4>
                                    <p style={{ fontSize: '13px', lineHeight: 1.6 }}>{selectedApi.description}</p>
                                </div>
                            )}

                            {selectedApi.queryParams?.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>QUERY PARAMETERS</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {selectedApi.queryParams.map(param => (
                                            <span
                                                key={param}
                                                style={{
                                                    background: 'var(--bg-secondary)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    fontFamily: 'monospace'
                                                }}
                                            >
                                                {param}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedApi.pathParams?.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>PATH PARAMETERS</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {selectedApi.pathParams.map(param => (
                                            <span
                                                key={param}
                                                style={{
                                                    background: 'rgba(139, 92, 246, 0.2)',
                                                    color: 'var(--accent-purple)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    fontFamily: 'monospace'
                                                }}
                                            >
                                                :{param}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '300px',
                            color: 'var(--text-muted)'
                        }}>
                            Select an API to view details
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
