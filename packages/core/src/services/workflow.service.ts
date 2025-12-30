import { db, workflows, workflowVersions, eq, sql, desc } from '@local-n8n/database';
import { randomUUID } from 'crypto';

export class WorkflowService {
    async createWorkflow(data: { name: string; nodes: any[]; connections: any; settings?: any }) {
        const id = randomUUID();
        const now = new Date();

        return db.transaction((tx) => {
            tx.insert(workflows).values({
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

            tx.insert(workflowVersions).values({
                id: randomUUID(),
                workflowId: id,
                name: data.name,
                nodes: data.nodes,
                connections: data.connections,
                settings: data.settings || {},
                versionNumber: 1,
                createdAt: now,
            }).run();

            return tx.select().from(workflows).where(eq(workflows.id, id)).get();
        });
    }

    async listWorkflows() {
        return db.select().from(workflows).all();
    }

    async getWorkflow(id: string) {
        return db.select().from(workflows).where(eq(workflows.id, id)).get();
    }

    async updateWorkflow(id: string, data: { name?: string; nodes?: any[]; connections?: any; settings?: any; active?: boolean }) {
        return db.transaction((tx) => {
            const current = tx.select().from(workflows).where(eq(workflows.id, id)).get();
            if (!current) {
                throw new Error(`Workflow ${id} not found`);
            }

            const now = new Date();
            const newVersionNumber = (current.version || 0) + 1;

            tx.update(workflows)
                .set({
                    ...data,
                    version: newVersionNumber,
                    updatedAt: now,
                })
                .where(eq(workflows.id, id))
                .run();

            // Create a new immutable version
            tx.insert(workflowVersions).values({
                id: randomUUID(),
                workflowId: id,
                name: data.name ?? current.name,
                nodes: data.nodes ?? current.nodes,
                connections: data.connections ?? current.connections,
                settings: data.settings ?? current.settings,
                versionNumber: newVersionNumber,
                createdAt: now,
            }).run();

            return tx.select().from(workflows).where(eq(workflows.id, id)).get();
        });
    }

    async listWorkflowVersions(workflowId: string) {
        return db.select()
            .from(workflowVersions)
            .where(eq(workflowVersions.workflowId, workflowId))
            .orderBy(desc(workflowVersions.versionNumber))
            .all();
    }

    async getWorkflowVersion(versionId: string) {
        return db.select()
            .from(workflowVersions)
            .where(eq(workflowVersions.id, versionId))
            .get();
    }

    async getLatestWorkflowVersion(workflowId: string) {
        return db.select()
            .from(workflowVersions)
            .where(eq(workflowVersions.workflowId, workflowId))
            .orderBy(desc(workflowVersions.versionNumber))
            .limit(1)
            .get();
    }

    async rollback(workflowId: string, versionId: string) {
        return db.transaction((tx) => {
            const version = tx.select()
                .from(workflowVersions)
                .where(eq(workflowVersions.id, versionId))
                .get();

            if (!version) {
                throw new Error(`Version ${versionId} not found`);
            }

            if (version.workflowId !== workflowId) {
                throw new Error(`Version ${versionId} does not belong to workflow ${workflowId}`);
            }

            const current = tx.select()
                .from(workflows)
                .where(eq(workflows.id, workflowId))
                .get();

            if (!current) {
                throw new Error(`Workflow ${workflowId} not found`);
            }

            const now = new Date();
            const newVersionNumber = (current.version || 0) + 1;

            // Update main workflow
            tx.update(workflows)
                .set({
                    name: version.name,
                    nodes: version.nodes,
                    connections: version.connections,
                    settings: version.settings,
                    version: newVersionNumber,
                    updatedAt: now,
                })
                .where(eq(workflows.id, workflowId))
                .run();

            // Create new version record
            tx.insert(workflowVersions).values({
                id: randomUUID(),
                workflowId,
                name: version.name,
                nodes: version.nodes,
                connections: version.connections,
                settings: version.settings,
                versionNumber: newVersionNumber,
                createdAt: now,
            }).run();

            return tx.select().from(workflows).where(eq(workflows.id, workflowId)).get();
        });
    }
}
