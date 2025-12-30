import { useState, useCallback, useEffect } from 'react';
import {
    useNodesState,
    useEdgesState,
    addEdge,
    type Node,
    type Edge,
    type Connection,
    MarkerType
} from 'reactflow';
import type { WorkflowNodeData } from '../components/WorkflowNode';

export const useWorkflowEditor = (workflowId: string) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadWorkflow = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/workflows/${workflowId}`);
            const data = await res.json();

            if (!data.nodes) {
                setNodes([]);
                setEdges([]);
                return;
            }

            const flowNodes: Node<WorkflowNodeData>[] = data.nodes.map((n: any, index: number) => {
                const position = n.ui?.position
                    ? { x: n.ui.position.x, y: n.ui.position.y }
                    : { x: 250, y: 50 + (index * 150) };

                return {
                    id: n.id,
                    type: 'workflowNode',
                    data: {
                        label: n.name || n.type,
                        type: n.type,
                        parameters: n.parameters || {},
                    },
                    position
                };
            });

            const flowEdges: Edge[] = [];
            if (data.connections) {
                Object.keys(data.connections).forEach(sourceNode => {
                    const outputs = data.connections[sourceNode];
                    if (outputs.main) {
                        outputs.main.forEach((connections: any[]) => {
                            connections.forEach(conn => {
                                flowEdges.push({
                                    id: `e-${sourceNode}-${conn.node}`,
                                    source: sourceNode,
                                    target: conn.node,
                                    markerEnd: { type: MarkerType.ArrowClosed },
                                });
                            });
                        });
                    }
                });
            }

            setNodes(flowNodes);
            setEdges(flowEdges);
        } catch (error) {
            console.error('Failed to load workflow:', error);
        } finally {
            setIsLoading(false);
        }
    }, [workflowId, setNodes, setEdges]);

    const saveWorkflow = useCallback(async () => {
        const backendNodes = nodes.map(n => ({
            id: n.id,
            name: n.data.label,
            type: n.data.type,
            parameters: n.data.parameters,
            ui: { position: n.position }
        }));

        const connections: any = {};
        edges.forEach(edge => {
            if (!connections[edge.source]) connections[edge.source] = { main: [[]] };
            connections[edge.source].main[0].push({
                node: edge.target,
                type: 'main',
                index: 0
            });
        });

        const payload = {
            nodes: backendNodes,
            connections,
            active: false
        };

        try {
            await fetch(`/api/workflows/${workflowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            alert('Workflow saved!');
        } catch (err) {
            console.error('Save failed:', err);
            alert('Error saving workflow');
        }
    }, [workflowId, nodes, edges]);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }, [setEdges]);

    const deleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    }, [setNodes, setEdges]);

    useEffect(() => {
        loadWorkflow();
    }, [loadWorkflow]);

    return {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        deleteNode,
        setNodes,
        setEdges,
        saveWorkflow,
        isLoading
    };
};
