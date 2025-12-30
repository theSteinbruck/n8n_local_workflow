import { ExecutionEngine } from './src/execution/execution-engine';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ExecutionService } from './src/services/execution.service';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { SetNode } from './src/nodes/core.set';
import { IfNode } from './src/nodes/core.if';
import { db } from '@local-n8n/database';
import { executionSteps, executions } from '@local-n8n/database/src/schema';
import { eq } from 'drizzle-orm';

async function verifyPhase34() {
    console.log('🧪 Phase 34 Verification: IF / Router Node');

    const nodeRegistry = new NodeRegistry();
    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new IfNode());

    const eventBus = new EventBus();
    const executionService = new ExecutionService();
    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    // Test 1: IF True
    console.log('\nTest 1: IF True');
    const wfTrue = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'ifNode', type: 'If', parameters: { condition: true } },
            { id: 'trueNode', type: 'core.set', parameters: { values: { status: 'True Branch' } } },
            { id: 'falseNode', type: 'core.set', parameters: { values: { status: 'False Branch' } } }
        ],
        connections: {
            'trigger': {
                main: [[{ node: 'ifNode', type: 'main', index: 0 }]]
            },
            'ifNode': {
                main: [
                    [{ node: 'trueNode', type: 'main', index: 0 }], // Output 0 (True)
                    [{ node: 'falseNode', type: 'main', index: 0 }] // Output 1 (False)
                ]
            }
        }
    };

    const execTrue = await executionService.createExecution({
        workflowId: 'test-workflow-id',
        mode: 'manual',
        workflowSnapshot: wfTrue
    });
    await engine.run(execTrue.id, wfTrue);

    const stepsTrue = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execTrue.id)).all();
    const trueNodeStep = stepsTrue.find(s => s.nodeId === 'trueNode');
    const falseNodeStep = stepsTrue.find(s => s.nodeId === 'falseNode');

    if (trueNodeStep && !falseNodeStep) {
        console.log('✅ IF True: Executed true branch only');
    } else {
        console.error('❌ IF True: Failed', { trueNode: !!trueNodeStep, falseNode: !!falseNodeStep });
        process.exit(1);
    }

    // Test 2: IF False
    console.log('\nTest 2: IF False');
    const wfFalse = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'ifNode', type: 'If', parameters: { condition: false } },
            { id: 'trueNode', type: 'core.set', parameters: { values: { status: 'True Branch' } } },
            { id: 'falseNode', type: 'core.set', parameters: { values: { status: 'False Branch' } } }
        ],
        connections: {
            'trigger': {
                main: [[{ node: 'ifNode', type: 'main', index: 0 }]]
            },
            'ifNode': {
                main: [
                    [{ node: 'trueNode', type: 'main', index: 0 }],
                    [{ node: 'falseNode', type: 'main', index: 0 }]
                ]
            }
        }
    };

    const execFalse = await executionService.createExecution({
        workflowId: 'test-workflow-id',
        mode: 'manual',
        workflowSnapshot: wfFalse
    });
    await engine.run(execFalse.id, wfFalse);

    const stepsFalse = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execFalse.id)).all();
    const trueNodeStep2 = stepsFalse.find(s => s.nodeId === 'trueNode');
    const falseNodeStep2 = stepsFalse.find(s => s.nodeId === 'falseNode');

    if (!trueNodeStep2 && falseNodeStep2) {
        console.log('✅ IF False: Executed false branch only');
    } else {
        console.error('❌ IF False: Failed', { trueNode: !!trueNodeStep2, falseNode: !!falseNodeStep2 });
        process.exit(1);
    }

    // Test 3: Expression Condition
    console.log('\nTest 3: Expression Condition');
    const wfExpr = {
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'setVal', type: 'core.set', parameters: { values: { value: 'test' } } },
            { id: 'ifNode', type: 'If', parameters: { condition: '{{ $json.value === "test" }}' } },
            { id: 'trueNode', type: 'core.set', parameters: { values: { status: 'Matched' } } }
        ],
        connections: {
            'trigger': {
                main: [[{ node: 'setVal', type: 'main', index: 0 }]]
            },
            'setVal': {
                main: [[{ node: 'ifNode', type: 'main', index: 0 }]]
            },
            'ifNode': {
                main: [
                    [{ node: 'trueNode', type: 'main', index: 0 }],
                    []
                ]
            }
        }
    };

    const execExpr = await executionService.createExecution({
        workflowId: 'test-workflow-id',
        mode: 'manual',
        workflowSnapshot: wfExpr
    });
    await engine.run(execExpr.id, wfExpr);

    const stepsExpr = await db.select().from(executionSteps).where(eq(executionSteps.executionId, execExpr.id)).all();
    const trueNodeStep3 = stepsExpr.find(s => s.nodeId === 'trueNode');

    if (trueNodeStep3) {
        console.log('✅ Expression Condition: Resolved and executed true branch');
    } else {
        console.error('❌ Expression Condition: Failed');
        // console.log(stepsExpr);
        process.exit(1);
    }

    console.log('\n🎉 Phase 34 Verified!');
    process.exit(0);
}

verifyPhase34().catch(console.error);
