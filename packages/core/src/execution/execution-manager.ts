export class ExecutionManager {
    private activeExecutions = new Map<string, AbortController>();

    register(executionId: string, controller: AbortController) {
        this.activeExecutions.set(executionId, controller);
    }

    unregister(executionId: string) {
        this.activeExecutions.delete(executionId);
    }

    cancel(executionId: string) {
        const controller = this.activeExecutions.get(executionId);
        if (controller) {
            controller.abort();
            this.activeExecutions.delete(executionId);
            return true;
        }
        return false;
    }

    isCancelled(executionId: string): boolean {
        const controller = this.activeExecutions.get(executionId);
        return controller?.signal.aborted === true;
    }
}
