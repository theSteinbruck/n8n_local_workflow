import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlowProvider,
    useReactFlow,
    type Node
} from 'reactflow';
import 'reactflow/dist/style.css';

import { WorkflowNode, type WorkflowNodeData } from './components/WorkflowNode';
import { ExecutionSidebar } from './components/ExecutionSidebar';
import { NodeInspector } from './components/NodeInspector';
import { validateWorkflow } from './utils/workflowValidation';
import { useNodeTypes } from './hooks/useNodeTypes';
import { useWorkflowEditor } from './hooks/useWorkflowEditor';
import { useExecutionViewer } from './hooks/useExecutionViewer';
import { createExecutionSnapshot } from './utils/workflow-utils';
import { UIMode } from './types/ui-modes';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';

const nodeTypes = {
    workflowNode: WorkflowNode,
};

interface WorkflowCanvasProps {
    workflowId: string;
}

const controlBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    color: '#444',
    padding: '8px 12px',
    borderRadius: '20px',
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const WorkflowCanvasContent: React.FC<WorkflowCanvasProps> = ({ workflowId }) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [uiMode, setUiMode] = useState<UIMode>(UIMode.EDIT);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

    const { project, fitView } = useReactFlow();
    const { nodeTypes: nodeTypesMap } = useNodeTypes();

    // 1. Editor State
    const {
        nodes: editorNodes,
        edges: editorEdges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        deleteNode,
        setNodes,
        saveWorkflow
    } = useWorkflowEditor(workflowId);

    // 2. Execution State
    const {
        executionId,
        status: executionStatus,
        steps,
        nodeStatuses,
        subscribe,
        clear: clearExecution,
        isConnected
    } = useExecutionViewer();

    // Auto-select failing node
    useEffect(() => {
        const failingNode = Object.entries(nodeStatuses).find(([_, data]) => data.status === 'error');
        if (failingNode) {
            setSelectedNodeId(failingNode[0]);
        }
    }, [nodeStatuses]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                saveWorkflow();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveWorkflow]);

    // 3. Derived State
    const displayNodes = useMemo(() => {
        return editorNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                status: nodeStatuses[node.id]?.status || 'pending',
                errorMessage: nodeStatuses[node.id]?.errorMessage,
                errorStack: nodeStatuses[node.id]?.errorStack,
                errors: validationErrors[node.id] || []
            }
        }));
    }, [editorNodes, nodeStatuses, validationErrors]);

    const displayEdges = useMemo(() => {
        return editorEdges.map(edge => {
            const sourceStatus = nodeStatuses[edge.source]?.status;

            let style: React.CSSProperties = { stroke: '#ccc', strokeWidth: 2 };
            let animated = false;

            if (sourceStatus === 'success') {
                style = { stroke: '#4caf50', strokeWidth: 3 };
                animated = uiMode === UIMode.RUN || uiMode === UIMode.REPLAY;
            } else if (sourceStatus === 'running') {
                style = { stroke: '#ff9800', strokeWidth: 3 };
                animated = true;
            } else if (sourceStatus === 'error') {
                style = { stroke: '#f44336', strokeWidth: 2 };
            } else if (uiMode !== UIMode.EDIT) {
                // Dim edges in execution mode if not yet reached
                style = { stroke: '#eee', strokeWidth: 2, opacity: 0.5 };
            }

            return {
                ...edge,
                style,
                animated
            };
        });
    }, [editorEdges, nodeStatuses, uiMode]);

    const selectedNode = useMemo(() => {
        return displayNodes.find(n => n.id === selectedNodeId) || null;
    }, [displayNodes, selectedNodeId]);

    // Handlers
    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onUpdateNodeParameters = useCallback((nodeId: string, newParameters: any, validationErrors: any[] = []) => {
        if (uiMode !== UIMode.EDIT) return;
        setNodes((nds) => nds.map((node) => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        parameters: newParameters,
                        errors: validationErrors.map(e => e.message)
                    }
                };
            }
            return node;
        }));
    }, [uiMode, setNodes]);

    const onUpdateNodeData = useCallback((nodeId: string, newData: Partial<WorkflowNodeData>) => {
        if (uiMode !== UIMode.EDIT) return;
        setNodes((nds) => nds.map((node) => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...newData
                    }
                };
            }
            return node;
        }));
    }, [uiMode, setNodes]);

    const onNodesDelete = useCallback((deletedNodes: Node[]) => {
        deletedNodes.forEach(node => {
            deleteNode(node.id);
        });
        setSelectedNodeId(null);
    }, [deleteNode]);

    const runExecution = useCallback(async () => {
        if (!isConnected) return;

        const validationErrorsList = validateWorkflow(editorNodes, editorEdges, nodeTypesMap);
        if (validationErrorsList.length > 0) {
            const errorsByNode: Record<string, string[]> = {};
            validationErrorsList.forEach(err => {
                if (err.nodeId) {
                    if (!errorsByNode[err.nodeId]) errorsByNode[err.nodeId] = [];
                    errorsByNode[err.nodeId].push(err.message);
                }
            });
            setValidationErrors(errorsByNode);

            // Sync errors back to nodes for canvas visibility
            setNodes(nds => nds.map(node => ({
                ...node,
                data: {
                    ...node.data,
                    errors: errorsByNode[node.id] || []
                }
            })));

            alert('Cannot run workflow: Validation failed. Check highlighted nodes.');
            return;
        }

        setValidationErrors({});
        setUiMode(UIMode.RUN);

        const workflowSnapshot = createExecutionSnapshot(editorNodes, editorEdges);
        const workflowPayload = {
            id: workflowId,
            name: 'Canvas Run',
            ...workflowSnapshot,
            active: false
        };

        try {
            const res = await fetch('/api/executions/canvas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflow: workflowPayload })
            });

            if (!res.ok) throw new Error('Failed to start execution');
            const data = await res.json();
            subscribe(data.executionId);
        } catch (err: any) {
            console.error(err);
            alert(`Failed to run workflow: ${err.message}`);
            setUiMode(UIMode.EDIT);
        }
    }, [isConnected, editorNodes, editorEdges, workflowId, subscribe]);

    const onDrop = useCallback((event: React.DragEvent) => {
        if (uiMode !== UIMode.EDIT) return;
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        const position = project({
            x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left || 0),
            y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top || 0),
        });

        const newNode: Node<WorkflowNodeData> = {
            id: `node-${Date.now()}`,
            type: 'workflowNode',
            position,
            data: { label: type, type: type, parameters: {} },
        };

        setNodes((nds) => nds.concat(newNode));
        setSelectedNodeId(newNode.id);
    }, [uiMode, project, setNodes]);

    const switchToEditMode = useCallback(() => {
        setUiMode(UIMode.EDIT);
        clearExecution();
    }, [clearExecution]);

    const handleNodeHighlight = useCallback((nodeId: string) => {
        setSelectedNodeId(nodeId);
        fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 0.5 });
    }, [fitView]);

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
            <TopBar
                workflowName={`${workflowId.substring(0, 8)}`}
                uiMode={uiMode}
                onSave={saveWorkflow}
                onRun={runExecution}
                onBackToEditor={switchToEditMode}
                executionId={executionId}
                executionStatus={executionStatus}
            />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <LeftSidebar />

                <div style={{ flex: 1, position: 'relative', background: '#f8fafc' }} ref={reactFlowWrapper}>
                    {uiMode !== UIMode.EDIT && (
                        <div style={{
                            position: 'absolute',
                            top: 10,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 100,
                            background: 'rgba(51, 51, 51, 0.8)',
                            color: 'white',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#4caf50',
                                animation: 'pulse-dot 2s infinite'
                            }} />
                            {uiMode === UIMode.RUN ? 'VIEWING RUN' : 'VIEWING REPLAY'} (READ ONLY)
                        </div>
                    )}
                    <ReactFlow
                        nodes={displayNodes}
                        edges={displayEdges}
                        onNodesChange={uiMode === UIMode.EDIT ? onNodesChange : undefined}
                        onEdgesChange={uiMode === UIMode.EDIT ? onEdgesChange : undefined}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onNodesDelete={onNodesDelete}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                        nodeTypes={nodeTypes as any}
                        fitView
                        nodesDraggable={uiMode === UIMode.EDIT}
                        nodesConnectable={uiMode === UIMode.EDIT}
                        elementsSelectable={true}
                        defaultEdgeOptions={{ type: 'smoothstep' }}
                    >
                        <Background color="#e2e8f0" gap={16} variant={BackgroundVariant.Dots} />
                        <Controls />
                        <MiniMap
                            nodeStrokeColor={(n: any) => {
                                if (n.data.status === 'error') return '#f44336';
                                if (n.data.status === 'success') return '#4caf50';
                                return '#eee';
                            }}
                            nodeColor={(n: any) => {
                                if (n.data.status === 'running') return '#ff9800';
                                return '#fff';
                            }}
                            style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </ReactFlow>
                </div>

                {selectedNode && (
                    <NodeInspector
                        node={selectedNode}
                        isOpen={!!selectedNode}
                        onClose={() => setSelectedNodeId(null)}
                        onUpdate={onUpdateNodeParameters}
                        onUpdateData={onUpdateNodeData}
                        onNodesDelete={onNodesDelete}
                        readOnly={uiMode !== UIMode.EDIT}
                        allNodeNames={editorNodes.map(n => n.data.label || n.id)}
                        executionSteps={steps}
                    />
                )}

                <ExecutionSidebar
                    steps={steps}
                    isOpen={isSidebarOpen}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    onSelectNode={handleNodeHighlight}
                />

                {/* Floating Canvas Controls */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'white',
                    padding: '8px',
                    borderRadius: '50px',
                    display: 'flex',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    border: '1px solid #eee'
                }}>
                    <button
                        onClick={() => fitView()}
                        style={{ ...controlBtnStyle, width: '90px' }}
                    >
                        🎯 Fit View
                    </button>
                    <button
                        onClick={() => saveWorkflow()}
                        style={{ ...controlBtnStyle, width: '90px', color: '#0070f3' }}
                    >
                        💾 Save (⌘S)
                    </button>
                </div>

                <style>{`
                    @keyframes pulse-dot {
                        0% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.4; transform: scale(1.2); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                `}</style>
            </div>
        </div>
    );
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasContent {...props} />
        </ReactFlowProvider>
    );
};
