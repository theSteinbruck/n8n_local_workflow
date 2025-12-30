import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export interface WorkflowNodeData {
    label: string;
    type: string;
    status?: 'pending' | 'running' | 'success' | 'error' | 'skipped';
    errorMessage?: string;
    errorStack?: string;
    executionTime?: number;
    parameters?: Record<string, any>;
    errors?: string[]; // Validation errors
    isPinned?: boolean;
    pinnedData?: any;
}

const statusConfig = {
    pending: { color: '#888', ring: 'transparent', icon: '' },
    running: { color: '#ff9800', ring: '#ff9800', icon: '⚡' },
    success: { color: '#4caf50', ring: '#4caf50', icon: '✅' },
    error: { color: '#f44336', ring: '#f44336', icon: '❌' },
    skipped: { color: '#aaa', ring: '#eee', icon: '⏭️' }
};

export const WorkflowNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
    const status = data.status || 'pending';
    const config = statusConfig[status];
    const hasValidationErrors = data.errors && data.errors.length > 0;

    return (
        <div
            style={{
                background: '#ffffff',
                border: `1px solid ${selected ? '#ff6d5a' : '#ddd'}`,
                borderRadius: '8px',
                padding: '12px',
                minWidth: '180px',
                textAlign: 'left',
                fontSize: '12px',
                fontFamily: '"Inter", "Segoe UI", sans-serif',
                position: 'relative',
                boxShadow: selected ? '0 0 0 2px rgba(255, 109, 90, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s',
                opacity: status === 'skipped' ? 0.6 : 1
            }}
            title={hasValidationErrors ? data.errors!.map(e => `❌ ${e}`).join('\n') : undefined}
        >
            <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: '#bbb' }} />

            {/* Status Ring / Halo */}
            <div style={{
                position: 'absolute',
                top: '-4px',
                left: '-4px',
                right: '-4px',
                bottom: '-4px',
                borderRadius: '11px',
                border: `2px solid ${config.ring}`,
                opacity: status === 'pending' ? 0 : 0.6,
                pointerEvents: 'none',
                animation: status === 'running' ? 'pulse 1.5s infinite' : 'none'
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#f5f5f5',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                }}>
                    {config.icon || '📦'}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#333' }}>{data.label}</div>
                    <div style={{ fontSize: '10px', color: '#999' }}>{data.type}</div>
                </div>
            </div>

            {data.isPinned && (
                <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    background: '#0070f3',
                    color: 'white',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 10
                }}>
                    📌
                </div>
            )}

            {hasValidationErrors && (
                <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-10px',
                    background: '#f44336',
                    color: 'white',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 10
                }}>
                    !
                </div>
            )}

            {status !== 'pending' && (
                <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{
                        color: config.color,
                        fontWeight: 600,
                        fontSize: '10px',
                        textTransform: 'uppercase'
                    }}>
                        {status}
                    </span>
                    {data.executionTime && (
                        <span style={{ fontSize: '10px', color: '#999' }}>{data.executionTime}ms</span>
                    )}
                </div>
            )}

            {status === 'error' && data.errorMessage && (
                <div style={{
                    marginTop: '8px',
                    color: '#d32f2f',
                    fontSize: '10px',
                    background: '#ffebee',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ffcdd2'
                }}>
                    {data.errorMessage}
                </div>
            )}

            <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: '#bbb' }} />

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.05); opacity: 0.3; }
                    100% { transform: scale(1); opacity: 0.6; }
                }
            `}</style>
        </div>
    );
});
