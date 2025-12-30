import { db, workflows, executions, credentials } from '@local-n8n/database';

export const dbClient = {
    // Read-only accessors
    getWorkflows: async () => {
        return await db.select().from(workflows).all();
    },
    getExecutions: async () => {
        return await db.select().from(executions).all();
    },
    getCredentials: async () => {
        return await db.select().from(credentials).all();
    }
};
