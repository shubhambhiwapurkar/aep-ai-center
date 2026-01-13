import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getDatasets, getSegments } from '../services/api';
import { LoadingSpinner, Modal } from '../components/SharedComponents';

/**
 * Custom Node Component for Data Lineage with Handles for edges
 */
const CustomNode = ({ data }) => {
    const colors = {
        source: '#0EA5E9',
        flow: '#EAB308',
        dataset: '#22C55E',
        segment: '#A855F7',
        destination: '#EF4444'
    };

    const borderColor = colors[data.type] || '#6B7280';

    return (
        <div style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: `2px solid ${borderColor}`,
            borderRadius: '10px',
            minWidth: '160px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            position: 'relative'
        }}>
            {/* Input handle (left side) */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    width: '10px',
                    height: '10px',
                    background: borderColor,
                    border: '2px solid var(--bg-card)',
                    left: '-6px'
                }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{data.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontWeight: 500,
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text-primary)'
                    }}>
                        {data.label}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {data.type}
                    </div>
                </div>
                {data.profileEnabled && (
                    <span title="Profile Enabled" style={{ fontSize: '12px' }}>👤</span>
                )}
            </div>

            {/* Output handle (right side) */}
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    width: '10px',
                    height: '10px',
                    background: borderColor,
                    border: '2px solid var(--bg-card)',
                    right: '-6px'
                }}
            />
        </div>
    );
};

const nodeTypes = { custom: CustomNode };

