import { useState, useEffect } from 'react';
import { getAuditEvents, getAuditStats, getAuditEventDetails } from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal
} from '../components/SharedComponents';

export default function AuditLog() {
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: '',
        resource: '',
        user: ''
    });

    // Pagination
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Detail modal
    const [selectedEvent, setSelectedEvent] = useState(null);

    useEffect(() => {
        loadData();
    }, [filters, page]);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const statsData = await getAuditStats().catch(() => null);
            setStats(statsData);
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const queryParams = {
                limit: 50,
                start: page * 50
            };

            // Add filters
            const properties = [];
            if (filters.action) properties.push(`action==${filters.action}`);
            if (filters.resource) properties.push(`resource==${filters.resource}`);
            if (filters.user) properties.push(`user==${filters.user}`);

            if (properties.length > 0) {
                queryParams.property = properties.join(';');
            }

            const data = await getAuditEvents(queryParams).catch(() => ({ children: [] }));
            const eventList = data?.children || data?.events || [];

            if (page === 0) {
                setEvents(eventList);
            } else {
                setEvents(prev => [...prev, ...eventList]);
            }

            setHasMore(eventList.length === 50);
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

    const getActionIcon = (action) => {
        const icons = {
            'Create': '➕',
            'Update': '✏️',
            'Delete': '🗑️',
            'Access': '👁️',
            'Enable': '✅',
            'Disable': '❌'
        };
        return icons[action] || '📝';
    };

    const getActionColor = (action) => {
        const colors = {
            'Create': 'var(--accent-green)',
            'Update': 'var(--accent-blue)',
            'Delete': 'var(--accent-red)',
            'Access': 'var(--accent-cyan)',
            'Enable': 'var(--accent-green)',
            'Disable': 'var(--accent-yellow)'
        };
        return colors[action] || 'var(--text-muted)';
    };

    // Extract unique values for filters
    const uniqueActions = [...new Set(events.map(e => e.action).filter(Boolean))];
    const uniqueResources = [...new Set(events.map(e => e.resource).filter(Boolean))];

    return (
        <>
            <div className="page-header">
                <h1>Audit Log</h1>
                <p>Track all platform activities over the last 90 days</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalEvents || events.length}</div>
                    <div className="stat-card-label">TOTAL EVENTS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.uniqueUsers || 0}</div>
                    <div className="stat-card-label">UNIQUE USERS</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.todayEvents || 0}</div>
                    <div className="stat-card-label">TODAY</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">{uniqueActions.length}</div>
                    <div className="stat-card-label">ACTION TYPES</div>
                </div>
            </div>

            {/* Filters */}
            <div className="action-bar" style={{ marginBottom: '24px' }}>
                <div className="action-bar-left">
                    <select
                        value={filters.action}
                        onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0); }}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="">All Actions</option>
                        {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>

                    <select
                        value={filters.resource}
                        onChange={e => { setFilters(f => ({ ...f, resource: e.target.value })); setPage(0); }}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="">All Resources</option>
                        {uniqueResources.slice(0, 20).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <button className="btn-secondary" onClick={() => { setPage(0); loadData(); }}>
                    Refresh
                </button>
            </div>

            {/* Events Timeline */}
            <div className="chart-section" style={{ padding: 0 }}>
                {loading && page === 0 ? (
                    <LoadingSpinner text="Loading audit events..." />
                ) : events.length > 0 ? (
                    <>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontWeight: 500 }}>Activity Timeline</span>
                            <span style={{ marginLeft: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                Showing {events.length} events
                            </span>
                        </div>

                        <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                            {events.map((event, i) => (
                                <div
                                    key={event.id || i}
                                    className="file-item"
                                    style={{
                                        margin: '0',
                                        borderRadius: 0,
                                        borderBottom: '1px solid var(--border-subtle)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setSelectedEvent(event)}
                                >
                                    <div className="file-info">
                                        <span style={{ fontSize: '20px' }}>{getActionIcon(event.action)}</span>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 500, color: getActionColor(event.action) }}>
                                                    {event.action}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)' }}>•</span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                    {event.resource}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                <span>{event.user || 'System'}</span>
                                                <span style={{ margin: '0 8px' }}>•</span>
                                                <span>{formatDate(event.timestamp || event.created)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <StatusBadge status={event.outcome || 'success'} />
                                </div>
                            ))}
                        </div>

                        {hasMore && (
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <EmptyState message="No audit events found" icon="📋" />
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                title="Audit Event Details"
                width="700px"
            >
                <JSONViewer
                    data={selectedEvent || {}}
                    title="Event Information"
                    formattedContent={
                        <div className="detail-grid">
                            <DetailField label="Event ID" value={selectedEvent?.id} mono copyable />
                            <DetailField label="Action" value={<StatusBadge status={selectedEvent?.action} />} />
                            <DetailField label="Resource" value={selectedEvent?.resource} />
                            <DetailField label="Resource ID" value={selectedEvent?.resourceId} mono />
                            <DetailField label="User" value={selectedEvent?.user || 'System'} />
                            <DetailField label="Outcome" value={<StatusBadge status={selectedEvent?.outcome || 'success'} />} />
                            <DetailField label="Timestamp" value={formatDate(selectedEvent?.timestamp || selectedEvent?.created)} />
                            <DetailField label="IP Address" value={selectedEvent?.ipAddress || 'N/A'} />
                        </div>
                    }
                />
            </Modal>
        </>
    );
}
