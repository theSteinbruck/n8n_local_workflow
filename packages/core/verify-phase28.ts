import { db, workflows, executions, executionSteps, eq } from '@local-n8n/database';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { ExecutionService } from '@local-n8n/core/src/services/execution.service';
import { ExecutionEngine } from '@local-n8n/core/src/execution/execution-engine';
import { NodeRegistry } from '@local-n8n/core/src/execution/node-registry';
import { EventBus } from '@local-n8n/core/src/execution/event-bus';
import { NoOpNode } from '@local-n8n/core/src/nodes/core.noop';
import { HttpRequestNode } from '@local-n8n/core/src/nodes/core.httpRequest';
import { ManualTriggerNode } from '@local-n8n/core/src/nodes/core.manualTrigger';

async function verifyPhase28() {
    console.log('🧪 Phase 28 Verification: HTTP Request Node\n');

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    // Register nodes
    nodeRegistry.register(new NoOpNode());
    nodeRegistry.register(new HttpRequestNode());
    nodeRegistry.register(new ManualTriggerNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    try {
        // Test 1: GET Request
        console.log('Test 1: HTTP GET request');
        const wf1 = await workflowService.createWorkflow({
            name: 'Test HTTP GET',
            nodes: [
                { id: 'trigger1', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                {
                    id: 'http1',
                    type: 'HttpRequest',
                    parameters: {
                        method: 'GET',
                        url: 'https://jsonplaceholder.typicode.com/posts/1',
                        headers: {}
                    },
                    position: [200, 0]
                }
            ],
            connections: {
                trigger1: { main: [[{ node: 'http1', type: 'main', index: 0 }]] }
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

        if (steps1.length !== 1) {
            throw new Error(`Expected 1 execution step, got ${steps1.length}`);
        }

        const httpStep = steps1.find(s => s.nodeId === 'http1');
        if (!httpStep) {
            throw new Error('HTTP request step not found');
        }

        if (httpStep.status !== 'success') {
            throw new Error(`HTTP request failed: ${httpStep.error}`);
        }

        const output = httpStep.outputData as any;
        if (!output || output.status !== 200) {
            throw new Error(`Expected status 200, got ${output?.status}`);
        }

        if (!output.body || !output.body.id) {
            throw new Error('Expected response body with id field');
        }

        console.log('✅ GET request successful');
        console.log(`✅ Response status: ${output.status}`);
        console.log(`✅ Response body contains data\n`);

        // Test 2: POST Request
        console.log('Test 2: HTTP POST request');
        const wf2 = await workflowService.createWorkflow({
            name: 'Test HTTP POST',
            nodes: [
                { id: 'trigger2', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                {
                    id: 'http2',
                    type: 'HttpRequest',
                    parameters: {
                        method: 'POST',
                        url: 'https://jsonplaceholder.typicode.com/posts',
                        headers: {},
                        body: { title: 'test', body: 'test body', userId: 1 }
                    },
                    position: [200, 0]
                }
            ],
            connections: {
                trigger2: { main: [[{ node: 'http2', type: 'main', index: 0 }]] }
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

        if (steps2.length !== 1) {
            throw new Error(`Expected 1 execution step, got ${steps2.length}`);
        }

        const postStep = steps2.find(s => s.nodeId === 'http2');
        if (!postStep || postStep.status !== 'success') {
            throw new Error(`POST request failed: ${postStep?.error}`);
        }

        const postOutput = postStep.outputData as any;
        if (!postOutput || postOutput.status !== 201) {
            throw new Error(`Expected status 201, got ${postOutput?.status}`);
        }

        console.log('✅ POST request successful');
        console.log(`✅ Response status: ${postOutput.status}\n`);

        // Test 3: Error handling (invalid URL)
        console.log('Test 3: Error handling for invalid URL');
        const wf3 = await workflowService.createWorkflow({
            name: 'Test HTTP Error',
            nodes: [
                { id: 'trigger3', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                {
                    id: 'http3',
                    type: 'HttpRequest',
                    parameters: {
                        method: 'GET',
                        url: 'https://invalid-domain-that-does-not-exist-12345.com',
                        headers: {}
                    },
                    position: [200, 0]
                }
            ],
            connections: {
                trigger3: { main: [[{ node: 'http3', type: 'main', index: 0 }]] }
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
        const errorStep = steps3.find(s => s.nodeId === 'http3');

        if (!errorStep || errorStep.status !== 'error') {
            throw new Error('Expected HTTP request to fail with error status');
        }

        if (!errorStep.error || !errorStep.error.includes('HTTP Request failed')) {
            throw new Error(`Expected error message, got: ${errorStep.error}`);
        }

        console.log('✅ Error handling works correctly');
        console.log(`✅ Error message: ${errorStep.error}\n`);

        console.log('✅ All Phase 28 tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verifyPhase28();
