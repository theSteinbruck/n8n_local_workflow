import { ExecutionEngine } from './src/execution/execution-engine';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ExecutionService } from './src/services/execution.service';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { SetNode } from './src/nodes/core.set';
import { IfNode } from './src/nodes/core.if';
import { MergeNode } from './src/nodes/core.merge';
import { db } from '@local-n8n/database';
import { executionSteps } from '@local-n8n/database/src/schema';
import { eq } from 'drizzle-orm';

async function verifyPhase39() {
    console.log('🧪 Phase 39 Verification: Merge Node');

    const nodeRegistry = new NodeRegistry();
    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new IfNode());
    nodeRegistry.register(new MergeNode());

    const eventBus = new EventBus();
    const executionService = new ExecutionService();
    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    // Test 1: Parallel Branches (Append)
    console.log('\nTest 1: Parallel Branches (Append)');
    const wfParallel = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'setA', type: 'core.set', parameters: { values: { source: 'A' } } },
            { id: 'setB', type: 'core.set', parameters: { values: { source: 'B' } } },
            { id: 'merge', type: 'Merge', parameters: { mode: 'append' } }
        ],
        connections: {
            'trigger': {
                main: [
                    [
                        { node: 'setA', type: 'main', index: 0 },
                        { node: 'setB', type: 'main', index: 0 }
                    ]
                ]
            },
            'setA': {
                main: [[{ node: 'merge', type: 'main', index: 0 }]]
            },
            'setB': {
                main: [[{ node: 'merge', type: 'main', index: 1 }]]
            }
        }
    };

    const execParallel = await executionService.createExecution({
        workflowId: 'test-wf-parallel',
        mode: 'manual',
        workflowSnapshot: wfParallel
    });
    await engine.run(execParallel.id, wfParallel);

    const execution = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execParallel.id)).all();
    // Check main execution status
    // We need to query executions table, but let's just look at steps for now.

    const mergeStep = execution.find(s => s.nodeId === 'merge');

    if (!mergeStep) {
        console.error('❌ Parallel Merge: Merge step not found');
        console.log('Steps:', execution.map(s => `${s.nodeId}: ${s.status}`));
        process.exit(1);
    }

    if (mergeStep && mergeStep.outputData && Array.isArray(mergeStep.outputData[0]) && mergeStep.outputData[0].length === 2) {
        console.log('✅ Parallel Merge: Executed and merged 2 items');
        console.log('Output:', JSON.stringify(mergeStep.outputData[0]));
    } else {
        console.error('❌ Parallel Merge: Failed');
        console.log('Output:', mergeStep?.outputData);
        process.exit(1);
    }

    // Test 2: Dead Path (If True)
    console.log('\nTest 2: Dead Path (If True)');
    const wfIfTrue = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'ifNode', type: 'If', parameters: { condition: true } },
            { id: 'setTrue', type: 'core.set', parameters: { values: { branch: 'true' } } },
            { id: 'setFalse', type: 'core.set', parameters: { values: { branch: 'false' } } },
            { id: 'merge', type: 'Merge', parameters: { mode: 'append' } }
        ],
        connections: {
            'trigger': {
                main: [[{ node: 'ifNode', type: 'main', index: 0 }]]
            },
            'ifNode': {
                main: [
                    [{ node: 'setTrue', type: 'main', index: 0 }],
                    [{ node: 'setFalse', type: 'main', index: 0 }]
                ]
            },
            'setTrue': {
                main: [[{ node: 'merge', type: 'main', index: 0 }]]
            },
            'setFalse': {
                main: [[{ node: 'merge', type: 'main', index: 1 }]]
            }
        }
    };

    const execIfTrue = await executionService.createExecution({
        workflowId: 'test-wf-if-true',
        mode: 'manual',
        workflowSnapshot: wfIfTrue
    });
    await engine.run(execIfTrue.id, wfIfTrue);

    const stepsIfTrue = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execIfTrue.id)).all();
    const mergeStepTrue = stepsIfTrue.find(s => s.nodeId === 'merge');

    if (mergeStepTrue && mergeStepTrue.outputData && Array.isArray(mergeStepTrue.outputData[0]) && mergeStepTrue.outputData[0].length === 1) {
        console.log('✅ Dead Path (True): Merged 1 item');
        console.log('Output:', JSON.stringify(mergeStepTrue.outputData[0]));
        if (mergeStepTrue.outputData[0][0].branch !== 'true') {
            console.error('❌ Wrong branch data');
            process.exit(1);
        }
    } else {
        console.error('❌ Dead Path (True): Failed');
        console.log('Output:', mergeStepTrue?.outputData);
        process.exit(1);
    }

    // Test 3: Dead Path (If False)
    console.log('\nTest 3: Dead Path (If False)');
    const wfIfFalse = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'ifNode', type: 'If', parameters: { condition: false } },
            { id: 'setTrue', type: 'core.set', parameters: { values: { branch: 'true' } } },
            { id: 'setFalse', type: 'core.set', parameters: { values: { branch: 'false' } } },
            { id: 'merge', type: 'Merge', parameters: { mode: 'append' } }
        ],
        connections: {
            'trigger': {
                main: [[{ node: 'ifNode', type: 'main', index: 0 }]]
            },
            'ifNode': {
                main: [
                    [{ node: 'setTrue', type: 'main', index: 0 }],
                    [{ node: 'setFalse', type: 'main', index: 0 }]
                ]
            },
            'setTrue': {
                main: [[{ node: 'merge', type: 'main', index: 0 }]]
            },
            'setFalse': {
                main: [[{ node: 'merge', type: 'main', index: 1 }]]
            }
        }
    };

    const execIfFalse = await executionService.createExecution({
        workflowId: 'test-wf-if-false',
        mode: 'manual',
        workflowSnapshot: wfIfFalse
    });
    await engine.run(execIfFalse.id, wfIfFalse);

    const stepsIfFalse = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execIfFalse.id)).all();
    const mergeStepFalse = stepsIfFalse.find(s => s.nodeId === 'merge');

    if (mergeStepFalse && mergeStepFalse.outputData && Array.isArray(mergeStepFalse.outputData[0]) && mergeStepFalse.outputData[0].length === 1) {
        console.log('✅ Dead Path (False): Merged 1 item');
        console.log('Output:', JSON.stringify(mergeStepFalse.outputData[0]));
        if (mergeStepFalse.outputData[0][0].branch !== 'false') {
            console.error('❌ Wrong branch data');
            process.exit(1);
        }
    } else {
        console.error('❌ Dead Path (False): Failed');
        console.log('Output:', mergeStepFalse?.outputData);
        process.exit(1);
    }

    // Test 4: Merge By Key
    console.log('\nTest 4: Merge By Key');
    const wfMergeKey = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'setA', type: 'core.set', parameters: { values: { id: 1, name: 'Item 1' } } },
            { id: 'setB', type: 'core.set', parameters: { values: { id: 1, email: 'item1@example.com' } } },
            { id: 'merge', type: 'Merge', parameters: { mode: 'mergeByKey', mergeKey: 'id' } }
        ],
        connections: {
            'trigger': {
                main: [
                    [
                        { node: 'setA', type: 'main', index: 0 },
                        { node: 'setB', type: 'main', index: 0 }
                    ]
                ]
            },
            'setA': {
                main: [[{ node: 'merge', type: 'main', index: 0 }]]
            },
            'setB': {
                main: [[{ node: 'merge', type: 'main', index: 1 }]]
            }
        }
    };

    const execMergeKey = await executionService.createExecution({
        workflowId: 'test-wf-merge-key',
        mode: 'manual',
        workflowSnapshot: wfMergeKey
    });
    await engine.run(execMergeKey.id, wfMergeKey);

    const stepsMergeKey = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execMergeKey.id)).all();
    const mergeStepKey = stepsMergeKey.find(s => s.nodeId === 'merge');

    if (mergeStepKey && mergeStepKey.outputData && Array.isArray(mergeStepKey.outputData[0]) && mergeStepKey.outputData[0].length === 1) {
        const item = mergeStepKey.outputData[0][0];
        if (item.id === 1 && item.name === 'Item 1' && item.email === 'item1@example.com') {
            console.log('✅ Merge By Key: Successfully merged items by ID');
            console.log('Output:', JSON.stringify(mergeStepKey.outputData[0]));
        } else {
            console.error('❌ Merge By Key: Incorrect merge result');
            console.log('Output:', JSON.stringify(item));
            process.exit(1);
        }
    } else {
        console.error('❌ Merge By Key: Failed');
        console.log('Output:', mergeStepKey?.outputData);
        process.exit(1);
    }

    console.log('\n🎉 Phase 39 Verified!');
    process.exit(0);
}

verifyPhase39().catch(console.error);
