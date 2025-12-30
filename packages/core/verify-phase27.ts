import { db, workflows, executions, executionSteps, eq } from '@local-n8n/database';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { ExecutionService } from '@local-n8n/core/src/services/execution.service';
import { ExecutionEngine } from '@local-n8n/core/src/execution/execution-engine';
import { NodeRegistry } from '@local-n8n/core/src/execution/node-registry';
import { EventBus } from '@local-n8n/core/src/execution/event-bus';
import { NoOpNode } from '@local-n8n/core/src/nodes/core.noop';
import { SetNode } from '@local-n8n/core/src/nodes/core.set';
import { ManualTriggerNode } from '@local-n8n/core/src/nodes/core.manualTrigger';

async function verifyPhase27() {
    console.log('🧪 Phase 27 Verification: Manual Trigger Node\n');

    const workflowService = new WorkflowService();
    const executionService = new ExecutionService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    // Register nodes
    nodeRegistry.register(new NoOpNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new ManualTriggerNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

    try {
        // Test 1: Workflow WITH ManualTrigger → Set → NoOp
        console.log('Test 1: Workflow with ManualTrigger executes correctly');
        const wf1 = await workflowService.createWorkflow({
            name: 'Test Workflow with Trigger',
            nodes: [
                { id: 'trigger1', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                { id: 'set1', type: 'core.set', parameters: { value: 'test' }, position: [200, 0] },
                { id: 'noop1', type: 'core.noop', parameters: {}, position: [400, 0] }
            ],
            connections: {
                trigger1: { main: [[{ node: 'set1', type: 'main', index: 0 }]] },
                set1: { main: [[{ node: 'noop1', type: 'main', index: 0 }]] }
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

        // Should have 2 steps (Set and NoOp), NOT 3 (trigger should not execute)
        if (steps1.length !== 2) {
            throw new Error(`Expected 2 execution steps, got ${steps1.length}`);
        }

        // Verify trigger was NOT executed
        const triggerStep = steps1.find(s => s.nodeId === 'trigger1');
        if (triggerStep) {
            throw new Error('Trigger node should NOT have an execution step');
        }

        console.log('✅ Trigger node was skipped correctly');
        console.log(`✅ Executed ${steps1.length} nodes (Set, NoOp)\n`);

        // Test 2: Workflow WITHOUT trigger (backward compatibility)
        console.log('Test 2: Workflow without trigger still executes');
        const wf2 = await workflowService.createWorkflow({
            name: 'Test Workflow without Trigger',
            nodes: [
                { id: 'set2', type: 'core.set', parameters: { value: 'test' }, position: [0, 0] },
                { id: 'noop2', type: 'core.noop', parameters: {}, position: [200, 0] }
            ],
            connections: {
                set2: { main: [[{ node: 'noop2', type: 'main', index: 0 }]] }
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

        if (steps2.length !== 2) {
            throw new Error(`Expected 2 execution steps, got ${steps2.length}`);
        }

        console.log('✅ Workflow without trigger executed correctly\n');

        // Test 3: Multiple triggers should fail
        console.log('Test 3: Workflow with multiple triggers fails');
        const wf3 = await workflowService.createWorkflow({
            name: 'Test Workflow with Multiple Triggers',
            nodes: [
                { id: 'trigger1', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                { id: 'trigger2', type: 'ManualTrigger', parameters: {}, position: [0, 100] },
                { id: 'noop3', type: 'core.noop', parameters: {}, position: [200, 0] }
            ],
            connections: {
                trigger1: { main: [[{ node: 'noop3', type: 'main', index: 0 }]] },
                trigger2: { main: [[{ node: 'noop3', type: 'main', index: 0 }]] }
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
            throw new Error('Should have failed with multiple triggers');
        } catch (error: any) {
            if (error.message.includes('multiple trigger nodes')) {
                console.log('✅ Multiple triggers correctly rejected\n');
            } else {
                throw error;
            }
        }

        // Test 4: Trigger without outgoing connection should fail
        console.log('Test 4: Trigger without outgoing connection fails');
        const wf4 = await workflowService.createWorkflow({
            name: 'Test Workflow with Disconnected Trigger',
            nodes: [
                { id: 'trigger4', type: 'ManualTrigger', parameters: {}, position: [0, 0] },
                { id: 'noop4', type: 'core.noop', parameters: {}, position: [200, 0] }
            ],
            connections: {}
        });

        if (!wf4) throw new Error('Failed to create workflow 4');

        const exec4 = await executionService.createExecution({
            workflowId: wf4.id,
            mode: 'manual',
            workflowSnapshot: wf4
        });

        if (!exec4) throw new Error('Failed to create execution 4');

        try {
            await engine.run(exec4.id, wf4);
            throw new Error('Should have failed with disconnected trigger');
        } catch (error: any) {
            if (error.message.includes('outgoing connection')) {
                console.log('✅ Disconnected trigger correctly rejected\n');
            } else {
                throw error;
            }
        }

        console.log('✅ All Phase 27 tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verifyPhase27();
