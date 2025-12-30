import { memo, useState } from 'react';

export interface ExecutionStep {
    id: string;
    nodeId: string;
    status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
    startTime?: string;
    endTime?: string;
    inputData?: any;
    outputData?: any;
    error?: string;
}

interface ExecutionSidebarProps {
    steps: ExecutionStep[];
    isOpen: boolean;
    onToggle: () => void;
    onSelectNode?: (nodeId: string) => void;
}

export const ExecutionSidebar = memo(({ steps, isOpen, onToggle, onSelectNode }: ExecutionSidebarProps) => {
    const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

    const getDuration = (start?: string, end?: string) => {
        if (!start || !end) return null;
        const duration = new Date(end).getTime() - new Date(start).getTime();
        return `${duration}ms`;
    };

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 100,
                    background: '#ff6d5a',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '30px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(255, 109, 90, 0.3)',
                    cursor: 'pointer'
                }}
            >
                Show Execution Details
            </button>
        );
    }

    return (
        <div style={{
            width: '400px',
            height: '100%',
            background: '#ffffff',
            borderLeft: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.05)'
        }}>
            <div style={{
                padding: '15px 20px',
                background: '#f8f9fa',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#333', fontWeight: 700 }}>Execution Details</h3>
                <button
                    onClick={onToggle}
                    style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#999' }}
                >
                    ×
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {steps.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '40px', fontSize: '14px' }}>
                        Waiting for execution...
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {steps.map((step, index) => {
                        const isExpanded = expandedStepId === (step.id || index.toString());
                        const duration = getDuration(step.startTime, step.endTime);

                        return (
                            <div
                                key={step.id || index}
                                style={{
                                    border: `1px solid ${step.status === 'error' ? '#ffcdd2' : '#eee'}`,
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    background: step.status === 'error' ? '#fffbfa' : '#fff',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div
                                    onClick={() => {
                                        setExpandedStepId(isExpanded ? null : (step.id || index.toString()));
                                        if (onSelectNode) onSelectNode(step.nodeId);
                                    }}
                                    style={{
                                        padding: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: step.status === 'success' ? '#4caf50' :
                                            step.status === 'running' ? '#ff9800' :
                                                step.status === 'error' ? '#f44336' : '#ccc'
                                    }} />

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#333' }}>{step.nodeId}</div>
                                        <div style={{ fontSize: '11px', color: '#999' }}>
                                            {step.status.toUpperCase()} {duration && `• ${duration}`}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '12px', color: '#999' }}>{isExpanded ? '▼' : '▶'}</div>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '0 12px 12px 12px', background: '#fff', fontSize: '12px' }}>
                                        {step.error && (
                                            <div style={{
                                                color: '#d32f2f',
                                                marginBottom: '10px',
                                                padding: '8px',
                                                background: '#ffebee',
                                                borderRadius: '4px',
                                                border: '1px solid #ffcdd2'
                                            }}>
                                                <strong>Error:</strong> {step.error}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {step.inputData && (
                                                <div>
                                                    <div style={{ color: '#888', marginBottom: '4px', fontSize: '11px', fontWeight: 600 }}>INPUT DATA</div>
                                                    <pre style={preStyle}>{JSON.stringify(step.inputData, null, 2)}</pre>
                                                </div>
                                            )}
                                            {step.outputData && (
                                                <div>
                                                    <div style={{ color: '#888', marginBottom: '4px', fontSize: '11px', fontWeight: 600 }}>OUTPUT DATA</div>
                                                    <pre style={preStyle}>{JSON.stringify(step.outputData, null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

const preStyle: React.CSSProperties = {
    background: '#f8f9fa',
    padding: '8px',
    borderRadius: '4px',
    overflowX: 'auto',
    maxHeight: '200px',
    border: '1px solid #eee',
    fontSize: '11px',
    margin: 0,
    fontFamily: '"JetBrains Mono", monospace'
};
