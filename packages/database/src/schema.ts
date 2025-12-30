import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Workflows Table
export const workflows = sqliteTable('workflows', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    active: integer('active', { mode: 'boolean' }).default(false),
    nodes: text('nodes', { mode: 'json' }).notNull(), // JSON
    connections: text('connections', { mode: 'json' }).notNull(), // JSON
    settings: text('settings', { mode: 'json' }), // JSON
    version: integer('version').default(1),
    schemaVersion: integer('schema_version').default(1),
    cronExpression: text('cron_expression'), // Cron schedule for automatic execution
    timezone: text('timezone'), // Timezone for cron schedule
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Workflow Versions Table (Immutable)
export const workflowVersions = sqliteTable('workflow_versions', {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id').notNull(),
    name: text('name').notNull(),
    nodes: text('nodes', { mode: 'json' }).notNull(),
    connections: text('connections', { mode: 'json' }).notNull(),
    settings: text('settings', { mode: 'json' }),
    versionNumber: integer('version_number').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Executions Table
export const executions = sqliteTable('executions', {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id').notNull(),
    workflowVersionId: text('workflow_version_id'), // Link to specific version
    status: text('status').notNull(), // 'running', 'success', 'error', 'canceled'
    mode: text('mode').notNull(), // 'manual', 'trigger', 'webhook'
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    workflowSnapshot: text('workflow_snapshot', { mode: 'json' }).notNull(), // JSON snapshot of workflow at execution time
    metrics: text('metrics', { mode: 'json' }), // JSON metrics (duration, node counts, etc.)
    currentNodeId: text('current_node_id'),
    iterationIndex: integer('iteration_index'),
    waitingUntil: integer('waiting_until', { mode: 'timestamp' }),
});

// Execution Steps Table
export const executionSteps = sqliteTable('execution_steps', {
    id: text('id').primaryKey(),
    executionId: text('execution_id').notNull(),
    nodeId: text('node_id').notNull(),
    status: text('status').notNull(), // 'pending', 'running', 'success', 'error'
    startedAt: integer('started_at', { mode: 'timestamp' }),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    inputData: text('input_data', { mode: 'json' }), // JSON
    outputData: text('output_data', { mode: 'json' }), // JSON
    error: text('error'),
});

// Credentials Table
export const credentials = sqliteTable('credentials', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    data: text('data', { mode: 'json' }).notNull(), // Encrypted JSON (AES-256-GCM)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
