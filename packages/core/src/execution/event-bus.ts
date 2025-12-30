import { EventEmitter } from 'events';

export class EventBus extends EventEmitter {
    emitNodeExecuteBefore(nodeName: string, executionId: string, nodeId: string) {
        this.emit('nodeExecuteBefore', { nodeName, executionId, nodeId });
    }

    emitNodeExecuteAfter(nodeName: string, executionId: string, nodeId: string, data: any) {
        this.emit('nodeExecuteAfter', { nodeName, executionId, nodeId, data });
    }

    emitNodeExecuteError(nodeName: string, executionId: string, nodeId: string, error: Error) {
        this.emit('nodeExecuteError', { nodeName, executionId, nodeId, error });
    }

    emitExecutionFinish(executionId: string, status: 'success' | 'error' | 'canceled') {
        this.emit('executionFinish', { executionId, status });
    }
}
