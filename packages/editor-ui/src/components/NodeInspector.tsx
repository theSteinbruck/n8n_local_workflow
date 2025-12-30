import { memo, useEffect, useState, useMemo } from 'react';
import type { Node } from 'reactflow';
import type { WorkflowNodeData } from './WorkflowNode';
import { useNodeTypes, type NodeProperty } from '../hooks/useNodeTypes';
import { ExpressionEditor } from './ExpressionEditor';
import { validateNodeParameters, type ValidationError } from '../utils/validation';
import { evaluateExpressionPreview, type EvaluationContext } from '../utils/expression-evaluator';

interface NodeInspectorProps {
    node: Node<WorkflowNodeData> | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (nodeId: string, newParameters: any, validationErrors: ValidationError[]) => void;
    onUpdateData?: (nodeId: string, newData: Partial<WorkflowNodeData>) => void;
    onNodesDelete: (nodes: Node[]) => void;
    readOnly?: boolean;
    allNodeNames?: string[];
    executionSteps?: any[];
}

export const NodeInspector = memo(({ node, isOpen, onClose, onUpdate, onUpdateData, onNodesDelete, readOnly, allNodeNames = [], executionSteps = [] }: NodeInspectorProps) => {
    const { nodeTypes, loading } = useNodeTypes();
    const [params, setParams] = useState<any>({});
    const [localErrors, setLocalErrors] = useState<ValidationError[]>([]);

    const nodeType = useMemo(() => {
        if (!node || !nodeTypes) return null;
        return nodeTypes[node.data.type];
    }, [node, nodeTypes]);

    useEffect(() => {
        if (node) {
            setParams(node.data.parameters || {});
        }
    }, [node]);

    const evaluationContext = useMemo((): EvaluationContext => {
        const context: EvaluationContext = {
            $json: {},
            $node: {}
        };

        if (!executionSteps || executionSteps.length === 0) return context;

        // Build $node context from all steps
        executionSteps.forEach(step => {
            if (step.outputData) {
                const label = allNodeNames.find(n => n === step.nodeId) || step.nodeId;
                const normalized = Array.isArray(step.outputData) ? step.outputData : [step.outputData];
                const first = normalized[0] || { json: {} };

                context.$node[label] = {
                    json: first.json,
                    binary: first.binary || {},
                    all: normalized
                };
            }
        });

        // Set $json for the current node (input from previous nodes)
        // For simplicity, we'll just take the output of the first step we find that connects to this node
        // In a real n8n-like engine, we'd follow edges.
        // Here we'll just use the last successful step as a fallback mock if no specific input found.
        const lastStep = executionSteps[executionSteps.length - 1];
        if (lastStep && lastStep.outputData) {
            const normalized = Array.isArray(lastStep.outputData) ? lastStep.outputData : [lastStep.outputData];
            context.$json = normalized[0]?.json || {};
        }

        return context;
    }, [executionSteps, allNodeNames, node?.id]);

    if (!isOpen || !node) return null;

    const handleChange = (key: string, value: any) => {
        if (readOnly) return;
        const newParams = { ...params, [key]: value };
        setParams(newParams);

        // Validate
        let errors: ValidationError[] = [];
        if (nodeType) {
            errors = validateNodeParameters(newParams, nodeType);
            setLocalErrors(errors);
        }

        onUpdate(node.id, newParams, errors);
    };

    const handleReset = (prop: NodeProperty) => {
        if (readOnly) return;
        handleChange(prop.name, prop.default);
    };

    const shouldShowProperty = (prop: any) => {
        if (!prop.displayOptions?.show) return true;

        for (const [key, values] of Object.entries(prop.displayOptions.show)) {
            const currentValue = params[key] ?? nodeType?.properties.find(p => p.name === key)?.default;
            if (Array.isArray(values)) {
                if (!values.includes(currentValue)) return false;
            } else if (currentValue !== values) {
                return false;
            }
        }
        return true;
    };

    const renderInput = (prop: NodeProperty) => {
        const value = params[prop.name] ?? prop.default;

        switch (prop.type) {
            case 'boolean':
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => handleChange(prop.name, e.target.checked)}
                            disabled={readOnly}
                            id={`input-${prop.name}`}
                            style={{ cursor: readOnly ? 'not-allowed' : 'pointer' }}
                        />
                        <label htmlFor={`input-${prop.name}`} style={{ fontSize: '13px', color: '#333' }}>
                            {value ? 'Active' : 'Disabled'}
                        </label>
                    </div>
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleChange(prop.name, parseFloat(e.target.value))}
                        disabled={readOnly}
                        style={inputStyles}
                    />
                );
            case 'options':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleChange(prop.name, e.target.value)}
                        disabled={readOnly}
                        style={inputStyles}
                    >
                        {prop.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                        ))}
                    </select>
                );
            case 'json':
                return (
                    <ExpressionEditor
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                        onChange={(val) => {
                            try {
                                const parsed = JSON.parse(val);
                                handleChange(prop.name, parsed);
                            } catch {
                                handleChange(prop.name, val);
                            }
                        }}
                        disabled={readOnly}
                        multiline={true}
                        suggestions={allNodeNames}
                    />
                );
            default:
                const strValue = String(value);
                const { value: previewValue, error: previewError } = evaluateExpressionPreview(strValue, evaluationContext);

                return (
                    <ExpressionEditor
                        value={strValue}
                        onChange={(val) => handleChange(prop.name, val)}
                        disabled={readOnly}
                        suggestions={allNodeNames}
                        previewValue={previewValue}
                        error={previewError}
                    />
                );
        }
    };

    return (
        <div style={{
            width: 380,
            height: '100%',
            background: 'white',
            borderLeft: '1px solid #e0e0e0',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.05)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fff'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#1a1a1a', fontWeight: 700 }}>
                        {node.data.label}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {node.data.type}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!readOnly && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Are you sure you want to delete "${node.data.label}"? All associated connections will be removed.`)) {
                                    onNodesDelete([node]);
                                }
                            }}
                            style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '16px',
                                cursor: 'pointer',
                                color: '#ff4d4f',
                                padding: '4px'
                            }}
                            title="Delete Node"
                        >
                            🗑️
                        </button>
                    )}
                    <button onClick={onClose} style={{
                        border: 'none',
                        background: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: '#999',
                        padding: '4px'
                    }}>×</button>
                </div>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ color: '#999', fontSize: '13px' }}>Loading schema...</div>
                ) : !nodeType ? (
                    <div style={{ color: '#ff6d5a', fontSize: '13px' }}>Error: Node type definition not found</div>
                ) : (
                    <>
                        {/* Debug Section: Pin Data */}
                        <div style={{
                            marginBottom: '24px',
                            padding: '12px',
                            background: '#f0f7ff',
                            borderRadius: '8px',
                            border: '1px solid #d0e3ff'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: '#005cc5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    📌 Pin Output Data
                                </label>
                                <input
                                    type="checkbox"
                                    checked={!!node.data.isPinned}
                                    onChange={(e) => {
                                        if (onUpdateData) {
                                            onUpdateData(node.id, { isPinned: e.target.checked });
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                            <p style={{ fontSize: '11px', color: '#586069', margin: '0 0 12px 0' }}>
                                When pinned, downstream nodes will use this data instead of real execution results.
                            </p>

                            {node.data.isPinned && (
                                <ExpressionEditor
                                    value={typeof node.data.pinnedData === 'object' ? JSON.stringify(node.data.pinnedData, null, 2) : String(node.data.pinnedData || '')}
                                    onChange={(val) => {
                                        if (onUpdateData) {
                                            try {
                                                const parsed = JSON.parse(val);
                                                onUpdateData(node.id, { pinnedData: parsed });
                                            } catch {
                                                onUpdateData(node.id, { pinnedData: val });
                                            }
                                        }
                                    }}
                                    multiline={true}
                                    suggestions={[]}
                                    placeholder='{"json": { ... }}'
                                />
                            )}
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Parameters
                            </h4>
                            {nodeType.properties.filter(shouldShowProperty).map((prop) => {
                                const propError = localErrors.find(e => e.property === prop.name);
                                return (
                                    <div key={prop.name} style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 600, color: propError ? '#ff6d5a' : '#333' }}>
                                                {prop.displayName}
                                                {prop.required && <span style={{ color: '#ff6d5a', marginLeft: '4px' }}>*</span>}
                                            </label>
                                            {!readOnly && (
                                                <button
                                                    onClick={() => handleReset(prop)}
                                                    style={{ border: 'none', background: 'none', color: '#0070f3', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ border: propError ? '1px solid #ff6d5a' : 'none', borderRadius: '6px' }}>
                                            {renderInput(prop)}
                                        </div>
                                        {propError && (
                                            <div style={{ fontSize: '11px', color: '#ff6d5a', marginTop: '4px', fontWeight: 500 }}>
                                                {propError.message}
                                            </div>
                                        )}
                                        {prop.description && !propError && (
                                            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                                {prop.description}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {nodeType.properties.length === 0 && (
                                <div style={{ color: '#999', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                                    No parameters available for this node
                                </div>
                            )}
                        </div>

                        {/* Error Stack Trace Section */}
                        {node.data.status === 'error' && node.data.errorStack && (
                            <div style={{ marginTop: '24px', borderTop: '1px solid #fee2e2', paddingTop: '16px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    🚨 Stack Trace
                                </h4>
                                <pre style={{
                                    margin: 0,
                                    padding: '12px',
                                    background: '#fff5f5',
                                    color: '#7f1d1d',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    borderRadius: '6px',
                                    overflowX: 'auto',
                                    border: '1px solid #fecaca',
                                    lineHeight: '1.5'
                                }}>
                                    {node.data.errorStack}
                                </pre>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#333',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
    background: '#fff'
};
