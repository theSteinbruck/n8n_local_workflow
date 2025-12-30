import type { Node, Edge } from 'reactflow';

/**
 * Creates a clean snapshot of the workflow for execution.
 * This ensures the execution runs on a fixed state even if the editor is modified later.
 */
export function createExecutionSnapshot(nodes: Node[], edges: Edge[]) {
    const backendNodes = nodes.map(n => ({
        id: n.id,
        name: n.data.label,
        type: n.data.type,
        typeVersion: 1,
        position: [n.position.x, n.position.y],
        parameters: n.data.parameters
    }));

    const connections: any = {};
    edges.forEach(edge => {
        if (!connections[edge.source]) {
            connections[edge.source] = { main: [[]] };
        }
        // Ensure main[0] exists
        if (!connections[edge.source].main[0]) {
            connections[edge.source].main[0] = [];
        }

        connections[edge.source].main[0].push({
            node: edge.target,
            type: 'main',
            index: 0
        });
    });

    return {
        nodes: backendNodes,
        connections
    };
}
