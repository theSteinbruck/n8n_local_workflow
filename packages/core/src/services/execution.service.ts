import { db, executions, executionSteps, eq } from '@local-n8n/database';
import { randomUUID } from 'crypto';

export class ExecutionService {
    async createExecution(data: { workflowId: string; workflowVersionId?: string; mode: 'manual' | 'trigger' | 'webhook' | 'api' | 'canvas'; workflowSnapshot: any }) {
        const id = randomUUID();
        const now = new Date();

        db.insert(executions).values({
            id,
            workflowId: data.workflowId,
            workflowVersionId: data.workflowVersionId,
            status: 'running',
            mode: data.mode,
            startedAt: now,
            workflowSnapshot: data.workflowSnapshot,
        }).run();

        return this.getExecutionById(id);
    }

    async getExecutionById(id: string) {
        return db.select().from(executions).where(eq(executions.id, id)).get();
    }

    async updateExecutionState(id: string, data: { currentNodeId?: string; iterationIndex?: number; waitingUntil?: Date | null }) {
        db.update(executions)
            .set(data as any)
            .where(eq(executions.id, id))
            .run();
    }

    async listActiveExecutions() {
        return db.select().from(executions).where(eq(executions.status, 'running')).all();
    }

    async updateExecutionStatus(id: string, status: 'success' | 'error' | 'canceled', metrics?: any) {
        const now = new Date();
        db.update(executions)
            .set({ status, finishedAt: now, metrics })
            .where(eq(executions.id, id))
            .run();
    }

    async createExecutionStep(data: { executionId: string; nodeId: string; inputData: any }) {
        const id = randomUUID();
        const now = new Date();

        db.insert(executionSteps).values({
            id,
            executionId: data.executionId,
            nodeId: data.nodeId,
            status: 'running',
            startedAt: now,
            inputData: data.inputData,
        }).run();

        return db.select().from(executionSteps).where(eq(executionSteps.id, id)).get();
    }

    async updateExecutionStep(id: string, data: { status: 'success' | 'error'; outputData?: any; error?: string }) {
        const now = new Date();
        db.update(executionSteps)
            .set({
                status: data.status,
                finishedAt: now,
                outputData: data.outputData,
                error: data.error,
            })
            .where(eq(executionSteps.id, id))
            .run();

        return db.select().from(executionSteps).where(eq(executionSteps.id, id)).get();
    }
}
