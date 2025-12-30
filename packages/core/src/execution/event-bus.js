"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const events_1 = require("events");
class EventBus extends events_1.EventEmitter {
    emitNodeExecuteBefore(nodeName, executionId, nodeId) {
        this.emit('nodeExecuteBefore', { nodeName, executionId, nodeId });
    }
    emitNodeExecuteAfter(nodeName, executionId, nodeId, data) {
        this.emit('nodeExecuteAfter', { nodeName, executionId, nodeId, data });
    }
    emitNodeExecuteError(nodeName, executionId, nodeId, error) {
        this.emit('nodeExecuteError', { nodeName, executionId, nodeId, error });
    }
    emitExecutionFinish(executionId, status) {
        this.emit('executionFinish', { executionId, status });
    }
}
exports.EventBus = EventBus;
