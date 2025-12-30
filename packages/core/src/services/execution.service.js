"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionService = void 0;
const database_1 = require("@local-n8n/database");
const crypto_1 = require("crypto");
class ExecutionService {
    async createExecution(data) {
        const id = (0, crypto_1.randomUUID)();
        const now = new Date();
        database_1.db.insert(database_1.executions).values({
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
    async getExecutionById(id) {
        return database_1.db.select().from(database_1.executions).where((0, database_1.eq)(database_1.executions.id, id)).get();
    }
    async updateExecutionState(id, data) {
        database_1.db.update(database_1.executions)
            .set(data)
            .where((0, database_1.eq)(database_1.executions.id, id))
            .run();
    }
    async listActiveExecutions() {
        return database_1.db.select().from(database_1.executions).where((0, database_1.eq)(database_1.executions.status, 'running')).all();
    }
    async updateExecutionStatus(id, status, metrics) {
        const now = new Date();
        database_1.db.update(database_1.executions)
            .set({ status, finishedAt: now, metrics })
            .where((0, database_1.eq)(database_1.executions.id, id))
            .run();
    }
    async createExecutionStep(data) {
        const id = (0, crypto_1.randomUUID)();
        const now = new Date();
        database_1.db.insert(database_1.executionSteps).values({
            id,
            executionId: data.executionId,
            nodeId: data.nodeId,
            status: 'running',
            startedAt: now,
            inputData: data.inputData,
        }).run();
        return database_1.db.select().from(database_1.executionSteps).where((0, database_1.eq)(database_1.executionSteps.id, id)).get();
    }
    async updateExecutionStep(id, data) {
        const now = new Date();
        database_1.db.update(database_1.executionSteps)
            .set({
            status: data.status,
            finishedAt: now,
            outputData: data.outputData,
            error: data.error,
        })
            .where((0, database_1.eq)(database_1.executionSteps.id, id))
            .run();
        return database_1.db.select().from(database_1.executionSteps).where((0, database_1.eq)(database_1.executionSteps.id, id)).get();
    }
}
exports.ExecutionService = ExecutionService;
