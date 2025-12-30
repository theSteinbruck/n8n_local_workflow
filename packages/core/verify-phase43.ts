import { ExecutionEngine } from './src/execution/execution-engine';
import { ExecutionService } from './src/services/execution.service';
import { WorkflowService } from './src/services/workflow.service';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { SetNode } from './src/nodes/core.set';
import { FailNode } from './src/nodes/core.fail';
import { db, executions, eq } from '@local-n8n/database';

async function verify() {
    console.log('🧪 Phase 43 Verification: Execution Metrics & Observability\n');

    const executionService = new ExecutionService();
    const workflowService = new WorkflowService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new FailNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);

    // Test 1: Basic Metrics
    console.log('Test 1: Basic Metrics');
    const wfBasic = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            { id: 'set', type: 'core.set', parameters: { values: { processed: true } } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'set', type: 'main', index: 0 }]] }
        }
    };

    const execBasic = await executionService.createExecution({
        workflowId: 'test-wf-basic-metrics',
        mode: 'manual',
        workflowSnapshot: wfBasic
    });
    await engine.run(execBasic.id, wfBasic);

    const dbExecBasic = await db.select().from(executions).where(eq(executions.id, execBasic.id)).get();
    console.log('DB Record:', JSON.stringify(dbExecBasic));
    const metricsBasic = dbExecBasic?.metrics as any;

    console.log('Metrics:', JSON.stringify(metricsBasic));

    if (metricsBasic &&
        metricsBasic.nodeCount === 2 &&
        metricsBasic.successCount === 2 &&
        metricsBasic.errorCount === 0 &&
        metricsBasic.executionTimeMs >= 0) {
        console.log('✅ Basic Metrics: Correct counts and duration');
    } else {
        console.error('❌ Basic Metrics: Incorrect metrics');
        process.exit(1);
    }

    // Test 2: Metrics with Retries
    console.log('\nTest 2: Metrics with Retries');
    const wfRetry = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            {
                id: 'fail-node',
                type: 'core.fail',
                parameters: {
                    failCount: 1,
                    retryConfig: { maxRetries: 2, backoffMs: 50 }
                }
            }
        ],
        connections: {
            'trigger': { main: [[{ node: 'fail-node', type: 'main', index: 0 }]] }
        }
    };

    const execRetry = await executionService.createExecution({
        workflowId: 'test-wf-retry-metrics',
        mode: 'manual',
        workflowSnapshot: wfRetry
    });
    await engine.run(execRetry.id, wfRetry);

    const dbExecRetry = await db.select().from(executions).where(eq(executions.id, execRetry.id)).get();
    const metricsRetry = dbExecRetry.metrics as any;

    console.log('Metrics:', JSON.stringify(metricsRetry));

    // Note: nodeCount increments for each attempt in my implementation
    // Initial trigger (1) + Fail attempt 1 (1) + Fail attempt 2 (success) (1) = 3
    if (metricsRetry &&
        metricsRetry.nodeCount === 3 &&
        metricsRetry.successCount === 2 &&
        metricsRetry.retryCount === 1) {
        console.log('✅ Retry Metrics: Correct counts');
    } else {
        console.error('❌ Retry Metrics: Incorrect metrics');
        process.exit(1);
    }

    // Test 3: Metrics with Error
    console.log('\nTest 3: Metrics with Error');
    const wfError = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            { id: 'fail', type: 'core.fail', parameters: { failCount: 10 } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'fail', type: 'main', index: 0 }]] }
        }
    };

    const execError = await executionService.createExecution({
        workflowId: 'test-wf-error-metrics',
        mode: 'manual',
        workflowSnapshot: wfError
    });

    try {
        await engine.run(execError.id, wfError);
    } catch (e) { }

    const dbExecError = await db.select().from(executions).where(eq(executions.id, execError.id)).get();
    const metricsError = dbExecError.metrics as any;

    console.log('Metrics:', JSON.stringify(metricsError));

    if (metricsError &&
        metricsError.nodeCount === 2 &&
        metricsError.errorCount === 1 &&
        metricsError.successCount === 1) {
        console.log('✅ Error Metrics: Correct counts');
    } else {
        console.error('❌ Error Metrics: Incorrect metrics');
        process.exit(1);
    }

    console.log('\n🎉 Phase 43 Verified!');
    process.exit(0);
}

verify().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
