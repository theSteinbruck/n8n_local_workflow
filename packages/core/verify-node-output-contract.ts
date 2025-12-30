import { db, executions, executionSteps, eq } from '@local-n8n/database';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { ExecutionService } from '@local-n8n/core/src/services/execution.service';
import { ExecutionEngine } from '@local-n8n/core/src/execution/execution-engine';
import { NodeRegistry } from '@local-n8n/core/src/execution/node-registry';
import { EventBus } from '@local-n8n/core/src/execution/event-bus';
import { createNode } from '@local-n8n/core/src/sdk';

// Ensure encryption key is set for dependency services
process.env.N8N_ENCRYPTION_KEY = '12345678901234567890123456789012';

async function verifyNodeOutputContract() {
    console.log('🧪 Verifying Node Output Contract Hardening\n');

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    // 1. Register a test node that returns non-standard data
    const RawDataNode = createNode({
        name: 'RawData',
        displayName: 'Raw Data',
        description: 'Returns non-standard data',
        execute: async (context) => {
            return { raw: 'data', value: 123 }; // Should be normalized to { json: { raw: 'data', ... } }
        }
    });

    const ArrayNode = createNode({
        name: 'ArrayData',
        displayName: 'Array Data',
        description: 'Returns array of objects',
        execute: async (context) => {
            return [
                { foo: 'bar' },
                { foo: 'baz' }
            ]; // Should be normalized to [{ json: { foo: 'bar' } }, { json: { foo: 'baz' } }]
        }
    });

    const ExpressionNode = createNode({
        name: 'ExpressionNode',
        displayName: 'Expression Node',
        description: 'Uses expressions to access data',
        execute: async (context) => {
            const val = context.getNodeParameter('value');
            return { result: val };
        }
    });

    nodeRegistry.register(RawDataNode);
    nodeRegistry.register(ArrayNode);
    nodeRegistry.register(ExpressionNode);
    nodeRegistry.register(createNode({
        name: 'ManualTrigger',
        displayName: 'Manual Trigger',
        description: 'Trigger',
        isTrigger: true,
        execute: async () => ({ triggered: true })
    }));

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);

    try {
        console.log('Test 1: Auto-normalization of raw objects');
        const wf1 = await workflowService.createWorkflow({
            name: 'Normalization Test',
            nodes: [
                { id: 't1', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                { id: 'raw1', type: 'RawData', parameters: {}, position: [200, 0] },
                { id: 'array1', type: 'ArrayData', parameters: {}, position: [400, 0] }
            ],
            connections: {
                t1: { main: [[{ node: 'raw1', type: 'main', index: 0 }]] },
                raw1: { main: [[{ node: 'array1', type: 'main', index: 0 }]] }
            }
        });

        const exec1Id = (await executionService.createExecution({ workflowId: wf1.id, mode: 'manual', workflowSnapshot: wf1 }))!.id;
        await engine.run(exec1Id, wf1);

        const steps = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec1Id)).all();

        const rawStep = steps.find(s => s.nodeId === 'raw1');
        const rawOut = rawStep?.outputData as any;
        if (!rawOut || !rawOut[0] || !rawOut[0].json || rawOut[0].json.raw !== 'data') {
            throw new Error(`Raw data not normalized correctly: ${JSON.stringify(rawOut)}`);
        }
        console.log('✅ Raw object normalized to { json: { ... } }');

        const arrayStep = steps.find(s => s.nodeId === 'array1');
        const arrayOut = arrayStep?.outputData as any;
        if (!Array.isArray(arrayOut) || !arrayOut[0].json || arrayOut[0].json.foo !== 'bar') {
            throw new Error(`Array data not normalized correctly: ${JSON.stringify(arrayOut)}`);
        }
        console.log('✅ Array of objects normalized to [{ json: { ... } }, ...]');

        console.log('\nTest 2: Expression access via .json and .all');
        const wf2 = await workflowService.createWorkflow({
            name: 'Expression Access Test',
            nodes: [
                { id: 't2', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                { id: 'src', type: 'ArrayData', parameters: {}, position: [200, 0], label: 'DataSource' },
                {
                    id: 'exp',
                    type: 'ExpressionNode',
                    parameters: {
                        value: '{{ $node["DataSource"].json.foo }}'
                    },
                    position: [400, 0]
                },
                {
                    id: 'expAll',
                    type: 'ExpressionNode',
                    parameters: {
                        value: '{{ $node["DataSource"].all.length }}'
                    },
                    position: [400, 100]
                }
            ],
            connections: {
                t2: { main: [[{ node: 'src', type: 'main', index: 0 }]] },
                src: {
                    main: [
                        [
                            { node: 'exp', type: 'main', index: 0 },
                            { node: 'expAll', type: 'main', index: 0 }
                        ]
                    ]
                }
            }
        });

        const exec2Id = (await executionService.createExecution({ workflowId: wf2.id, mode: 'manual', workflowSnapshot: wf2 }))!.id;
        await engine.run(exec2Id, wf2);

        const steps2 = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec2Id)).all();

        const expStep = steps2.find(s => s.nodeId === 'exp');
        if ((expStep?.outputData as any)[0].json.result !== 'bar') {
            throw new Error(`$node["X"].json failed: ${JSON.stringify(expStep?.outputData)}`);
        }
        console.log('✅ $node["X"].json access works');

        const expAllStep = steps2.find(s => s.nodeId === 'expAll');
        if (!expAllStep || !(expAllStep.outputData as any)[0] || (expAllStep.outputData as any)[0].json.result !== 2) {
            throw new Error(`$node["X"].all failed: ${JSON.stringify(expAllStep?.outputData)}`);
        }
        console.log('✅ $node["X"].all access works');

        console.log('\n✅ All Output Contract Hardening tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verifyNodeOutputContract();
