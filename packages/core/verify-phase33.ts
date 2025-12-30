import { db, workflows, executions, executionSteps, eq } from '@local-n8n/database';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { ExecutionService } from '@local-n8n/core/src/services/execution.service';
import { ExecutionEngine } from '@local-n8n/core/src/execution/execution-engine';
import { NodeRegistry } from '@local-n8n/core/src/execution/node-registry';
import { EventBus } from '@local-n8n/core/src/execution/event-bus';
import { HttpRequestNode } from '@local-n8n/core/src/nodes/core.httpRequest';
import { SetNode } from '@local-n8n/core/src/nodes/core.set';
import { ManualTriggerNode } from '@local-n8n/core/src/nodes/core.manualTrigger';

async function verifyPhase33() {
    console.log('🧪 Phase 33 Verification: Expressions Engine\n');

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    nodeRegistry.register(new HttpRequestNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new ManualTriggerNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    try {
        // Test 1: Use $json to reference previous node output
        console.log('Test 1: Expression with $json');
        const wf1 = await workflowService.createWorkflow({
            name: 'Test Expressions with $json',
            nodes: [
                { id: 'trigger1', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                {
                    id: 'http1',
                    type: 'HttpRequest',
                    parameters: {
                        method: 'GET',
                        url: 'https://jsonplaceholder.typicode.com/users/1',
                        headers: {}
                    },
                    position: [200, 0]
                },
                {
                    id: 'set1',
                    type: 'Set',
                    parameters: {
                        values: {
                            userId: '{{ $json.id }}',
                            userName: '{{ $json.name }}',
                            userEmail: '{{ $json.email }}'
                        }
                    },
                    position: [400, 0]
                }
            ],
            connections: {
                trigger1: { main: [[{ node: 'http1', type: 'main', index: 0 }]] },
                http1: { main: [[{ node: 'set1', type: 'main', index: 0 }]] }
            }
        });

        if (!wf1) throw new Error('Failed to create workflow 1');

        const exec1 = await executionService.createExecution({
            workflowId: wf1.id,
            mode: 'manual',
            workflowSnapshot: wf1
        });

        if (!exec1) throw new Error('Failed to create execution 1');

        await engine.run(exec1.id, wf1);

        const steps1 = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec1.id)).all();
        console.log('All steps:', steps1.map(s => ({ nodeId: s.nodeId, status: s.status, error: s.error })));

        const httpStep = steps1.find(s => s.nodeId === 'http1');
        console.log('HTTP step output:', JSON.stringify(httpStep?.outputData, null, 2));

        const setStep = steps1.find(s => s.nodeId === 'set1');

        if (!setStep || setStep.status !== 'success') {
            throw new Error(`Set node failed: ${setStep?.error || 'not found'}`);
        }

        const output = setStep.outputData as any;
        console.log('Set node output:', JSON.stringify(output, null, 2));

        // Verify expressions were resolved
        if (!output.userId || output.userId === '{{ $json.id }}') {
            throw new Error('Expression not resolved: userId still contains template');
        }

        console.log('✅ $json expressions resolved correctly');
        console.log(`✅ userId: ${output.userId}, userName: ${output.userName}\n`);

        // Test 2: No expressions (backward compatibility)
        console.log('Test 2: No expressions (backward compatibility)');
        const wf2 = await workflowService.createWorkflow({
            name: 'Test No Expressions',
            nodes: [
                { id: 'trigger2', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                {
                    id: 'set2',
                    type: 'Set',
                    parameters: {
                        values: {
                            staticValue: 'test123'
                        }
                    },
                    position: [200, 0]
                }
            ],
            connections: {
                trigger2: { main: [[{ node: 'set2', type: 'main', index: 0 }]] }
            }
        });

        if (!wf2) throw new Error('Failed to create workflow 2');

        const exec2 = await executionService.createExecution({
            workflowId: wf2.id,
            mode: 'manual',
            workflowSnapshot: wf2
        });

        if (!exec2) throw new Error('Failed to create execution 2');

        await engine.run(exec2.id, wf2);

        const steps2 = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec2.id)).all();
        const setStep2 = steps2.find(s => s.nodeId === 'set2');

        if (!setStep2 || setStep2.status !== 'success') {
            throw new Error('Set node without expressions failed');
        }

        const output2 = setStep2.outputData as any;
        if (output2.staticValue !== 'test123') {
            throw new Error('Static value was modified');
        }

        console.log('✅ Workflow without expressions works correctly\n');

        // Test 3: Invalid expression (should fail gracefully)
        console.log('Test 3: Invalid expression error handling');
        const wf3 = await workflowService.createWorkflow({
            name: 'Test Invalid Expression',
            nodes: [
                { id: 'trigger3', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                {
                    id: 'set3',
                    type: 'Set',
                    parameters: {
                        values: {
                            invalid: '{{ $json.nonexistent.deeply.nested }}'
                        }
                    },
                    position: [200, 0]
                }
            ],
            connections: {
                trigger3: { main: [[{ node: 'set3', type: 'main', index: 0 }]] }
            }
        });

        if (!wf3) throw new Error('Failed to create workflow 3');

        const exec3 = await executionService.createExecution({
            workflowId: wf3.id,
            mode: 'manual',
            workflowSnapshot: wf3
        });

        if (!exec3) throw new Error('Failed to create execution 3');

        try {
            await engine.run(exec3.id, wf3);
        } catch (error) {
            // Expected to fail
        }

        const steps3 = await db.select().from(executionSteps).where(eq(executionSteps.executionId, exec3.id)).all();
        const setStep3 = steps3.find(s => s.nodeId === 'set3');

        if (!setStep3 || setStep3.status !== 'error') {
            throw new Error('Expected execution to fail with invalid expression');
        }

        if (!setStep3.error || !setStep3.error.includes('Invalid expression')) {
            console.log('Error:', setStep3.error);
            throw new Error('Expected clear error message about invalid expression');
        }

        console.log('✅ Invalid expression handled correctly');
        console.log(`✅ Error message: ${setStep3.error}\n`);

        console.log('✅ All Phase 33 tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verifyPhase33();
