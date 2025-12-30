import { Command } from 'commander';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { ExecutionService } from '@local-n8n/core/src/services/execution.service';
import { ExecutionEngine } from '@local-n8n/core/src/execution/execution-engine';
import { NodeRegistry } from '@local-n8n/core/src/execution/node-registry';
import { EventBus } from '@local-n8n/core/src/execution/event-bus';
import { NoOpNode } from '@local-n8n/core/src/nodes/core.noop';
import { SetNode } from '@local-n8n/core/src/nodes/core.set';
import { db, executions, eq, desc } from '@local-n8n/database';

const program = new Command();

program
    .name('n8n-cli')
    .description('CLI for local-n8n')
    .version('0.1.0');

program.command('execute')
    .description('Execute a workflow by ID')
    .argument('<workflowId>', 'ID of the workflow to execute')
    .action(async (workflowId) => {
        try {
            console.log(`Starting execution for workflow: ${workflowId}`);

            // 1. Initialize Services
            const workflowService = new WorkflowService();
            const executionService = new ExecutionService();
            const nodeRegistry = new NodeRegistry();
            const eventBus = new EventBus();

            // 2. Register Nodes
            nodeRegistry.register(new NoOpNode());
            nodeRegistry.register(new SetNode());

            // 3. Setup Event Logging
            eventBus.on('nodeExecuteBefore', (data) => {
                console.log(`[EXEC] Running node ${data.nodeName} (${data.nodeId})...`);
            });
            eventBus.on('nodeExecuteAfter', (data) => {
                console.log(`[EXEC] Finished node ${data.nodeName} (${data.nodeId})`);
            });

            // 4. Fetch Workflow
            const { workflows } = await import('@local-n8n/database');
            const wf = await db.select().from(workflows).where(eq(workflows.id, workflowId)).get();

            if (!wf) {
                console.error(`Workflow ${workflowId} not found`);
                process.exit(1);
            }

            // 5. Create Execution
            const execution = await executionService.createExecution({
                workflowId: wf.id,
                mode: 'manual',
                workflowSnapshot: wf,
            });

            if (!execution) throw new Error('Failed to create execution');

            console.log(`Execution created: ${execution.id}`);

            // 6. Run Engine
            const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);
            await engine.run(execution.id, wf);

            console.log('Execution completed successfully.');
        } catch (error: any) {
            console.error('Execution failed:', error.message);
            process.exit(1);
        }
    });

program.command('executions')
    .description('List recent executions')
    .option('-n, --limit <number>', 'Number of executions to list', '10')
    .action(async (options) => {
        try {
            const limit = parseInt(options.limit, 10);
            const recent = await db.select()
                .from(executions)
                .orderBy(desc(executions.startedAt))
                .limit(limit)
                .all();

            console.table(recent.map(e => ({
                id: e.id,
                workflowId: e.workflowId,
                status: e.status,
                startedAt: e.startedAt,
                finishedAt: e.finishedAt
            })));
        } catch (error: any) {
            console.error('Failed to list executions:', error.message);
            process.exit(1);
        }
    });

program.parse();
