import { useState, useEffect } from 'react';
import { getPrivacyJobs, getPrivacyStats, getPrivacyJobDetails } from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal
} from '../components/SharedComponents';

export default function Privacy() {
    const [jobs, setJobs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Detail modal
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => {
        loadData();
    }, [filter]);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const statsData = await getPrivacyStats().catch(() => null);
            setStats(statsData);
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const params = filter !== 'all' ? { status: filter } : {};
            const data = await getPrivacyJobs(params).catch(() => ({ jobs: [] }));
            setJobs(data?.jobs || data?.children || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    const getTypeIcon = (regulation) => {
        return regulation?.includes('gdpr') ? '🇪🇺' : regulation?.includes('ccpa') ? '🇺🇸' : '🔒';
    };

    const getStatusColor = (status) => {
        const colors = {
            'complete': 'var(--accent-green)',
            'processing': 'var(--accent-blue)',
            'pending': 'var(--accent-yellow)',
            'error': 'var(--accent-red)'
        };
        return colors[status?.toLowerCase()] || 'var(--text-muted)';
    };

    return (
        <>
            <div className="page-header">
                <h1>Privacy Jobs</h1>
                <p>GDPR & CCPA compliance - Data subject requests tracking</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.total || jobs.length}</div>
                    <div className="stat-card-label">TOTAL JOBS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>
                        {stats?.processing || 0}
                    </div>
                    <div className="stat-card-label">PROCESSING</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>
                        {stats?.complete || 0}
                    </div>
                    <div className="stat-card-label">COMPLETE</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-red)' }}>
                        {stats?.error || 0}
                    </div>
                    <div className="stat-card-label">ERRORS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.gdprJobs || 0}</div>
                    <div className="stat-card-label">GDPR JOBS</div>
                </div>
            </div>

            {/* Filters */}
            <div className="action-bar" style={{ marginBottom: '24px' }}>
                <div className="action-bar-left" style={{ display: 'flex', gap: '8px' }}>
                    {['all', 'processing', 'complete', 'pending', 'error'].map(status => (
                        <button
                            key={status}
                            className={`dropdown-btn ${filter === status ? 'active' : ''}`}
                            onClick={() => setFilter(status)}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
                <button className="btn-secondary" onClick={loadData}>
                    Refresh
                </button>
            </div>

            {/* Jobs Grid */}
            {loading ? (
                <LoadingSpinner text="Loading privacy jobs..." />
            ) : jobs.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                    {jobs.map((job, i) => (
                        <div
                            key={job.jobId || i}
                            className="stat-card"
                            style={{
                                cursor: 'pointer',
                                borderLeft: `3px solid ${getStatusColor(job.status)}`
                            }}
                            onClick={() => setSelectedJob(job)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '24px' }}>{getTypeIcon(job.regulation)}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                            {job.regulation?.toUpperCase() || 'Privacy Job'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            {job.jobId}
                                        </div>
                                    </div>
                                </div>
                                <StatusBadge status={job.status} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Type</div>
                                    <div>{job.action || 'N/A'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Subjects</div>
                                    <div>{job.userIds?.length || 0} identities</div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ color: 'var(--text-muted)' }}>Created</div>
                                    <div>{formatDate(job.createdDate || job.created)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="chart-section">
                    <EmptyState
                        message="No privacy jobs found"
                        icon="🔒"
                        subtext="Privacy jobs track GDPR deletion and CCPA access requests"
                    />
                </div>
            )}

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedJob}
                onClose={() => setSelectedJob(null)}
                title="Privacy Job Details"
                width="800px"
            >
                <JSONViewer
                    data={selectedJob || {}}
                    title="Job Information"
                    formattedContent={
                        <div>
                            <div className="detail-grid">
                                <DetailField label="Job ID" value={selectedJob?.jobId} mono copyable />
                                <DetailField label="Regulation" value={selectedJob?.regulation?.toUpperCase()} />
                                <DetailField label="Status" value={<StatusBadge status={selectedJob?.status} />} />
                                <DetailField label="Action" value={selectedJob?.action} />
                                <DetailField label="Created" value={formatDate(selectedJob?.createdDate || selectedJob?.created)} />
                                <DetailField label="Last Updated" value={formatDate(selectedJob?.lastUpdatedDate || selectedJob?.updated)} />
                            </div>

                            {/* User IDs */}
                            {selectedJob?.userIds?.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <h4 style={{ marginBottom: '12px' }}>Data Subjects ({selectedJob.userIds.length})</h4>
                                    <div style={{
                                        background: 'var(--bg-primary)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        maxHeight: '200px',
                                        overflow: 'auto'
                                    }}>
                                        {selectedJob.userIds.map((id, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: '8px',
                                                    borderBottom: i < selectedJob.userIds.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                                    fontFamily: 'monospace',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                <span style={{ color: 'var(--text-muted)' }}>{id.namespace}:</span>{' '}
                                                {id.value}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Product Statuses */}
                            {selectedJob?.productStatusResponse?.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <h4 style={{ marginBottom: '12px' }}>Product Status</h4>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedJob.productStatusResponse.map((ps, i) => (
                                                <tr key={i}>
                                                    <td>{ps.productName}</td>
                                                    <td><StatusBadge status={ps.productStatus} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    }
                />
            </Modal>
        </>
    );
}
