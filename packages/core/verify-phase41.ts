import { ExecutionEngine } from './src/execution/execution-engine';
import { ExecutionService } from './src/services/execution.service';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { FailNode } from './src/nodes/core.fail';
import { SetNode } from './src/nodes/core.set';
import { db, executions, executionSteps, eq } from '@local-n8n/database';

async function verify() {
    console.log('🧪 Phase 41 Verification: Error Handling & Retry Policies\n');

    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new FailNode());
    nodeRegistry.register(new SetNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    // Test 1: Successful Retry
    console.log('Test 1: Successful Retry (fail once, then succeed)');
    const wfRetry = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            {
                id: 'fail-node',
                type: 'core.fail',
                parameters: {
                    failCount: 1,
                    retryConfig: { maxRetries: 2, backoffMs: 100 }
                }
            }
        ],
        connections: {
            'trigger': { main: [[{ node: 'fail-node', type: 'main', index: 0 }]] }
        }
    };

    const execRetry = await executionService.createExecution({
        workflowId: 'test-wf-retry',
        mode: 'manual',
        workflowSnapshot: wfRetry
    });
    await engine.run(execRetry.id, wfRetry);

    const stepsRetry = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execRetry.id)).all();
    const failSteps = stepsRetry.filter(s => s.nodeId === 'fail-node');

    if (failSteps.length === 2) {
        console.log('✅ Retry: Created 2 execution steps (1 fail, 1 success)');
        const lastStep = failSteps[failSteps.length - 1];
        if (lastStep.status === 'success') {
            console.log('✅ Retry: Final status is success');
        } else {
            console.error('❌ Retry: Final status is not success');
            process.exit(1);
        }
    } else {
        console.error(`❌ Retry: Expected 2 steps, got ${failSteps.length}`);
        process.exit(1);
    }

    // Test 2: Max Retries Exceeded
    console.log('\nTest 2: Max Retries Exceeded');
    const wfMaxRetry = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            {
                id: 'fail-node-max',
                type: 'core.fail',
                parameters: {
                    failCount: 5,
                    retryConfig: { maxRetries: 2, backoffMs: 10 }
                }
            }
        ],
        connections: {
            'trigger': { main: [[{ node: 'fail-node-max', type: 'main', index: 0 }]] }
        }
    };

    const execMaxRetry = await executionService.createExecution({
        workflowId: 'test-wf-max-retry',
        mode: 'manual',
        workflowSnapshot: wfMaxRetry
    });

    try {
        await engine.run(execMaxRetry.id, wfMaxRetry);
        console.error('❌ MaxRetry: Execution should have failed');
        process.exit(1);
    } catch (e) {
        console.log('✅ MaxRetry: Execution failed as expected');
    }

    const stepsMaxRetry = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execMaxRetry.id)).all();
    const failStepsMax = stepsMaxRetry.filter(s => s.nodeId === 'fail-node-max');

    if (failStepsMax.length === 3) {
        console.log('✅ MaxRetry: Created 3 execution steps (initial + 2 retries)');
        if (failStepsMax.every(s => s.status === 'error')) {
            console.log('✅ MaxRetry: All steps have error status');
        } else {
            console.error('❌ MaxRetry: Some steps are not error');
            console.log('Statuses:', failStepsMax.map(s => `${s.nodeId}: ${s.status}`));
            process.exit(1);
        }
    } else {
        console.error(`❌ MaxRetry: Expected 3 steps, got ${failStepsMax.length}`);
        process.exit(1);
    }

    // Test 3: Continue on Fail
    console.log('\nTest 3: Continue on Fail');
    const wfContinue = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { start: true } } },
            {
                id: 'fail-node-cont',
                type: 'core.fail',
                parameters: {
                    failCount: 10,
                    retryConfig: { maxRetries: 0, onError: 'continue' }
                }
            },
            { id: 'set-node', type: 'core.set', parameters: { values: { afterFail: true } } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'fail-node-cont', type: 'main', index: 0 }]] },
            'fail-node-cont': { main: [[{ node: 'set-node', type: 'main', index: 0 }]] }
        }
    };

    const execContinue = await executionService.createExecution({
        workflowId: 'test-wf-continue',
        mode: 'manual',
        workflowSnapshot: wfContinue
    });
    await engine.run(execContinue.id, wfContinue);

    const stepsContinue = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execContinue.id)).all();
    const setStep = stepsContinue.find(s => s.nodeId === 'set-node');

    if (setStep && setStep.status === 'success') {
        console.log('✅ ContinueOnFail: Workflow continued to next node');
    } else {
        console.error('❌ ContinueOnFail: Next node did not execute or failed');
        process.exit(1);
    }

    console.log('\n🎉 Phase 41 Verified!');
    process.exit(0);
}

verify().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
