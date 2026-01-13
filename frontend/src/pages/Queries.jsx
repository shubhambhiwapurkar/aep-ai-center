import { useState, useEffect } from 'react';
import {
    getQueries, getQueryStats, getQueryTemplates, getQuerySchedules,
    executeQuery as executeQueryAPI
} from '../services/api';
import { sendAgentMessage } from '../services/agent-api';
import {
    JSONViewer, TabPanel, DetailField, StatusBadge,
    LoadingSpinner, EmptyState, Modal, CopyButton
} from '../components/SharedComponents';

export default function Queries() {
    const [activeTab, setActiveTab] = useState('editor');
    const [queries, setQueries] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // SQL Editor state
    const [sqlQuery, setSqlQuery] = useState('');
    const [queryResult, setQueryResult] = useState(null);
    const [executing, setExecuting] = useState(false);
    const [queryError, setQueryError] = useState(null);
    const [explainResult, setExplainResult] = useState(null);
    const [explaining, setExplaining] = useState(false);

    // AI Optimization
    const [aiOptimization, setAiOptimization] = useState(null);
    const [aiOptimizing, setAiOptimizing] = useState(false);

    // Detail modals
    const [selectedQuery, setSelectedQuery] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [queriesData, statsData, templatesData, schedulesData] = await Promise.all([
                getQueries().catch(() => ({ queries: [] })),
                getQueryStats().catch(() => null),
                getQueryTemplates().catch(() => ({ templates: [] })),
                getQuerySchedules().catch(() => ({ schedules: [] }))
            ]);

            setQueries(queriesData?.queries || []);
            setStats(statsData);
            setTemplates(templatesData?.templates || []);
            setSchedules(schedulesData?.schedules || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (ts) => ts ? new Date(ts).toLocaleString() : 'N/A';

    const runQuery = async () => {
        if (!sqlQuery.trim()) {
            alert('Please enter a SQL query');
            return;
        }

        setExecuting(true);
        setQueryResult(null);
        setQueryError(null);

        try {
            // Call the real AEP Query Service API
            const result = await executeQueryAPI(sqlQuery.trim());

            setQueryResult({
                id: result.id,
                status: result.state || result.status,
                state: result.state,
                sql: result.sql,
                rowCount: result.rowCount || result.effectiveRowCount || 0,
                executionTime: result.elapsedTime ? `${(result.elapsedTime / 1000).toFixed(2)}s` : 'N/A',
                created: result.created,
                datasetId: result.datasetId,
                polling: result.polling,
                message: result.message,
                // Raw result for JSON viewer
                rawResult: result
            });

            // Refresh the query list
            loadData();
        } catch (error) {
            console.error('Query execution error:', error);
            setQueryError(error.message || 'Failed to execute query');
            setQueryResult({
                status: 'ERROR',
                error: error.message
            });
        } finally {
            setExecuting(false);
        }
    };

    // EXPLAIN query - get execution plan
    const explainQuery = async () => {
        if (!sqlQuery.trim()) {
            alert('Please enter a SQL query to explain');
            return;
        }

        setExplaining(true);
        setExplainResult(null);
        setQueryError(null);

        try {
            // Wrap query in EXPLAIN
            const explainSQL = `EXPLAIN ${sqlQuery.trim()}`;
            const result = await executeQueryAPI(explainSQL);

            // Parse explain results
            const plan = {
                id: result.id,
                sql: sqlQuery.trim(),
                explainSQL,
                state: result.state || 'SUBMITTED',
                planNodes: [],
                estimatedCost: 'Calculating...',
                warnings: [],
                rawResult: result
            };

            // Analyze the query for common performance issues
            const sql = sqlQuery.toLowerCase();

            if (!sql.includes('where') && !sql.includes('limit')) {
                plan.warnings.push({
                    type: 'FULL_SCAN',
                    message: 'Query has no WHERE clause or LIMIT - may scan entire table',
                    severity: 'high'
                });
            }

            if (sql.includes('select *')) {
                plan.warnings.push({
                    type: 'SELECT_STAR',
                    message: 'SELECT * retrieves all columns - consider selecting only needed columns',
                    severity: 'medium'
                });
            }

            if (sql.includes('like \'%') || sql.includes('like "%')) {
                plan.warnings.push({
                    type: 'LEADING_WILDCARD',
                    message: 'Leading wildcard in LIKE prevents index usage',
                    severity: 'high'
                });
            }

            if (!sql.includes('limit') && sql.includes('order by')) {
                plan.warnings.push({
                    type: 'UNBOUNDED_SORT',
                    message: 'ORDER BY without LIMIT may be slow on large datasets',
                    severity: 'medium'
                });
            }

            // Extract table references
            const fromMatch = sql.match(/from\s+([\w_]+)/i);
            const joinMatches = sql.matchAll(/join\s+([\w_]+)/gi);
            const tables = [fromMatch?.[1], ...[...joinMatches].map(m => m[1])].filter(Boolean);

            plan.tables = tables;
            plan.hasJoins = tables.length > 1;

            if (tables.length > 3) {
                plan.warnings.push({
                    type: 'MANY_JOINS',
                    message: `Query joins ${tables.length} tables - consider breaking into smaller queries`,
                    severity: 'medium'
                });
            }

            setExplainResult(plan);
        } catch (error) {
            console.error('Explain error:', error);
            setQueryError(error.message || 'Failed to explain query');
        } finally {
            setExplaining(false);
        }
    };

    // Get AI optimization suggestions
    const getAIOptimization = async () => {
        if (!sqlQuery.trim()) {
            alert('Please enter a SQL query to optimize');
            return;
        }

        setAiOptimizing(true);
        setAiOptimization(null);

        try {
            const response = await sendAgentMessage({
                message: `Optimize this SQL query for better performance and suggest improvements:\n\n${sqlQuery}`,
                context: { page: 'Queries', path: '/queries' }
            });

            setAiOptimization({
                suggestions: response.content || response.message,
                toolsUsed: response.toolsUsed || []
            });
        } catch (error) {
            setAiOptimization({
                error: error.message,
                suggestions: null
            });
        } finally {
            setAiOptimizing(false);
        }
    };

    const loadTemplate = (template) => {
        setSqlQuery(template.sql);
        setActiveTab('editor');
    };

    const sampleQueries = [
        'SELECT count(*) FROM profile_snapshot_db',
        'SELECT * FROM experience_events WHERE timestamp > now() - interval \'24 hours\' LIMIT 100',
        'SELECT email_address, count(*) as events FROM profile_snapshot_db GROUP BY email_address LIMIT 50',
        'CREATE TABLE dataset_output AS SELECT * FROM my_dataset WHERE active = true'
    ];

    const mainTabs = [
        { id: 'editor', label: 'SQL Editor' },
        { id: 'history', label: 'Query History' },
        { id: 'templates', label: 'Templates' },
        { id: 'schedules', label: 'Schedules' }
    ];

    return (
        <>
            <div className="page-header">
                <h1>Query Service</h1>
                <p>Execute SQL queries, manage templates and schedules</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-card-value">{stats?.totalQueries || queries.length}</div>
                    <div className="stat-card-label">TOTAL QUERIES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>
                        {stats?.byState?.RUNNING || 0}
                    </div>
                    <div className="stat-card-label">RUNNING</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-purple)' }}>
                        {templates.length}
                    </div>
                    <div className="stat-card-label">TEMPLATES</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{ color: 'var(--accent-cyan)' }}>
                        {stats?.totalSchedules || schedules.length}
                    </div>
                    <div className="stat-card-label">SCHEDULES</div>
                </div>
            </div>

            <TabPanel tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab}>
                {/* SQL EDITOR TAB */}
                {activeTab === 'editor' && (
                    <div>
                        {/* Quick Inserts */}
                        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', alignSelf: 'center' }}>Quick:</span>
                            {sampleQueries.map((q, i) => (
                                <button
                                    key={i}
                                    className="dropdown-btn"
                                    onClick={() => setSqlQuery(q)}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                >
                                    Sample {i + 1}
                                </button>
                            ))}
                        </div>

                        {/* SQL Editor */}
                        <div style={{ marginBottom: '16px' }}>
                            <textarea
                                value={sqlQuery}
                                onChange={e => setSqlQuery(e.target.value)}
                                placeholder="Enter your SQL query here...

Examples:
  SELECT * FROM profile_snapshot_db LIMIT 100
  SELECT count(*) FROM experience_events
  CREATE TABLE my_output AS SELECT * FROM my_table WHERE condition = true"
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    padding: '16px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                    lineHeight: 1.5
                                }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            <button
                                className="btn-primary"
                                onClick={runQuery}
                                disabled={executing || explaining || aiOptimizing}
                                style={{ padding: '12px 24px' }}
                            >
                                {executing ? '⏳ Executing...' : '▶ Run Query'}
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={explainQuery}
                                disabled={executing || explaining || aiOptimizing}
                                style={{ padding: '12px 16px' }}
                            >
                                {explaining ? '⏳ Analyzing...' : '📊 Explain Plan'}
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={getAIOptimization}
                                disabled={executing || explaining || aiOptimizing}
                                style={{ padding: '12px 16px' }}
                            >
                                {aiOptimizing ? '⏳ Optimizing...' : '🤖 AI Optimize'}
                            </button>
                            <button className="btn-secondary" onClick={() => { setSqlQuery(''); setExplainResult(null); setQueryResult(null); setAiOptimization(null); }}>
                                Clear
                            </button>
                            <button className="btn-secondary">
                                Save as Template
                            </button>
                        </div>

                        {/* AI Optimization Results */}
                        {aiOptimization && (
                            <div className="chart-section" style={{ padding: '16px', marginBottom: '16px', borderLeft: '3px solid var(--accent-cyan)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>🤖</span>
                                        <span style={{ fontWeight: 600 }}>AI Optimization Suggestions</span>
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => setAiOptimization(null)}
                                    >
                                        ✕ Close
                                    </button>
                                </div>

                                {aiOptimization.error ? (
                                    <div style={{ color: 'var(--accent-red)', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                                        ❌ {aiOptimization.error}
                                    </div>
                                ) : (
                                    <div style={{
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '13px',
                                        lineHeight: 1.6,
                                        background: 'var(--bg-primary)',
                                        padding: '16px',
                                        borderRadius: '8px'
                                    }}>
                                        {aiOptimization.suggestions}
                                    </div>
                                )}

                                {aiOptimization.toolsUsed?.length > 0 && (
                                    <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Tools used: {aiOptimization.toolsUsed.join(', ')}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Explain Results */}
                        {explainResult && (
                            <div className="chart-section" style={{ padding: '16px', marginBottom: '16px', borderLeft: '3px solid var(--accent-purple)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>📊</span>
                                        <span style={{ fontWeight: 600 }}>Query Explain Plan</span>
                                        <StatusBadge status={explainResult.state} />
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => setExplainResult(null)}
                                    >
                                        ✕ Close
                                    </button>
                                </div>

                                {/* Tables Referenced */}
                                {explainResult.tables?.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Tables Referenced:</div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {explainResult.tables.map((t, i) => (
                                                <span key={i} style={{
                                                    padding: '4px 10px',
                                                    background: 'var(--accent-purple-glow)',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                        {explainResult.hasJoins && (
                                            <div style={{ fontSize: '11px', color: 'var(--accent-yellow)', marginTop: '8px' }}>
                                                ⚡ Query includes JOINs - ensure indexes exist on join columns
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Performance Warnings */}
                                {explainResult.warnings?.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            Performance Analysis:
                                        </div>
                                        {explainResult.warnings.map((w, i) => (
                                            <div key={i} style={{
                                                padding: '10px 12px',
                                                marginBottom: '8px',
                                                background: w.severity === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                                                borderLeft: `3px solid ${w.severity === 'high' ? 'var(--accent-red)' : 'var(--accent-yellow)'}`,
                                                borderRadius: '4px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{w.severity === 'high' ? '🔴' : '🟡'}</span>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 500,
                                                        textTransform: 'uppercase',
                                                        color: w.severity === 'high' ? 'var(--accent-red)' : 'var(--accent-yellow)'
                                                    }}>
                                                        {w.type.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '13px', marginTop: '4px' }}>{w.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {explainResult.warnings?.length === 0 && (
                                    <div style={{
                                        padding: '16px',
                                        background: 'rgba(34,197,94,0.1)',
                                        borderRadius: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <span style={{ color: 'var(--accent-green)', fontSize: '18px' }}>✅</span>
                                        <div style={{ fontWeight: 500, marginTop: '8px' }}>No performance issues detected</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Query looks optimized</div>
                                    </div>
                                )}

                                {/* Raw EXPLAIN output */}
                                <details style={{ marginTop: '16px' }}>
                                    <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        View Raw Explain Output
                                    </summary>
                                    <pre style={{
                                        marginTop: '8px', padding: '12px',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        overflow: 'auto',
                                        maxHeight: '200px'
                                    }}>
                                        {JSON.stringify(explainResult.rawResult, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        )}

                        {/* Query Results */}
                        {queryResult && (
                            <div className="chart-section" style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div>
                                        <span style={{ fontWeight: 600, marginRight: '12px' }}>Results</span>
                                        <StatusBadge status={queryResult.status} />
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                        {queryResult.rowCount} rows • {queryResult.executionTime}
                                    </div>
                                </div>

                                {queryResult.rows && (
                                    <div style={{ overflow: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    {queryResult.columns.map(col => (
                                                        <th key={col}>{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {queryResult.rows.map((row, i) => (
                                                    <tr key={i}>
                                                        {queryResult.columns.map(col => (
                                                            <td key={col} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                                                {row[col]}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                    loading ? <LoadingSpinner text="Loading query history..." /> : (
                        <div className="chart-section" style={{ padding: 0 }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Query ID</th>
                                        <th>SQL</th>
                                        <th>State</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queries.length > 0 ? queries.map(q => (
                                        <tr key={q.id}>
                                            <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{q.id}</td>
                                            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {q.sql?.substring(0, 50)}...
                                            </td>
                                            <td><StatusBadge status={q.state} /></td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatDate(q.created)}</td>
                                            <td>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                    onClick={() => { setSqlQuery(q.sql); setActiveTab('editor'); }}
                                                >
                                                    Rerun
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                No queries found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {/* TEMPLATES TAB */}
                {activeTab === 'templates' && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {templates.length > 0 ? templates.map(template => (
                            <div key={template.id} className="stat-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
                                            {template.name}
                                        </div>
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            color: 'var(--text-muted)',
                                            background: 'var(--bg-primary)',
                                            padding: '12px',
                                            borderRadius: '6px'
                                        }}>
                                            {template.sql}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <CopyButton text={template.sql} />
                                        <button
                                            className="btn-primary"
                                            style={{ padding: '6px 12px', fontSize: '12px' }}
                                            onClick={() => loadTemplate(template)}
                                        >
                                            Use
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <EmptyState message="No templates saved" icon="📝" subtext="Save queries as templates for easy reuse" />
                        )}
                    </div>
                )}

                {/* SCHEDULES TAB */}
                {activeTab === 'schedules' && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {schedules.length > 0 ? schedules.map(schedule => (
                            <div key={schedule.id} className="stat-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{schedule.name || schedule.id}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                            Cron: {schedule.schedule?.cron || 'Not set'}
                                        </div>
                                    </div>
                                    <StatusBadge status={schedule.state || 'enabled'} />
                                </div>
                            </div>
                        )) : (
                            <EmptyState
                                message="No scheduled queries"
                                icon="⏰"
                                subtext="Schedule queries to run automatically at set intervals"
                            />
                        )}
                    </div>
                )}
            </TabPanel>

            {/* Query Detail Modal */}
            <Modal
                isOpen={!!selectedQuery}
                onClose={() => setSelectedQuery(null)}
                title="Query Details"
                width="800px"
            >
                <JSONViewer
                    data={selectedQuery || {}}
                    title="Query Information"
                    formattedContent={
                        <div className="detail-grid">
                            <DetailField label="Query ID" value={selectedQuery?.id} mono copyable />
                            <DetailField label="State" value={<StatusBadge status={selectedQuery?.state} />} />
                            <DetailField label="Created" value={formatDate(selectedQuery?.created)} />
                        </div>
                    }
                />
            </Modal>
        </>
    );
}