export default function DataLineage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        loadLineageData();
    }, []);

    const loadLineageData = async () => {
        setLoading(true);
        try {
            const [datasetsRes, segmentsRes] = await Promise.all([
                getDatasets().catch(() => ({})),
                getSegments().catch(() => ({ segments: [] }))
            ]);

            const datasetsList = Object.entries(datasetsRes || {}).slice(0, 10).map(([id, ds]) => ({ id, ...ds }));
            const segmentsList = (segmentsRes?.segments || []).slice(0, 8);

            // Generate flows from datasets
            const flowsList = datasetsList.slice(0, 6).map((ds, i) => ({
                id: `flow-${i}`,
                name: `Ingest ${ds.name || 'Data'}`.slice(0, 25),
                sourceConnectionId: ['source-crm', 'source-web', 'source-mobile'][i % 3]
            }));

            const graphNodes = [];
            const graphEdges = [];
            let yOffset = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

            // Lane positions (x coordinate)
            const laneX = { 0: 100, 1: 350, 2: 600, 3: 850, 4: 1100 };

            // Sources
            const sources = flowsList.map(f => f.sourceConnectionId).filter(Boolean);
            if (sources.length === 0) sources.push('source-crm', 'source-web', 'source-mobile');

            [...new Set(sources)].slice(0, 4).forEach((src, i) => {
                graphNodes.push({
                    id: src,
                    type: 'custom',
                    position: { x: laneX[0], y: yOffset[0] },
                    data: {
                        type: 'source',
                        label: src.includes('source-') ? src.replace('source-', '').toUpperCase() : `Source ${i + 1}`,
                        icon: '📥'
                    }
                });
                yOffset[0] += 80;
            });

            // Flows
            flowsList.forEach((flow, i) => {
                const nodeId = flow.id || `flow-${i}`;
                graphNodes.push({
                    id: nodeId,
                    type: 'custom',
                    position: { x: laneX[1], y: yOffset[1] },
                    data: {
                        type: 'flow',
                        label: flow.name || `Flow ${i + 1}`,
                        icon: '🔄',
                        raw: flow
                    }
                });
                yOffset[1] += 80;

                // Connect source to flow
                const sourceId = flow.sourceConnectionId || sources[i % sources.length];
                if (sourceId) {
                    graphEdges.push({
                        id: `${sourceId}-${nodeId}`,
                        source: sourceId,
                        target: nodeId,
                        animated: true,
                        style: { stroke: '#EAB308' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#EAB308' }
                    });
                }
            });

            // Datasets
            datasetsList.forEach((ds, i) => {
                graphNodes.push({
                    id: ds.id,
                    type: 'custom',
                    position: { x: laneX[2], y: yOffset[2] },
                    data: {
                        type: 'dataset',
                        label: ds.name || `Dataset ${i + 1}`,
                        icon: '📁',
                        profileEnabled: ds.tags?.unifiedProfile?.[0] === 'enabled',
                        raw: ds
                    }
                });
                yOffset[2] += 80;

                // Connect flow to dataset
                if (flowsList[i % flowsList.length]) {
                    const flowId = flowsList[i % flowsList.length].id || `flow-${i % flowsList.length}`;
                    graphEdges.push({
                        id: `${flowId}-${ds.id}`,
                        source: flowId,
                        target: ds.id,
                        animated: true,
                        style: { stroke: '#22C55E' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#22C55E' }
                    });
                }
            });

            // Segments
            segmentsList.forEach((seg, i) => {
                graphNodes.push({
                    id: seg.id,
                    type: 'custom',
                    position: { x: laneX[3], y: yOffset[3] },
                    data: {
                        type: 'segment',
                        label: seg.name || `Segment ${i + 1}`,
                        icon: '👥',
                        raw: seg
                    }
                });
                yOffset[3] += 80;

                // Connect dataset to segment
                if (datasetsList[i % datasetsList.length]) {
                    graphEdges.push({
                        id: `${datasetsList[i % datasetsList.length].id}-${seg.id}`,
                        source: datasetsList[i % datasetsList.length].id,
                        target: seg.id,
                        animated: true,
                        style: { stroke: '#A855F7' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#A855F7' }
                    });
                }
            });

            // Destinations
            const destinations = [
                { id: 'dest-facebook', label: 'Facebook Ads', icon: '📢' },
                { id: 'dest-google', label: 'Google Ads', icon: '🔍' },
                { id: 'dest-email', label: 'Email Platform', icon: '📧' },
                { id: 'dest-salesforce', label: 'Salesforce', icon: '☁️' }
            ];

            destinations.forEach((dest, i) => {
                graphNodes.push({
                    id: dest.id,
                    type: 'custom',
                    position: { x: laneX[4], y: yOffset[4] },
                    data: {
                        type: 'destination',
                        label: dest.label,
                        icon: dest.icon
                    }
                });
                yOffset[4] += 80;

                // Connect segment to destination
                if (segmentsList[i % segmentsList.length]) {
                    graphEdges.push({
                        id: `${segmentsList[i % segmentsList.length].id}-${dest.id}`,
                        source: segmentsList[i % segmentsList.length].id,
                        target: dest.id,
                        animated: true,
                        style: { stroke: '#EF4444' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#EF4444' }
                    });
                }
            });

            setNodes(graphNodes);
            setEdges(graphEdges);
        } catch (error) {
            console.error('Failed to load lineage:', error);
        } finally {
            setLoading(false);
        }
    };

    const onNodeClick = useCallback((event, node) => {
        setSelectedNode(node);
    }, []);

    const navigateToDetail = (node) => {
        const type = node.data.type;
        if (type === 'dataset') navigate(`/datasets?id=${node.id}`);
        else if (type === 'segment') navigate(`/segments?id=${node.id}`);
        else if (type === 'flow') navigate('/destinations');
        setSelectedNode(null);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>🔗 Data Lineage</h1>
                        <p className="page-subtitle">Interactive visualization of data flow</p>
                    </div>
                    <button className="btn-secondary" onClick={loadLineageData}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    {[
                        { type: 'source', color: '#0EA5E9', label: 'Sources' },
                        { type: 'flow', color: '#EAB308', label: 'Data Flows' },
                        { type: 'dataset', color: '#22C55E', label: 'Datasets' },
                        { type: 'segment', color: '#A855F7', label: 'Segments' },
                        { type: 'destination', color: '#EF4444', label: 'Destinations' }
                    ].map(item => (
                        <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color }} />
                            <span style={{ fontSize: '13px' }}>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading lineage data..." />
            ) : (
                <div className="card" style={{ height: '600px', padding: 0, overflow: 'hidden' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        attributionPosition="bottom-left"
                    >
                        <Controls />
                        <Background color="var(--border-subtle)" gap={20} />
                    </ReactFlow>
                </div>
            )}

            {/* Node Detail Modal */}
            <Modal
                isOpen={!!selectedNode}
                onClose={() => setSelectedNode(null)}
                title={selectedNode ? `${selectedNode.data.icon} ${selectedNode.data.label}` : ''}
                width="500px"
            >
                {selectedNode && (
                    <div>
                        <div className="detail-grid" style={{ marginBottom: '20px' }}>
                            <div className="detail-field">
                                <label>Type</label>
                                <span style={{ textTransform: 'capitalize' }}>{selectedNode.data.type}</span>
                            </div>
                            <div className="detail-field">
                                <label>ID</label>
                                <code style={{ fontSize: '11px' }}>{selectedNode.id}</code>
                            </div>
                            {selectedNode.data.profileEnabled && (
                                <div className="detail-field">
                                    <label>Profile Enabled</label>
                                    <span style={{ color: 'var(--accent-green)' }}>✓ Yes</span>
                                </div>
                            )}
                        </div>

                        {['dataset', 'segment', 'flow'].includes(selectedNode.data.type) && (
                            <button className="btn-primary" onClick={() => navigateToDetail(selectedNode)} style={{ width: '100%' }}>
                                📋 View Full Details
                            </button>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
