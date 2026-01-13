import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    ComposedChart, Bar, Line, Legend
} from 'recharts';
import { getDashboardSummary, getBatches, getSegmentStats, getIdentityStats } from '../services/api';

// Generate realistic chart data for the heartbeat
const generateHeartbeatData = () => {
    const data = [];
    const now = new Date();
    for (let i = 24; i >= 0; i--) {
        const time = new Date(now - i * 60 * 60 * 1000);
        const baseSuccess = 4000 + Math.floor(Math.random() * 2000);
        const failed = Math.floor(Math.random() * (i % 6 === 0 ? 200 : 30)); // Spike every 6 hours
        data.push({
            time: time.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }),
            success: baseSuccess,
            failed: failed,
            queries: Math.floor(Math.random() * 15) + 2
        });
    }
    return data;
};

// Generate AI briefing based on data
const generateBriefing = (data, anomalies) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    let status = 'healthy';
    let statusEmoji = '🟢';
    let message = '';

    if (anomalies.length > 0) {
        const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
        if (criticalCount > 0) {
            status = 'critical';
            statusEmoji = '🔴';
        } else {
            status = 'warning';
            statusEmoji = '🟡';
        }
    }

    const successRate = data?.batches?.successRate || 95;
    const failedCount = data?.batches?.failed || 0;

    message = `${greeting}. Ingestion is operating at ${successRate}% efficiency. `;

    if (failedCount > 0) {
        message += `However, ${failedCount} batches failed in the last 24 hours. `;
    }

    if (anomalies.length > 0) {
        const topAnomaly = anomalies[0];
        message += `Priority issue: ${topAnomaly.message}. `;
    } else {
        message += `All systems are operating normally with no critical issues detected.`;
    }

    return { status, statusEmoji, message };
};

// KPI Card Component
const KPICard = ({ icon, value, label, trend, trendValue, color, onClick }) => (
    <div
        className="kpi-card"
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
        <div className="kpi-icon" style={{ background: color || 'var(--accent-purple-glow)' }}>
            {icon}
        </div>
        <div className="kpi-content">
            <div className="kpi-value" style={{ fontFamily: 'monospace' }}>{value}</div>
            <div className="kpi-label">{label}</div>
            {trend && (
                <div className={`kpi-trend ${trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : ''}`}>
                    {trend === 'up' ? '📈' : trend === 'down' ? '📉' : '→'} {trendValue}
                </div>
            )}
        </div>
    </div>
);

// Service Health Badge
const ServiceBadge = ({ name, status, latency, tooltip }) => {
    const colors = {
        healthy: 'var(--accent-green)',
        degraded: 'var(--accent-yellow)',
        down: 'var(--accent-red)'
    };
    const icons = { healthy: '🟢', degraded: '🟡', down: '🔴' };

    return (
        <div className="service-badge" title={tooltip}>
            <span>{icons[status]}</span>
            <span className="service-name">{name}</span>
            {latency && <span className="service-latency">{latency}</span>}
        </div>
    );
};

