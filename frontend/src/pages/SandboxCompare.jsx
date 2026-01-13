import { useState, useEffect } from 'react';
import { getSandboxes, getSchemas, getSegments, getDatasets } from '../services/api';

export default function SandboxCompare() {
    const [sandboxes, setSandboxes] = useState([]);
    const [leftSandbox, setLeftSandbox] = useState(null);
    const [rightSandbox, setRightSandbox] = useState(null);
    const [objectType, setObjectType] = useState('schemas');
    const [leftObjects, setLeftObjects] = useState([]);
    const [rightObjects, setRightObjects] = useState([]);
    const [selectedObject, setSelectedObject] = useState(null);
    const [comparing, setComparing] = useState(false);
    const [diffResult, setDiffResult] = useState(null);

    useEffect(() => {
        loadSandboxes();
    }, []);

    const loadSandboxes = async () => {
        try {
            const result = await getSandboxes();
            setSandboxes(result?.sandboxes || []);
            if (result?.sandboxes?.length >= 2) {
                // Default: first is Dev, second is Prod
                const devSandbox = result.sandboxes.find(s => s.type === 'development') || result.sandboxes[0];
                const prodSandbox = result.sandboxes.find(s => s.type === 'production') || result.sandboxes[1];
                setLeftSandbox(devSandbox);
                setRightSandbox(prodSandbox);
            }
        } catch (e) {
            console.error('Failed to load sandboxes', e);
        }
    };

    const loadObjects = async () => {
        if (!leftSandbox || !rightSandbox) return;
        setComparing(true);

        try {
            // Note: In real implementation, you'd pass sandbox context to API calls
            // For now we show the concept with available API
            let leftData = [];
            let rightData = [];

            switch (objectType) {
                case 'schemas':
                    const schemasRes = await getSchemas('tenant');
                    leftData = schemasRes?.results || [];
                    rightData = [...leftData]; // Demo: same data, in real impl different sandboxes
                    break;
                case 'segments':
                    const segRes = await getSegments();
                    leftData = segRes?.segments || [];
                    rightData = [...leftData];
                    break;
                case 'datasets':
                    const dsRes = await getDatasets();
                    leftData = Object.values(dsRes || {}).slice(0, 20);
                    rightData = [...leftData];
                    break;
            }

            setLeftObjects(leftData);
            setRightObjects(rightData);
        } catch (e) {
            console.error('Failed to load objects', e);
        } finally {
            setComparing(false);
        }
    };

    useEffect(() => {
        if (leftSandbox && rightSandbox) {
            loadObjects();
        }
    }, [leftSandbox, rightSandbox, objectType]);

    const getObjectName = (obj) => {
        return obj.title || obj.name || obj.$id || obj.id || 'Unnamed';
    };

    const getObjectId = (obj) => {
        return obj.$id || obj.id || obj.name;
    };

    const compareObject = (obj) => {
        setSelectedObject(obj);

        // Find matching object in right sandbox
        const rightObj = rightObjects.find(r => getObjectId(r) === getObjectId(obj));

        if (!rightObj) {
            setDiffResult({
                status: 'missing',
                message: 'Object does not exist in target sandbox',
                left: obj,
                right: null
            });
        } else {
            // Deep comparison
            const leftStr = JSON.stringify(obj, null, 2);
            const rightStr = JSON.stringify(rightObj, null, 2);

            if (leftStr === rightStr) {
                setDiffResult({
                    status: 'identical',
                    message: 'Objects are identical',
                    left: obj,
                    right: rightObj
                });
            } else {
                // Find differences
                const diffs = findDiffs(obj, rightObj);
                setDiffResult({
                    status: 'different',
                    message: `${diffs.length} differences found`,
                    diffs,
                    left: obj,
                    right: rightObj
                });
            }
        }
    };

    const findDiffs = (left, right, path = '') => {
        const diffs = [];
        const allKeys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);

        allKeys.forEach(key => {
            const newPath = path ? `${path}.${key}` : key;
            const leftVal = left?.[key];
            const rightVal = right?.[key];

            if (leftVal === undefined && rightVal !== undefined) {
                diffs.push({ path: newPath, type: 'removed', value: rightVal });
            } else if (leftVal !== undefined && rightVal === undefined) {
                diffs.push({ path: newPath, type: 'added', value: leftVal });
            } else if (typeof leftVal === 'object' && typeof rightVal === 'object' && leftVal !== null && rightVal !== null) {
                if (Array.isArray(leftVal) && Array.isArray(rightVal)) {
                    if (JSON.stringify(leftVal) !== JSON.stringify(rightVal)) {
                        diffs.push({ path: newPath, type: 'changed', left: leftVal, right: rightVal });
                    }
                } else {
                    diffs.push(...findDiffs(leftVal, rightVal, newPath));
                }
            } else if (leftVal !== rightVal) {
                diffs.push({ path: newPath, type: 'changed', left: leftVal, right: rightVal });
            }
        });

        return diffs;
    };

    const getDiffIcon = (type) => {
        switch (type) {
            case 'added': return <span style={{ color: 'var(--accent-green)' }}>+</span>;
            case 'removed': return <span style={{ color: 'var(--accent-red)' }}>-</span>;
            case 'changed': return <span style={{ color: 'var(--accent-yellow)' }}>~</span>;
            default: return null;
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>🔀 Sandbox Comparison</h1>
                <p className="page-subtitle">Compare objects between sandboxes - identify drift and sync configurations</p>
            </div>

            {/* Control Bar */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    {/* Left Sandbox */}
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Source (Dev)
                        </label>
                        <select
                            value={leftSandbox?.name || ''}
                            onChange={(e) => setLeftSandbox(sandboxes.find(s => s.name === e.target.value))}
                            style={{
                                padding: '8px 12px',
                                background: 'var(--bg-card)',
                                border: '2px solid var(--accent-yellow)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                minWidth: '180px'
                            }}
                        >
                            {sandboxes.map(sb => (
                                <option key={sb.name} value={sb.name}>
                                    {sb.type === 'development' ? '🔧' : '🏭'} {sb.title || sb.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ fontSize: '24px', color: 'var(--text-muted)' }}>→</div>

                    {/* Right Sandbox */}
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Target (Prod)
                        </label>
                        <select
                            value={rightSandbox?.name || ''}
                            onChange={(e) => setRightSandbox(sandboxes.find(s => s.name === e.target.value))}
                            style={{
                                padding: '8px 12px',
                                background: 'var(--bg-card)',
                                border: '2px solid var(--accent-red)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                minWidth: '180px'
                            }}
                        >
                            {sandboxes.map(sb => (
                                <option key={sb.name} value={sb.name}>
                                    {sb.type === 'production' ? '🏭' : '🔧'} {sb.title || sb.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Object Type */}
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Object Type
                        </label>
                        <select
                            value={objectType}
                            onChange={(e) => setObjectType(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                minWidth: '140px'
                            }}
                        >
                            <option value="schemas">📐 Schemas</option>
                            <option value="segments">👥 Segments</option>
                            <option value="datasets">📁 Datasets</option>
                        </select>
                    </div>

                    <button
                        className="btn-primary"
                        onClick={loadObjects}
                        disabled={comparing}
                        style={{ marginLeft: 'auto' }}
                    >
                        {comparing ? '⏳ Comparing...' : '🔄 Refresh'}
                    </button>
                </div>
            </div>

            {/* Comparison View */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                {/* Object List */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                        padding: '12px 16px',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontWeight: 600
                    }}>
                        {objectType.charAt(0).toUpperCase() + objectType.slice(1)} ({leftObjects.length})
                    </div>
                    <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                        {leftObjects.map((obj, i) => {
                            const rightExists = rightObjects.some(r => getObjectId(r) === getObjectId(obj));
                            return (
                                <div
                                    key={getObjectId(obj) || i}
                                    onClick={() => compareObject(obj)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        cursor: 'pointer',
                                        background: selectedObject && getObjectId(selectedObject) === getObjectId(obj)
                                            ? 'var(--accent-purple-glow)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <div className={`pulse-indicator ${rightExists ? 'recent' : 'streaming'}`}
                                        title={rightExists ? 'Exists in target' : 'Missing in target'} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 500, fontSize: '13px',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {getObjectName(obj)}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                            {getObjectId(obj)?.substring(0, 30)}...
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {leftObjects.length === 0 && (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No objects found
                            </div>
                        )}
                    </div>
                </div>

                {/* Diff View */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {diffResult ? (
                        <>
                            {/* Diff Header */}
                            <div style={{
                                padding: '12px 16px',
                                background: diffResult.status === 'identical' ? 'rgba(34,197,94,0.1)' :
                                    diffResult.status === 'missing' ? 'rgba(239,68,68,0.1)' :
                                        'rgba(234,179,8,0.1)',
                                borderBottom: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <span style={{
                                        fontWeight: 600,
                                        color: diffResult.status === 'identical' ? 'var(--accent-green)' :
                                            diffResult.status === 'missing' ? 'var(--accent-red)' :
                                                'var(--accent-yellow)'
                                    }}>
                                        {diffResult.status === 'identical' && '✅ '}
                                        {diffResult.status === 'missing' && '❌ '}
                                        {diffResult.status === 'different' && '⚠️ '}
                                        {diffResult.message}
                                    </span>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {getObjectName(selectedObject)}
                                    </div>
                                </div>
                                {diffResult.status === 'missing' && (
                                    <button className="btn-primary" style={{ fontSize: '12px' }}>
                                        📤 Create in Target
                                    </button>
                                )}
                            </div>

                            {/* Diff Content */}
                            {diffResult.status === 'different' && diffResult.diffs?.length > 0 && (
                                <div style={{ padding: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 12px', width: '40px' }}>Type</th>
                                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Path</th>
                                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Source</th>
                                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Target</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {diffResult.diffs.slice(0, 20).map((diff, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ padding: '8px 12px' }}>{getDiffIcon(diff.type)}</td>
                                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px' }}>
                                                        {diff.path}
                                                    </td>
                                                    <td style={{
                                                        padding: '8px 12px', fontSize: '11px',
                                                        background: diff.type === 'added' ? 'rgba(34,197,94,0.1)' : 'transparent',
                                                        maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'
                                                    }}>
                                                        {diff.type === 'added' ? JSON.stringify(diff.value)?.substring(0, 50) :
                                                            diff.type === 'changed' ? JSON.stringify(diff.left)?.substring(0, 50) : '-'}
                                                    </td>
                                                    <td style={{
                                                        padding: '8px 12px', fontSize: '11px',
                                                        background: diff.type === 'removed' ? 'rgba(239,68,68,0.1)' : 'transparent',
                                                        maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'
                                                    }}>
                                                        {diff.type === 'removed' ? JSON.stringify(diff.value)?.substring(0, 50) :
                                                            diff.type === 'changed' ? JSON.stringify(diff.right)?.substring(0, 50) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {diffResult.diffs.length > 20 && (
                                        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            +{diffResult.diffs.length - 20} more differences
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Raw JSON Diff View */}
                            {diffResult.status !== 'identical' && (
                                <div className="diff-container" style={{ margin: '16px' }}>
                                    <div className="diff-pane">
                                        <div className="diff-header dev">
                                            🔧 {leftSandbox?.title || leftSandbox?.name || 'Source'}
                                        </div>
                                        <pre style={{
                                            padding: '12px', fontSize: '11px',
                                            fontFamily: 'monospace', margin: 0,
                                            maxHeight: '300px', overflow: 'auto'
                                        }}>
                                            {JSON.stringify(diffResult.left, null, 2)}
                                        </pre>
                                    </div>
                                    <div className="diff-pane">
                                        <div className="diff-header prod">
                                            🏭 {rightSandbox?.title || rightSandbox?.name || 'Target'}
                                        </div>
                                        <pre style={{
                                            padding: '12px', fontSize: '11px',
                                            fontFamily: 'monospace', margin: 0,
                                            maxHeight: '300px', overflow: 'auto'
                                        }}>
                                            {diffResult.right ? JSON.stringify(diffResult.right, null, 2) : '// Not found in target'}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            padding: '60px', textAlign: 'center', color: 'var(--text-muted)'
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                            <div>Select an object from the list to compare</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Card */}
            {leftObjects.length > 0 && (
                <div className="card" style={{ marginTop: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📊 Comparison Summary</h3>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{leftObjects.length}</div>
                            <div className="stat-label">Objects in Source</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{rightObjects.length}</div>
                            <div className="stat-label">Objects in Target</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
                                {leftObjects.filter(l => rightObjects.some(r => getObjectId(r) === getObjectId(l))).length}
                            </div>
                            <div className="stat-label">In Sync</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                {leftObjects.filter(l => !rightObjects.some(r => getObjectId(r) === getObjectId(l))).length}
                            </div>
                            <div className="stat-label">Missing in Target</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
