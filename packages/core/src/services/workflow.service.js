"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const database_1 = require("@local-n8n/database");
const crypto_1 = require("crypto");
class WorkflowService {
    async createWorkflow(data) {
        const id = (0, crypto_1.randomUUID)();
        const now = new Date();
        return database_1.db.transaction((tx) => {
            tx.insert(database_1.workflows).values({
                id,
                name: data.name,
                active: false,
                nodes: data.nodes,
                connections: data.connections,
                settings: data.settings || {},
                version: 1,
                schemaVersion: 1,
                createdAt: now,
                updatedAt: now,
            }).run();
            tx.insert(database_1.workflowVersions).values({
                id: (0, crypto_1.randomUUID)(),
                workflowId: id,
                name: data.name,
                nodes: data.nodes,
                connections: data.connections,
                settings: data.settings || {},
                versionNumber: 1,
                createdAt: now,
            }).run();
            return tx.select().from(database_1.workflows).where((0, database_1.eq)(database_1.workflows.id, id)).get();
        });
    }
    async listWorkflows() {
        return database_1.db.select().from(database_1.workflows).all();
    }
    async getWorkflow(id) {
        return database_1.db.select().from(database_1.workflows).where((0, database_1.eq)(database_1.workflows.id, id)).get();
    }
    async updateWorkflow(id, data) {
        return database_1.db.transaction((tx) => {
            const current = tx.select().from(database_1.workflows).where((0, database_1.eq)(database_1.workflows.id, id)).get();
            if (!current) {
                throw new Error(`Workflow ${id} not found`);
            }
            const now = new Date();
            const newVersionNumber = (current.version || 0) + 1;
            tx.update(database_1.workflows)
                .set({
                ...data,
                version: newVersionNumber,
                updatedAt: now,
            })
                .where((0, database_1.eq)(database_1.workflows.id, id))
                .run();
            // Create a new immutable version
            tx.insert(database_1.workflowVersions).values({
                id: (0, crypto_1.randomUUID)(),
                workflowId: id,
                name: data.name ?? current.name,
                nodes: data.nodes ?? current.nodes,
                connections: data.connections ?? current.connections,
                settings: data.settings ?? current.settings,
                versionNumber: newVersionNumber,
                createdAt: now,
            }).run();
            return tx.select().from(database_1.workflows).where((0, database_1.eq)(database_1.workflows.id, id)).get();
        });
    }
    async listWorkflowVersions(workflowId) {
        return database_1.db.select()
            .from(database_1.workflowVersions)
            .where((0, database_1.eq)(database_1.workflowVersions.workflowId, workflowId))
            .orderBy((0, database_1.desc)(database_1.workflowVersions.versionNumber))
            .all();
    }
    async getWorkflowVersion(versionId) {
        return database_1.db.select()
            .from(database_1.workflowVersions)
            .where((0, database_1.eq)(database_1.workflowVersions.id, versionId))
            .get();
    }
    async getLatestWorkflowVersion(workflowId) {
        return database_1.db.select()
            .from(database_1.workflowVersions)
            .where((0, database_1.eq)(database_1.workflowVersions.workflowId, workflowId))
            .orderBy((0, database_1.desc)(database_1.workflowVersions.versionNumber))
            .limit(1)
            .get();
    }
    async rollback(workflowId, versionId) {
        return database_1.db.transaction((tx) => {
            const version = tx.select()
                .from(database_1.workflowVersions)
                .where((0, database_1.eq)(database_1.workflowVersions.id, versionId))
                .get();
            if (!version) {
                throw new Error(`Version ${versionId} not found`);
            }
            if (version.workflowId !== workflowId) {
                throw new Error(`Version ${versionId} does not belong to workflow ${workflowId}`);
            }
            const current = tx.select()
                .from(database_1.workflows)
                .where((0, database_1.eq)(database_1.workflows.id, workflowId))
                .get();
            if (!current) {
                throw new Error(`Workflow ${workflowId} not found`);
            }
            const now = new Date();
            const newVersionNumber = (current.version || 0) + 1;
            // Update main workflow
            tx.update(database_1.workflows)
                .set({
                name: version.name,
                nodes: version.nodes,
                connections: version.connections,
                settings: version.settings,
                version: newVersionNumber,
                updatedAt: now,
            })
                .where((0, database_1.eq)(database_1.workflows.id, workflowId))
                .run();
            // Create new version record
            tx.insert(database_1.workflowVersions).values({
                id: (0, crypto_1.randomUUID)(),
                workflowId,
                name: version.name,
                nodes: version.nodes,
                connections: version.connections,
                settings: version.settings,
                versionNumber: newVersionNumber,
                createdAt: now,
            }).run();
            return tx.select().from(database_1.workflows).where((0, database_1.eq)(database_1.workflows.id, workflowId)).get();
        });
    }
}
exports.WorkflowService = WorkflowService;
