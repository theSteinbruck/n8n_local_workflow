import { WorkflowService } from './src/services/workflow.service';
import { ExecutionService } from './src/services/execution.service';
import { ExecutionEngine } from './src/execution/execution-engine';
import { NoOpNodeExecutor } from './src/execution/node-executor';
import { db, executionSteps } from '@local-n8n/database';
import { eq } from '@local-n8n/database';

async function main() {
    try {
        console.log('Phase 6 Verification: Execution Engine Skeleton');

        const workflowService = new WorkflowService();
        const executionService = new ExecutionService();
        const nodeExecutor = new NoOpNodeExecutor();
        const engine = new ExecutionEngine(executionService, nodeExecutor);

        // 1. Create Workflow with 2 nodes
        console.log('Creating workflow...');
        const wf = await workflowService.createWorkflow({
            name: 'Engine Test Workflow',
            nodes: [
                { id: 'node1', type: 'test' },
                { id: 'node2', type: 'test' }
            ],
            connections: {},
        });

        if (!wf) throw new Error('Failed to create workflow');

        // 2. Create Execution
        console.log('Creating execution...');
        const execution = await executionService.createExecution({
            workflowId: wf.id,
            mode: 'manual',
            workflowSnapshot: wf,
        });

        if (!execution) throw new Error('Failed to create execution');

        // 3. Run Engine
        console.log('Running execution engine...');
        await engine.run(execution.id, wf);
        console.log('✅ Engine run completed.');

        // 4. Verify Execution Status
        const finalExecution = await executionService.createExecution({ // Re-using create to fetch? No, need get.
            // Wait, ExecutionService doesn't have getExecution.
            // But createExecution returns the fetched execution.
            // Let's use db directly for verification or add getExecution.
            // Using db directly for verification is allowed.
            workflowId: wf.id, mode: 'manual', workflowSnapshot: wf // Dummy
        });
        // Actually, let's just use db client to fetch directly for verification.

        // Fetch execution
        const verifiedExecution = await db.select().from(execution.id as any).where(eq((execution as any).id, execution.id)).get();
        // Wait, need to import tables.
        // Let's just use the service if possible, or import tables.
        // We imported db.
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

// Better verification script
import { executions } from '@local-n8n/database';

async function verify() {
    try {
        console.log('Phase 6 Verification: Execution Engine Skeleton');

        const workflowService = new WorkflowService();
        const executionService = new ExecutionService();
        const nodeExecutor = new NoOpNodeExecutor();
        const engine = new ExecutionEngine(executionService, nodeExecutor);

        // 1. Create Workflow with 2 nodes
        console.log('Creating workflow...');
        const wf = await workflowService.createWorkflow({
            name: 'Engine Test Workflow',
            nodes: [
                { id: 'node1', type: 'test' },
                { id: 'node2', type: 'test' }
            ],
            connections: {},
        });

        if (!wf) throw new Error('Failed to create workflow');

        // 2. Create Execution
        console.log('Creating execution...');
        const execution = await executionService.createExecution({
            workflowId: wf.id,
            mode: 'manual',
            workflowSnapshot: wf,
        });

        if (!execution) throw new Error('Failed to create execution');

        // 3. Run Engine
        console.log('Running execution engine...');
        await engine.run(execution.id, wf);
        console.log('✅ Engine run completed.');

        // 4. Verify Execution Status
        const finalExecution = db.select().from(executions).where(eq(executions.id, execution.id)).get();
        if (!finalExecution) throw new Error('Execution not found');
        console.log(`Execution Status: ${finalExecution.status}`);
        if (finalExecution.status !== 'success') throw new Error('Execution status mismatch');

        // 5. Verify Steps
        const steps = db.select().from(executionSteps).where(eq(executionSteps.executionId, execution.id)).all();
        console.log(`Steps created: ${steps.length}`);
        if (steps.length !== 2) throw new Error('Step count mismatch');

        if (steps[0].nodeId !== 'node1' || steps[0].status !== 'success') throw new Error('Step 1 mismatch');
        if (steps[1].nodeId !== 'node2' || steps[1].status !== 'success') throw new Error('Step 2 mismatch');

        console.log('✅ Phase 6 Complete.');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
