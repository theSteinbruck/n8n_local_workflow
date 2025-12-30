import React from 'react';
import { UIMode } from '../types/ui-modes';

interface TopBarProps {
    workflowName: string;
    uiMode: UIMode;
    isSaving?: boolean;
    onSave: () => void;
    onRun: () => void;
    onBackToEditor: () => void;
    executionId?: string | null;
    executionStatus?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
    workflowName,
    uiMode,
    isSaving,
    onSave,
    onRun,
    onBackToEditor,
    executionId,
    executionStatus
}) => {
    const isEditMode = uiMode === UIMode.EDIT;

    return (
        <div style={{
            height: '64px',
            width: '100%',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            boxSizing: 'border-box',
            zIndex: 100,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#ff6d5a',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 900,
                    fontSize: '18px'
                }}>
                    n
                </div>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                        {workflowName || 'Untitled Workflow'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {isSaving ? 'Saving changes...' : 'All changes saved'}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: isEditMode ? '#f0f9ff' : '#fff7ed',
                    color: isEditMode ? '#0ea5e9' : '#f97316',
                    border: `1px solid ${isEditMode ? '#bae6fd' : '#fed7aa'}`
                }}>
                    {uiMode}
                </div>

                {executionId && (
                    <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        gap: '6px'
                    }}>
                        <span style={{ color: '#94a3b8' }}>Exec:</span>
                        <code style={{ color: '#475569', fontWeight: 600 }}>#{executionId.substring(0, 6)}</code>
                        <span style={{
                            fontWeight: 700,
                            color: executionStatus === 'success' ? '#10b981' : executionStatus === 'error' ? '#ef4444' : '#f59e0b'
                        }}>
                            {executionStatus?.toUpperCase()}
                        </span>
                    </div>
                )}

                <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 8px' }} />

                {isEditMode ? (
                    <>
                        <button onClick={onSave} style={buttonStyle}>
                            Save
                        </button>
                        <button
                            onClick={onRun}
                            style={{
                                ...buttonStyle,
                                background: '#ff6d5a',
                                color: 'white',
                                border: 'none',
                                boxShadow: '0 2px 4px rgba(255, 109, 90, 0.3)'
                            }}
                        >
                            Execute Workflow
                        </button>
                    </>
                ) : (
                    <button
                        onClick={onBackToEditor}
                        style={{
                            ...buttonStyle,
                            background: '#1e293b',
                            color: 'white',
                            border: 'none'
                        }}
                    >
                        Back to Editor
                    </button>
                )}
            </div>
        </div>
    );
};

const buttonStyle: React.CSSProperties = {
    padding: '8px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    background: '#fff',
    transition: 'all 0.15s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
};
