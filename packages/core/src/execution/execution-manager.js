"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionManager = void 0;
class ExecutionManager {
    constructor() {
        this.activeExecutions = new Map();
    }
    register(executionId, controller) {
        this.activeExecutions.set(executionId, controller);
    }
    unregister(executionId) {
        this.activeExecutions.delete(executionId);
    }
    cancel(executionId) {
        const controller = this.activeExecutions.get(executionId);
        if (controller) {
            controller.abort();
            this.activeExecutions.delete(executionId);
            return true;
        }
        return false;
    }
    isCancelled(executionId) {
        const controller = this.activeExecutions.get(executionId);
        return controller?.signal.aborted === true;
    }
}
exports.ExecutionManager = ExecutionManager;
