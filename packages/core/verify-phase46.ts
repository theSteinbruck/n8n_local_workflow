import { ExecutionEngine } from './src/execution/execution-engine';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ExecutionService } from './src/services/execution.service';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { WaitNode } from './src/nodes/core.wait';
import { WorkflowService } from './src/services/workflow.service';
import { db, executions, eq } from '@local-n8n/database';

async function verifyPhase46() {
    console.log('🧪 Phase 46 Verification: Wait Node');

    const nodeRegistry = new NodeRegistry();
    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new WaitNode());

    const eventBus = new EventBus();
    const executionService = new ExecutionService();
    const workflowService = new WorkflowService();
    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);

    // Test 1: Basic Wait (2 seconds)
    console.log('\nTest 1: Basic Wait (2 seconds)');
    const wfWait = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'wait', type: 'Wait', parameters: { amount: 2, unit: 'seconds' } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'wait', type: 'main', index: 0 }]] }
        }
    };

    const execWait = await executionService.createExecution({
        workflowId: 'test-wf-wait',
        mode: 'manual',
        workflowSnapshot: wfWait
    });

    const start = Date.now();
    await engine.run(execWait!.id, wfWait);
    const duration = Date.now() - start;

    console.log(`Execution took ${duration}ms`);
    if (duration >= 2000) {
        console.log('✅ Wait node delayed execution correctly');
    } else {
        console.error('❌ Wait node finished too early');
        process.exit(1);
    }

    // Test 2: Wait with Cancellation
    console.log('\nTest 2: Wait with Cancellation');
    const wfCancel = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'wait', type: 'Wait', parameters: { amount: 10, unit: 'seconds' } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'wait', type: 'main', index: 0 }]] }
        }
    };

    const execCancel = await executionService.createExecution({
        workflowId: 'test-wf-cancel',
        mode: 'manual',
        workflowSnapshot: wfCancel
    });

    const controller = new AbortController();
    const runPromise = engine.run(execCancel!.id, wfCancel, undefined, controller.signal);

    setTimeout(() => {
        console.log('Aborting wait...');
        controller.abort();
    }, 1000);

    try {
        await runPromise;
        console.error('❌ Execution should have been canceled');
        process.exit(1);
    } catch (err: any) {
        if (err.isCancellation) {
            console.log('✅ Caught cancellation error');
        } else {
            console.error('❌ Unexpected error:', err);
            process.exit(1);
        }
    }

    const dbExec = await db.select().from(executions).where(eq(executions.id, execCancel!.id)).get();
    if (dbExec?.status === 'canceled') {
        console.log('✅ DB status is "canceled"');
    } else {
        console.error(`❌ DB status is "${dbExec?.status}", expected "canceled"`);
        process.exit(1);
    }

    console.log('\n🎉 Phase 46 Verified!');
    process.exit(0);
}

verifyPhase46().catch(console.error);
