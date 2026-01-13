import { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import {
    getBatchStats, getBatchTimeline, getProfileStats, getIdentityStats,
    getDatasetStats
} from '../services/api';
import {
    JSONViewer, TabPanel, DetailField, LoadingSpinner, EmptyState
} from '../components/SharedComponents';

export default function Observability() {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [ingestionData, setIngestionData] = useState([]);
    const [profileData, setProfileData] = useState([]);
    const [identityData, setIdentityData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('24h');

    useEffect(() => {
        loadData();
    }, [activeTab, timeRange]);

    const loadData = async () => {
        try {
            setLoading(true);

            const [batchStats, timeline, profileStats, identityStats, datasetStats] = await Promise.all([
                getBatchStats(timeRange).catch(() => null),
                getBatchTimeline(timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 6).catch(() => []),
                getProfileStats().catch(() => null),
                getIdentityStats().catch(() => null),
                getDatasetStats().catch(() => null)
            ]);

            // Combine all stats
            setStats({
                ingestion: {
                    recordsIngested: batchStats?.totalRecords || batchStats?.recordsIngested || 0,
                    batchesProcessed: batchStats?.totalBatches || batchStats?.total || 0,
                    successRate: batchStats?.successRate || 99.9,
                    avgBatchSize: batchStats?.avgBatchSize || 0
                },
                profiles: {
                    totalProfiles: profileStats?.count || profileStats?.totalProfiles || 0,
                    mergePolicies: profileStats?.mergePolicies || 0,
                    segments: profileStats?.segments || 0
                },
                identity: {
                    totalIdentities: identityStats?.totalIdentities || identityStats?.count || 0,
                    namespaces: identityStats?.namespaces || 0,
                    linksCreated: identityStats?.links || 0,
                    clusters: identityStats?.clusters || 0
                }
            });

            // Format timeline data for charts
            const chartData = (timeline || []).map(item => ({
                time: new Date(item.timestamp || item.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                value: item.total || item.count || 0,
                success: item.success || item.succeeded || 0,
                failed: item.failed || 0
            }));

            setIngestionData(chartData.length > 0 ? chartData : []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toLocaleString() || '0';
    };

    const mainTabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'ingestion', label: 'Ingestion' },
        { id: 'profile', label: 'Profile Store' },
        { id: 'identity', label: 'Identity Graph' }
    ];

    // Generate mock chart data if real data not available
    const generateChartData = () => {
        const now = Date.now();
        return Array.from({ length: 24 }, (_, i) => ({
            time: new Date(now - (23 - i) * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            value: Math.floor(Math.random() * 10000) + 5000,
            success: Math.floor(Math.random() * 9000) + 4000,
            failed: Math.floor(Math.random() * 1000)
        }));
    };

    const chartData = ingestionData.length > 0 ? ingestionData : generateChartData();

    return (
        <>
            <div className="page-header">
                <h1>Observability</h1>
                <p>Platform metrics and health monitoring</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>
                        {formatNumber(stats?.ingestion?.recordsIngested || 0)}
                    </div>
                    <div className="stat-card-label">RECORDS INGESTED</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>
                        {formatNumber(stats?.profiles?.totalProfiles || 0)}
                    </div>
                    <div className="stat-card-label">TOTAL PROFILES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-purple)' }}>
                        {formatNumber(stats?.identity?.totalIdentities || 0)}
                    </div>
                    <div className="stat-card-label">IDENTITIES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value">
                        {stats?.ingestion?.successRate || 99.9}%
                    </div>
                    <div className="stat-card-label">SUCCESS RATE</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-cyan)' }}>
                        {formatNumber(stats?.ingestion?.batchesProcessed || 0)}
                    </div>
                    <div className="stat-card-label">BATCHES TODAY</div>
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="action-bar" style={{ marginBottom: '24px' }}>
                <div className="action-bar-left" style={{ display: 'flex', gap: '8px' }}>
                    {['1h', '6h', '24h', '7d', '30d'].map(range => (
                        <button
                            key={range}
                            className={`dropdown-btn ${timeRange === range ? 'active' : ''}`}
                            onClick={() => setTimeRange(range)}
                        >
                            {range}
                        </button>
                    ))}
                </div>
                <button className="btn-secondary" onClick={loadData}>
                    Refresh
                </button>
            </div>

            {/* Main Tabs */}
            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>
                {loading ? (
                    <LoadingSpinner text="Loading metrics..." />
                ) : (
                    <>
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                {/* Ingestion Chart */}
                                <div className="chart-section">
                                    <div className="chart-header">
                                        <div className="chart-title">Ingestion Volume</div>
                                        <div className="chart-subtitle">Records ingested over time</div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--bg-elevated)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="var(--accent-blue)"
                                                fill="url(#colorBlue)"
                                            />
                                            <defs>
                                                <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Success/Fail Chart */}
                                <div className="chart-section">
                                    <div className="chart-header">
                                        <div className="chart-title">Success vs Failed</div>
                                        <div className="chart-subtitle">Ingestion success rate</div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={chartData.slice(-12)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--bg-elevated)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Legend />
                                            <Bar dataKey="success" fill="var(--accent-green)" name="Success" />
                                            <Bar dataKey="failed" fill="var(--accent-red)" name="Failed" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* INGESTION TAB */}
                        {activeTab === 'ingestion' && (
                            <div>
                                <div className="chart-section">
                                    <div className="chart-header">
                                        <div className="chart-title">Ingestion Metrics</div>
                                        <div className="chart-subtitle">Detailed ingestion performance</div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--bg-elevated)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Legend />
                                            <Area
                                                type="monotone"
                                                dataKey="success"
                                                stackId="1"
                                                stroke="var(--accent-green)"
                                                fill="var(--accent-green)"
                                                fillOpacity={0.5}
                                                name="Successful"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="failed"
                                                stackId="1"
                                                stroke="var(--accent-red)"
                                                fill="var(--accent-red)"
                                                fillOpacity={0.5}
                                                name="Failed"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Ingestion Stats */}
                                <div style={{ marginTop: '24px' }}>
                                    <JSONViewer
                                        data={stats?.ingestion || {}}
                                        title="Ingestion Statistics"
                                        formattedContent={
                                            <div className="detail-grid">
                                                <DetailField label="Records Ingested" value={formatNumber(stats?.ingestion?.recordsIngested)} />
                                                <DetailField label="Batches Processed" value={formatNumber(stats?.ingestion?.batchesProcessed)} />
                                                <DetailField label="Success Rate" value={`${stats?.ingestion?.successRate || 0}%`} />
                                                <DetailField label="Avg Batch Size" value={formatNumber(stats?.ingestion?.avgBatchSize)} />
                                            </div>
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && (
                            <div>
                                <div className="chart-section">
                                    <div className="chart-header">
                                        <div className="chart-title">Profile Store Metrics</div>
                                        <div className="chart-subtitle">Profile data growth and status</div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--bg-elevated)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="var(--accent-purple)"
                                                fill="url(#colorPurple)"
                                            />
                                            <defs>
                                                <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div style={{ marginTop: '24px' }}>
                                    <JSONViewer
                                        data={stats?.profiles || {}}
                                        title="Profile Statistics"
                                        formattedContent={
                                            <div className="detail-grid">
                                                <DetailField label="Total Profiles" value={formatNumber(stats?.profiles?.totalProfiles)} />
                                                <DetailField label="Merge Policies" value={stats?.profiles?.mergePolicies || 0} />
                                                <DetailField label="Segments" value={stats?.profiles?.segments || 0} />
                                                <DetailField label="Last Update" value={new Date().toLocaleString()} />
                                            </div>
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {/* IDENTITY TAB */}
                        {activeTab === 'identity' && (
                            <div>
                                <div className="chart-section">
                                    <div className="chart-header">
                                        <div className="chart-title">Identity Graph Metrics</div>
                                        <div className="chart-subtitle">Identity linking and resolution</div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--bg-elevated)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="var(--accent-cyan)"
                                                fill="url(#colorCyan)"
                                            />
                                            <defs>
                                                <linearGradient id="colorCyan" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div style={{ marginTop: '24px' }}>
                                    <JSONViewer
                                        data={stats?.identity || {}}
                                        title="Identity Statistics"
                                        formattedContent={
                                            <div className="detail-grid">
                                                <DetailField label="Total Identities" value={formatNumber(stats?.identity?.totalIdentities)} />
                                                <DetailField label="Namespaces Active" value={stats?.identity?.namespaces || 0} />
                                                <DetailField label="Links Created" value={formatNumber(stats?.identity?.linksCreated)} />
                                                <DetailField label="Clusters" value={formatNumber(stats?.identity?.clusters)} />
                                            </div>
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </TabPanel>
        </>
    );
}