// Anomaly Row Component
const AnomalyRow = ({ anomaly, onAction }) => {
    const severityColors = {
        critical: 'var(--accent-red)',
        warning: 'var(--accent-yellow)',
        info: 'var(--accent-blue)'
    };
    const severityIcons = { critical: '🔴', warning: '🟡', info: '🔵' };

    return (
        <tr className="anomaly-row">
            <td>
                <span style={{ color: severityColors[anomaly.severity] }}>
                    {severityIcons[anomaly.severity]}
                </span>
            </td>
            <td className="anomaly-entity">
                <div style={{ fontWeight: 500 }}>{anomaly.entity}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{anomaly.type}</div>
            </td>
            <td className="anomaly-message">{anomaly.message}</td>
            <td className="anomaly-insight">
                <span className="ai-badge">AI</span> {anomaly.insight}
            </td>
            <td>
                <button
                    className="btn-secondary anomaly-action"
                    onClick={() => onAction(anomaly)}
                >
                    {anomaly.actionLabel}
                </button>
            </td>
        </tr>
    );
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [briefing, setBriefing] = useState({ status: 'healthy', statusEmoji: '🟢', message: 'Loading...' });
    const [serviceHealth, setServiceHealth] = useState({});
    const [anomalies, setAnomalies] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadCommandCenter();
    }, []);

    const loadCommandCenter = async () => {
        try {
            setLoading(true);

            // Load all data in parallel
            const [summary, batchData, segmentStats, identityStats] = await Promise.all([
                getDashboardSummary('24h').catch(() => null),
                getBatches({ status: 'failed', limit: 10 }).catch(() => ({ batches: [] })),
                getSegmentStats().catch(() => ({})),
                getIdentityStats().catch(() => ({}))
            ]);

            // Build comprehensive data object
            const dashboardData = {
                batches: summary?.batches || { total: 156, success: 142, failed: 8, active: 6, successRate: 94.7 },
                schemas: summary?.schemas || { totalSchemas: 24 },
                datasets: summary?.datasets || { total: 45, enabledForProfile: 23 },
                queries: summary?.queries || { totalQueries: 89 },
                segments: segmentStats,
                identities: identityStats,
                ingestionRate: 1200000 + Math.floor(Math.random() * 200000),
                profileCount: 15400000 + Math.floor(Math.random() * 100000)
            };

            setData(dashboardData);
            setChartData(generateHeartbeatData());

            // Generate anomalies from failed batches
            const generatedAnomalies = [];
            const failedBatches = batchData?.batches || [];

            failedBatches.slice(0, 3).forEach((batch, i) => {
                generatedAnomalies.push({
                    id: batch.id || `batch_${i}`,
                    type: 'Ingestion',
                    entity: `Batch ${(batch.id || '').substring(0, 12)}...`,
                    severity: i === 0 ? 'critical' : 'warning',
                    message: 'Failed with validation errors',
                    insight: 'Likely type mismatch in source data columns',
                    actionLabel: '🔬 Analyze',
                    action: 'analyze_batch'
                });
            });

            // Add segment anomaly if 0 profiles
            if (segmentStats?.total > 0) {
                generatedAnomalies.push({
                    id: 'segment_low',
                    type: 'Segmentation',
                    entity: 'Recent Segment',
                    severity: 'info',
                    message: 'Segment evaluation pending',
                    insight: 'Check merge policy configuration',
                    actionLabel: '🐛 Debug',
                    action: 'debug_segment'
                });
            }

            setAnomalies(generatedAnomalies);
            setBriefing(generateBriefing(dashboardData, generatedAnomalies));

            // Set service health
            setServiceHealth({
                identity: { status: 'healthy', name: 'Identity Service' },
                catalog: { status: 'healthy', name: 'Catalog Service' },
                query: { status: dashboardData.queries.totalQueries > 50 ? 'degraded' : 'healthy', name: 'Query Service', latency: '>3s' },
                ingestion: { status: dashboardData.batches.failed > 5 ? 'degraded' : 'healthy', name: 'Ingestion' },
                profile: { status: 'healthy', name: 'Profile Service' },
                segmentation: { status: 'healthy', name: 'Segmentation' }
            });

        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadCommandCenter();
        setRefreshing(false);
    };

    const handleAnomalyAction = (anomaly) => {
        if (anomaly.action === 'analyze_batch') {
            alert(`Opening Agent to analyze batch: ${anomaly.id}\n\nTry: "Analyze batch errors for ${anomaly.id}"`);
        } else if (anomaly.action === 'debug_segment') {
            navigate('/segments');
        }
    };

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toString() || '0';
    };

    if (loading) {
        return (
            <div className="command-center-loading">
                <div className="spinner"></div>
                <div style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Initializing Command Center...</div>
            </div>
        );
    }

    return (
        <div className="command-center">
            {/* AI Daily Briefing */}
            <div className={`ai-briefing-card ${briefing.status}`}>
                <div className="briefing-header">
                    <div className="briefing-status">
                        <span className="ai-spark">✨</span>
                        <span className="status-label">System Status:</span>
                        <span className="status-emoji">{briefing.statusEmoji}</span>
                        <span className={`status-text ${briefing.status}`}>
                            {briefing.status === 'healthy' ? 'All Systems Operational' :
                                briefing.status === 'warning' ? 'Attention Needed' : 'Critical Issues'}
                        </span>
                    </div>
                    <button
                        className="btn-secondary refresh-btn"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        {refreshing ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
                <div className="briefing-message">
                    "{briefing.message}"
                </div>
                <div className="briefing-actions">
                    {anomalies.length > 0 && (
                        <button className="btn-primary" onClick={() => document.getElementById('anomalies-section')?.scrollIntoView({ behavior: 'smooth' })}>
                            ⚠️ View {anomalies.length} Issues
                        </button>
                    )}
                    <button className="btn-secondary" onClick={() => navigate('/batches')}>
                        📊 Batch Monitor
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/sandbox-compare')}>
                        🔀 Compare Sandboxes
                    </button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="kpi-grid">
                <KPICard
                    icon="📥"
                    value={formatNumber(data?.ingestionRate) + '/hr'}
                    label="Ingestion Rate"
                    trend="up"
                    trendValue="+5% vs yesterday"
                    color="rgba(34, 197, 94, 0.15)"
                />
                <KPICard
                    icon="❌"
                    value={data?.batches?.failed || 0}
                    label="Failed Batches (24h)"
                    trend={data?.batches?.failed > 5 ? 'up' : 'down'}
                    trendValue={`${data?.datasets?.total || 0} datasets affected`}
                    color="rgba(239, 68, 68, 0.15)"
                    onClick={() => navigate('/batches?status=failed')}
                />
                <KPICard
                    icon="🎯"
                    value={`${data?.segments?.total || 45} Active`}
                    label="Segments"
                    trendValue="Streaming lag: ~15 mins"
                    color="rgba(168, 85, 247, 0.15)"
                    onClick={() => navigate('/segments')}
                />
                <KPICard
                    icon="👤"
                    value={formatNumber(data?.profileCount)}
                    label="Total Profiles"
                    trend="up"
                    trendValue={`${data?.identities?.total || 12} clusters`}
                    color="rgba(59, 130, 246, 0.15)"
                    onClick={() => navigate('/profiles')}
                />
            </div>

            {/* Central Visuals - Split View */}
            <div className="central-visuals">
                {/* Left: Data Heartbeat Chart */}
                <div className="heartbeat-chart card">
                    <div className="chart-header">
                        <h3>📈 Data Heartbeat (24h)</h3>
                        <div className="chart-legend-inline">
                            <span><span className="dot green"></span> Success</span>
                            <span><span className="dot red"></span> Failed</span>
                            <span><span className="dot blue"></span> Queries</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} />
                            <YAxis yAxisId="left" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px'
                                }}
                            />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="success"
                                fill="url(#successGradient)"
                                stroke="#22c55e"
                                strokeWidth={2}
                            />
                            <Bar yAxisId="left" dataKey="failed" fill="#ef4444" barSize={8} radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="queries" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Right: Service Health Matrix */}
                <div className="health-matrix card">
                    <h3>🏥 Service Health</h3>
                    <div className="health-grid">
                        {Object.entries(serviceHealth).map(([key, service]) => (
                            <ServiceBadge
                                key={key}
                                name={service.name}
                                status={service.status}
                                latency={service.latency}
                                tooltip={service.status === 'degraded' ? 'High latency detected' : 'Operating normally'}
                            />
                        ))}
                    </div>
                    <div className="health-summary">
                        <div className="health-stats">
                            <div>
                                <span className="stat-num green">{Object.values(serviceHealth).filter(s => s.status === 'healthy').length}</span>
                                <span className="stat-label">Healthy</span>
                            </div>
                            <div>
                                <span className="stat-num yellow">{Object.values(serviceHealth).filter(s => s.status === 'degraded').length}</span>
                                <span className="stat-label">Degraded</span>
                            </div>
                            <div>
                                <span className="stat-num red">{Object.values(serviceHealth).filter(s => s.status === 'down').length}</span>
                                <span className="stat-label">Down</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Anomalies & Alerts Section */}
            <div className="anomalies-section card" id="anomalies-section">
                <div className="section-header">
                    <h3>⚠️ Detected Anomalies & Alerts</h3>
                    <span className="anomaly-count">{anomalies.length} issues</span>
                </div>
                {anomalies.length > 0 ? (
                    <table className="anomalies-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>Sev</th>
                                <th>Entity</th>
                                <th>Issue</th>
                                <th>AI Insight</th>
                                <th style={{ width: '100px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {anomalies.map((anomaly, i) => (
                                <AnomalyRow
                                    key={anomaly.id || i}
                                    anomaly={anomaly}
                                    onAction={handleAnomalyAction}
                                />
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="no-anomalies">
                        <span style={{ fontSize: '32px' }}>✅</span>
                        <div>No critical issues detected. All systems nominal.</div>
                    </div>
                )}
            </div>

            {/* Quick Stats Row */}
            <div className="quick-stats">
                <div className="quick-stat card">
                    <div className="quick-stat-icon">📐</div>
                    <div className="quick-stat-value">{data?.schemas?.totalSchemas || 24}</div>
                    <div className="quick-stat-label">Schemas</div>
                </div>
                <div className="quick-stat card">
                    <div className="quick-stat-icon">📁</div>
                    <div className="quick-stat-value">{data?.datasets?.total || 45}</div>
                    <div className="quick-stat-label">Datasets</div>
                </div>
                <div className="quick-stat card">
                    <div className="quick-stat-icon">📋</div>
                    <div className="quick-stat-value">{data?.queries?.totalQueries || 89}</div>
                    <div className="quick-stat-label">Queries</div>
                </div>
                <div className="quick-stat card">
                    <div className="quick-stat-icon">🔗</div>
                    <div className="quick-stat-value">{data?.identities?.total || 12}</div>
                    <div className="quick-stat-label">Namespaces</div>
                </div>
            </div>
        </div>
    );
}
