import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ExecutionUIState {
    executionId: string | null;
    status: string;
    steps: any[];
    nodeStatuses: Record<string, {
        status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
        errorMessage?: string;
        errorStack?: string;
    }>;
}

export const useExecutionViewer = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [state, setState] = useState<ExecutionUIState>({
        executionId: null,
        status: 'idle',
        steps: [],
        nodeStatuses: {}
    });

    useEffect(() => {
        const newSocket = io('http://localhost:3000/executions', {
            path: '/socket.io',
            transports: ['websocket']
        });

        newSocket.on('connect', () => {
            console.log('Connected to Execution WebSocket');
        });

        newSocket.on('execution:replay', (data) => {
            const nodeStatuses: Record<string, any> = {};
            data.steps?.forEach((step: any) => {
                nodeStatuses[step.nodeId] = {
                    status: step.status,
                    errorMessage: step.error
                };
            });

            setState({
                executionId: data.executionId,
                status: data.execution?.status || 'unknown',
                steps: data.steps || [],
                nodeStatuses
            });
        });

        newSocket.on('execution:event', (data) => {
            if (data.type === 'execution:finish') {
                setState(prev => ({ ...prev, status: data.status }));
                return;
            }

            if (data.type === 'node:start') {
                setState(prev => ({
                    ...prev,
                    steps: [...prev.steps, { nodeId: data.nodeId, status: 'running', startTime: new Date().toISOString() }],
                    nodeStatuses: {
                        ...prev.nodeStatuses,
                        [data.nodeId]: { status: 'running' }
                    }
                }));
            }

            if (data.type === 'node:finish') {
                setState(prev => ({
                    ...prev,
                    steps: prev.steps.map(s => s.nodeId === data.nodeId ? { ...s, status: 'success', outputData: data.outputData, endTime: new Date().toISOString() } : s),
                    nodeStatuses: {
                        ...prev.nodeStatuses,
                        [data.nodeId]: { status: 'success' }
                    }
                }));
            }

            if (data.type === 'node:error') {
                setState(prev => ({
                    ...prev,
                    steps: prev.steps.map(s => s.nodeId === data.nodeId ? { ...s, status: 'error', error: data.error?.message, endTime: new Date().toISOString() } : s),
                    nodeStatuses: {
                        ...prev.nodeStatuses,
                        [data.nodeId]: {
                            status: 'error',
                            errorMessage: data.error?.message,
                            errorStack: data.error?.stack
                        }
                    }
                }));
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const subscribe = useCallback((executionId: string) => {
        if (socket) {
            setState(prev => ({ ...prev, executionId, steps: [], nodeStatuses: {} }));
            socket.emit('subscribe', { executionId });
        }
    }, [socket]);

    const clear = useCallback(() => {
        setState({ executionId: null, status: 'idle', steps: [], nodeStatuses: {} });
    }, []);

    return {
        ...state,
        subscribe,
        clear,
        isConnected: !!socket?.connected
    };
};
