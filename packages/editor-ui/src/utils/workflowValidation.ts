import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from '../components/WorkflowNode';
import type { NodeType } from '../hooks/useNodeTypes';
import { validateNodeParameters } from './validation';

export interface ValidationError {
    nodeId: string;
    nodeLabel: string;
    message: string;
}

export function validateWorkflow(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    nodeTypes?: Record<string, NodeType>
): ValidationError[] {
    const errors: ValidationError[] = [];

    // 1. Trigger Rules
    const triggerNodes = nodes.filter(n => n.data.type === 'ManualTrigger');

    if (triggerNodes.length > 1) {
        triggerNodes.forEach(trigger => {
            errors.push({
                nodeId: trigger.id,
                nodeLabel: trigger.data.label,
                message: 'Only one manual trigger allowed'
            });
        });
    }

    if (triggerNodes.length === 1) {
        const trigger = triggerNodes[0];
        const hasOutgoing = edges.some(e => e.source === trigger.id);
        if (!hasOutgoing) {
            errors.push({
                nodeId: trigger.id,
                nodeLabel: trigger.data.label,
                message: 'Trigger is not connected to any node'
            });
        }
    }

    // 2. Connectivity Rules
    const reachableNodes = new Set<string>();
    if (nodes.length > 0) {
        const startNodes = triggerNodes.length > 0
            ? triggerNodes.map(n => n.id)
            : [nodes[0].id];

        const queue = [...startNodes];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            reachableNodes.add(current);

            edges.filter(e => e.source === current)
                .forEach(e => {
                    if (!visited.has(e.target)) queue.push(e.target);
                });
        }

        nodes.forEach(node => {
            if (!reachableNodes.has(node.id)) {
                errors.push({
                    nodeId: node.id,
                    nodeLabel: node.data.label,
                    message: 'Node is unreachable'
                });
            }
        });
    }

    // 3. Schema-driven Parameter Validation
    if (nodeTypes) {
        nodes.forEach(node => {
            const schema = nodeTypes[node.data.type];
            if (schema) {
                const paramErrors = validateNodeParameters(node.data.parameters || {}, schema);
                paramErrors.forEach(err => {
                    errors.push({
                        nodeId: node.id,
                        nodeLabel: node.data.label,
                        message: err.message
                    });
                });
            }
        });
    }

    return errors;
}
