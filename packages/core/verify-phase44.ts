import { ExecutionEngine } from './src/execution/execution-engine';
import { ExecutionService } from './src/services/execution.service';
import { WorkflowService } from './src/services/workflow.service';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { HttpRequestNode } from './src/nodes/core.httpRequest';
import { db, executions, eq } from '@local-n8n/database';

async function verify() {
    console.log('🧪 Phase 44 Verification: Execution Cancellation & Timeout\n');

    const executionService = new ExecutionService();
    const workflowService = new WorkflowService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new HttpRequestNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);

    // Test 1: Cancellation
    console.log('Test 1: Cancellation');
    const wfCancel = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            { id: 'http', type: 'HttpRequest', parameters: { url: 'https://httpbin.org/delay/5', method: 'GET' } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'http', type: 'main', index: 0 }]] }
        }
    };

    const execCancel = await executionService.createExecution({
        workflowId: 'test-wf-cancel',
        mode: 'manual',
        workflowSnapshot: wfCancel
    });

    const controller = new AbortController();

    // Run engine and cancel after 1 second
    const runPromise = engine.run(execCancel!.id, wfCancel, undefined, controller.signal);

    setTimeout(() => {
        console.log('Aborting execution...');
        controller.abort();
    }, 1000);

    try {
        await runPromise;
        console.error('❌ Test 1 failed: Execution should have been canceled');
        process.exit(1);
    } catch (err: any) {
        if (err.isCancellation) {
            console.log('✅ Caught cancellation error');
        } else {
            console.error('❌ Test 1 failed: Unexpected error:', err);
            process.exit(1);
        }
    }

    const dbExecCancel = await db.select().from(executions).where(eq(executions.id, execCancel!.id)).get();
    if (dbExecCancel?.status === 'canceled') {
        console.log('✅ DB status is "canceled"');
    } else {
        console.error('❌ Test 1 failed: DB status is', dbExecCancel?.status);
        process.exit(1);
    }

    // Test 2: Timeout
    console.log('\nTest 2: Timeout');
    const wfTimeout = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            { id: 'http', type: 'HttpRequest', parameters: { url: 'https://httpbin.org/delay/5', method: 'GET' } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'http', type: 'main', index: 0 }]] }
        },
        settings: {
            executionTimeout: 1000 // 1 second
        }
    };

    const execTimeout = await executionService.createExecution({
        workflowId: 'test-wf-timeout',
        mode: 'manual',
        workflowSnapshot: wfTimeout
    });

    try {
        await engine.run(execTimeout!.id, wfTimeout);
        console.error('❌ Test 2 failed: Execution should have timed out');
        process.exit(1);
    } catch (err: any) {
        if (err.isCancellation) {
            console.log('✅ Caught timeout/cancellation error');
        } else {
            console.error('❌ Test 2 failed: Unexpected error:', err);
            process.exit(1);
        }
    }

    const dbExecTimeout = await db.select().from(executions).where(eq(executions.id, execTimeout!.id)).get();
    if (dbExecTimeout?.status === 'canceled') {
        console.log('✅ DB status is "canceled"');
    } else {
        console.error('❌ Test 2 failed: DB status is', dbExecTimeout?.status);
        process.exit(1);
    }

    console.log('\n🎉 Phase 44 Verified!');
    process.exit(0);
}

verify().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
