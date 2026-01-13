import { useState, useEffect } from 'react';
import {
    getProfileByIdentity, getMergePolicies, getProfileStats,
    getMergePolicyDetails, getExperienceEvents, getProfilesByDataset,
    checkOrphanedProfiles
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, CopyButton
} from '../components/SharedComponents';

export default function Profiles() {
    const [activeTab, setActiveTab] = useState('lookup');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    // Profile Lookup State
    const [namespace, setNamespace] = useState('Email');
    const [identityValue, setIdentityValue] = useState('');
    const [profileResult, setProfileResult] = useState(null);
    const [eventsResult, setEventsResult] = useState(null);

    // Merge Policies State
    const [mergePolicies, setMergePolicies] = useState([]);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [policyDetail, setPolicyDetail] = useState(null);

    // Distribution State
    const [distribution, setDistribution] = useState(null);
    const [orphanCheck, setOrphanCheck] = useState(null);
    const [checkingOrphans, setCheckingOrphans] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [policies, profileStats] = await Promise.all([
                getMergePolicies().catch(() => ({ results: [] })),
                getProfileStats().catch(() => null)
            ]);

            const policiesList = policies?.results || policies?.children || [];
            setMergePolicies(policiesList);

            // Calculate stats from profile stats API
            setStats({
                totalProfiles: profileStats?.count || profileStats?.totalProfiles || 0,
                mergePolicies: policiesList.length,
                datasets: profileStats?.datasets || 0,
                deleteJobs: profileStats?.deleteJobs || 0
            });
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const lookupProfile = async () => {
        if (!identityValue.trim()) return;

        setLoading(true);
        setProfileResult(null);
        setEventsResult(null);

        try {
            const profile = await getProfileByIdentity(namespace, identityValue);
            setProfileResult(profile);

            // Also try to get experience events
            try {
                const events = await getExperienceEvents(namespace, identityValue);
                setEventsResult(events);
            } catch { }
        } catch (e) {
            setProfileResult({ error: e.message });
        } finally {
            setLoading(false);
        }
    };

    const viewPolicyDetail = async (policy) => {
        setSelectedPolicy(policy);
        try {
            const detail = await getMergePolicyDetails(policy.id);
            setPolicyDetail(detail);
        } catch (e) {
            setPolicyDetail(policy);
        }
    };

    const runOrphanCheck = async () => {
        setCheckingOrphans(true);
        try {
            const result = await checkOrphanedProfiles();
            setOrphanCheck(result);
        } catch (e) {
            console.error(e);
        } finally {
            setCheckingOrphans(false);
        }
    };

    const mainTabs = [
        { id: 'lookup', label: 'Profile Lookup' },
        { id: 'policies', label: 'Merge Policies', count: mergePolicies.length },
        { id: 'distribution', label: 'Distribution' }
    ];

    const namespaceOptions = [
        { code: 'Email', name: 'Email' },
        { code: 'ECID', name: 'Experience Cloud ID' },
        { code: 'Phone', name: 'Phone' },
        { code: 'GAID', name: 'Google Advertising ID' },
        { code: 'IDFA', name: 'Apple IDFA' },
        { code: 'CRMId', name: 'CRM ID' }
    ];

    // Parse profile fields for display
    const getProfileFields = (profile) => {
        if (!profile) return [];
        const fields = [];

        const extract = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    extract(value, prefix ? `${prefix}.${key}` : key);
                } else {
                    fields.push({ path: prefix ? `${prefix}.${key}` : key, value });
                }
            }
        };

        extract(profile);
        return fields.slice(0, 50); // Limit display
    };

    return (
        <>
            <div className="page-header">
                <h1>Real-time Profiles</h1>
                <p>Look up customer profiles and manage merge policies</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalProfiles?.toLocaleString() || 0}</div>
                    <div className="stat-card-label">TOTAL PROFILES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.mergePolicies || mergePolicies.length}</div>
                    <div className="stat-card-label">MERGE POLICIES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.datasets || 0}</div>
                    <div className="stat-card-label">DATASETS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">0</div>
                    <div className="stat-card-label">DELETE JOBS</div>
                </div>
            </div>

            {/* System Health Widget */}
            <div className="chart-section" style={{ marginBottom: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>System Health & Hygiene</h3>
                    <button
                        className="btn-primary"
                        onClick={runOrphanCheck}
                        disabled={checkingOrphans}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                        {checkingOrphans ? 'Analyzing...' : 'Run Hygiene Check'}
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>TOTAL PROFILES (FAST)</div>
                        <div style={{ fontSize: '24px', fontWeight: 600 }}>
                            {stats?.totalProfiles?.toLocaleString() || '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--success-green)', marginTop: '4px' }}>
                            Last updated: {new Date().toLocaleDateString()}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>INACTIVE PROFILES (&gt;90 DAYS)</div>
                        {orphanCheck ? (
                            <div>
                                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-orange)' }}>
                                    {orphanCheck.sql ? 'Query Running...' : '0'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    query_id: {orphanCheck.queryId}
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Run check to analyze
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Tabs */}
            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>

                {/* PROFILE LOOKUP TAB */}
                {activeTab === 'lookup' && (
                    <div>
                        <div className="action-bar">
                            <div className="action-bar-left">
                                <select
                                    value={namespace}
                                    onChange={e => setNamespace(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                        minWidth: '200px'
                                    }}
                                >
                                    {namespaceOptions.map(ns => (
                                        <option key={ns.code} value={ns.code}>{ns.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="Enter identity value (e.g., email@example.com)..."
                                    value={identityValue}
                                    onChange={e => setIdentityValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && lookupProfile()}
                                    style={{
                                        width: '400px', padding: '10px 16px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            <button
                                className="btn-primary"
                                onClick={lookupProfile}
                                disabled={loading}
                            >
                                {loading ? 'Looking up...' : 'Lookup Profile'}
                            </button>
                        </div>

                        {/* Profile Result */}
                        {profileResult && (
                            <div style={{ marginTop: '20px' }}>
                                {profileResult.error ? (
                                    <div style={{
                                        padding: '20px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        borderRadius: '8px',
                                        color: 'var(--accent-red)'
                                    }}>
                                        <strong>Error:</strong> {profileResult.error}
                                    </div>
                                ) : (
                                    <>
                                        <JSONViewer
                                            data={profileResult}
                                            title="Profile Data"
                                            maxHeight="500px"
                                            formattedContent={
                                                <div>
                                                    <div className="action-bar" style={{ marginBottom: '16px' }}>
                                                        <span>Profile for: <strong>{identityValue}</strong></span>
                                                        <CopyButton text={JSON.stringify(profileResult, null, 2)} label="Copy Profile" />
                                                    </div>

                                                    <table className="data-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Field Path</th>
                                                                <th>Value</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {getProfileFields(profileResult).map((field, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent-cyan)' }}>
                                                                        {field.path}
                                                                    </td>
                                                                    <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {typeof field.value === 'object'
                                                                            ? JSON.stringify(field.value)
                                                                            : String(field.value)
                                                                        }
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            }
                                        />

                                        {/* Experience Events */}
                                        {eventsResult && eventsResult.children?.length > 0 && (
                                            <JSONViewer
                                                data={eventsResult}
                                                title={`Experience Events (${eventsResult.children?.length || 0})`}
                                                defaultView="json"
                                                formattedContent={
                                                    <div className="file-list">
                                                        {eventsResult.children.slice(0, 10).map((event, i) => (
                                                            <div key={i} className="file-item">
                                                                <div>
                                                                    <div style={{ fontWeight: 500 }}>{event.eventType || 'Event'}</div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                        {event.timestamp || 'No timestamp'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                }
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {!profileResult && !loading && (
                            <EmptyState
                                message="Enter an identity value above to look up a profile"
                                icon="👤"
                            />
                        )}
                    </div>
                )}

                {/* MERGE POLICIES TAB */}
                {activeTab === 'policies' && (
                    <div>
                        {mergePolicies.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                                {/* Policies List */}
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 500 }}>
                                        Merge Policies ({mergePolicies.length})
                                    </div>
                                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                        {mergePolicies.map((policy, i) => (
                                            <div
                                                key={policy.id || i}
                                                onClick={() => viewPolicyDetail(policy)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    cursor: 'pointer',
                                                    background: selectedPolicy?.id === policy.id ? 'var(--accent-purple-glow)' : 'transparent'
                                                }}
                                            >
                                                <div style={{ fontWeight: 500 }}>{policy.name || `Policy ${i + 1}`}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {policy.default && <StatusBadge status="default" size="small" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Policy Detail */}
                                <div>
                                    {selectedPolicy ? (
                                        <JSONViewer
                                            data={policyDetail || selectedPolicy}
                                            title={selectedPolicy.name || 'Policy Details'}
                                            formattedContent={
                                                <div className="detail-grid">
                                                    <DetailField label="Policy ID" value={selectedPolicy.id} mono copyable />
                                                    <DetailField label="Name" value={selectedPolicy.name} />
                                                    <DetailField label="Default" value={selectedPolicy.default ? 'Yes' : 'No'} />
                                                    <DetailField label="Attribute Merge" value={selectedPolicy.attributeMerge?.type} />
                                                    <DetailField label="Identity Graph" value={selectedPolicy.identityGraph?.type} />
                                                    <DetailField label="Schema" value={selectedPolicy.schema?.name} />
                                                </div>
                                            }
                                        />
                                    ) : (
                                        <EmptyState message="Select a merge policy to view details" icon="📋" />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <EmptyState message="No merge policies found" icon="📋" />
                        )}
                    </div>
                )}

                {/* DISTRIBUTION TAB */}
                {activeTab === 'distribution' && (
                    <div>
                        {distribution ? (
                            <JSONViewer
                                data={distribution}
                                title="Profile Distribution Report"
                                formattedContent={
                                    <div>
                                        <div className="detail-grid" style={{ marginBottom: '20px' }}>
                                            <DetailField label="Total Profiles" value={distribution.profileCount?.toLocaleString()} />
                                            <DetailField label="Total Datasets" value={distribution.datasetCount} />
                                        </div>

                                        {distribution.datasets?.length > 0 && (
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Dataset</th>
                                                        <th>Profile Count</th>
                                                        <th>Percentage</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {distribution.datasets.map((ds, i) => (
                                                        <tr key={i}>
                                                            <td style={{ fontWeight: 500 }}>{ds.name || ds.datasetId}</td>
                                                            <td>{ds.profileCount?.toLocaleString()}</td>
                                                            <td>
                                                                {distribution.profileCount
                                                                    ? ((ds.profileCount / distribution.profileCount) * 100).toFixed(1) + '%'
                                                                    : '-'
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                }
                            />
                        ) : (
                            <EmptyState message="No distribution data available" icon="📊" />
                        )}
                    </div>
                )}
            </TabPanel>
        </>
    );
}
