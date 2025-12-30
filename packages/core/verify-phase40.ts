import { ExecutionEngine } from './src/execution/execution-engine';
import { ExecutionService } from './src/services/execution.service';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { ForEachNode } from './src/nodes/core.forEach';
import { SetNode } from './src/nodes/core.set';
import { db, executions, executionSteps, eq } from '@local-n8n/database';

async function verify() {
    console.log('🧪 Phase 40 Verification: ForEach Node\n');

    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new ForEachNode());
    nodeRegistry.register(new SetNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    // Test 1: Basic ForEach Iteration
    console.log('Test 1: Basic ForEach Iteration');
    const wfLoop = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: [{ id: 1 }, { id: 2 }, { id: 3 }] } },
            { id: 'loop', type: 'core.forEach', parameters: {} },
            { id: 'set', type: 'core.set', parameters: { values: { processed: true, item: '{{ $item.id }}', index: '{{ $index }}' } } }
        ],
        connections: {
            'trigger': {
                main: [[{ node: 'loop', type: 'main', index: 0 }]]
            },
            'loop': {
                main: [[{ node: 'set', type: 'main', index: 0 }]]
            }
        }
    };

    const execLoop = await executionService.createExecution({
        workflowId: 'test-wf-loop',
        mode: 'manual',
        workflowSnapshot: wfLoop
    });
    await engine.run(execLoop.id, wfLoop);

    const stepsLoop = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execLoop.id)).all();
    const setSteps = stepsLoop.filter(s => s.nodeId === 'set');

    if (setSteps.length === 3) {
        console.log('✅ ForEach: Executed downstream node 3 times');

        const results = setSteps.map(s => s.outputData[0]);
        console.log('Results:', JSON.stringify(results));

        const valid = results.every((r, i) => r.item === i + 1 && r.index === i);
        if (valid) {
            console.log('✅ ForEach: Correct $item and $index values');
        } else {
            console.error('❌ ForEach: Incorrect values in iterations');
            process.exit(1);
        }
    } else {
        console.error(`❌ ForEach: Expected 3 iterations, got ${setSteps.length}`);
        process.exit(1);
    }

    // Test 2: Empty Array
    console.log('\nTest 2: Empty Array');
    const wfEmpty = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: [] } },
            { id: 'loop', type: 'core.forEach', parameters: {} },
            { id: 'set', type: 'core.set', parameters: { values: { shouldNotRun: true } } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'loop', type: 'main', index: 0 }]] },
            'loop': { main: [[{ node: 'set', type: 'main', index: 0 }]] }
        }
    };

    const execEmpty = await executionService.createExecution({
        workflowId: 'test-wf-empty',
        mode: 'manual',
        workflowSnapshot: wfEmpty
    });
    await engine.run(execEmpty.id, wfEmpty);

    const stepsEmpty = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execEmpty.id)).all();
    const setStepEmpty = stepsEmpty.find(s => s.nodeId === 'set');

    if (!setStepEmpty) {
        console.log('✅ ForEach: Correctly skipped downstream execution for empty array');
    } else {
        console.error('❌ ForEach: Executed downstream node for empty array');
        process.exit(1);
    }

    console.log('\n🎉 Phase 40 Verified!');
    process.exit(0);
}

verify().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
