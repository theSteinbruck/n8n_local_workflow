import { WorkflowService } from './src/services/workflow.service';
import { ExecutionService } from './src/services/execution.service';
import { ExecutionEngine } from './src/execution/execution-engine';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { NoOpNode } from './src/nodes/core.noop';
import { SetNode } from './src/nodes/core.set';
import { db, executionSteps, eq } from '@local-n8n/database';

async function verify() {
    try {
        console.log('Phase 7 Verification: Node Runtime Foundation');

        // 1. Setup Dependencies
        const workflowService = new WorkflowService();
        const executionService = new ExecutionService();
        const nodeRegistry = new NodeRegistry();
        const eventBus = new EventBus();

        // 2. Register Nodes
        nodeRegistry.register(new NoOpNode());
        nodeRegistry.register(new SetNode());
        console.log('✅ Nodes registered: core.noop, core.set');

        // 3. Setup Event Listeners
        let eventsEmitted = 0;
        eventBus.on('nodeExecuteBefore', (data) => {
            console.log(`[Event] Before ${data.nodeName} (${data.nodeId})`);
            eventsEmitted++;
        });
        eventBus.on('nodeExecuteAfter', (data) => {
            console.log(`[Event] After ${data.nodeName} (${data.nodeId})`);
            eventsEmitted++;
        });

        // 4. Initialize Engine
        const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus);

        // 5. Create Workflow (Set -> NoOp)
        console.log('Creating workflow...');
        const wf = await workflowService.createWorkflow({
            name: 'Runtime Test Workflow',
            nodes: [
                {
                    id: 'set-node',
                    type: 'core.set',
                    parameters: {
                        values: { myVar: 'hello world', number: 42 }
                    }
                },
                {
                    id: 'noop-node',
                    type: 'core.noop'
                }
            ],
            connections: {},
        });

        if (!wf) throw new Error('Failed to create workflow');

        // 6. Create Execution
        console.log('Creating execution...');
        const execution = await executionService.createExecution({
            workflowId: wf.id,
            mode: 'manual',
            workflowSnapshot: wf,
        });

        if (!execution) throw new Error('Failed to create execution');

        // 7. Run Engine
        console.log('Running execution engine...');
        await engine.run(execution.id, wf);
        console.log('✅ Engine run completed.');

        // 8. Verify Events
        if (eventsEmitted !== 4) { // 2 nodes * 2 events
            throw new Error(`Expected 4 events, got ${eventsEmitted}`);
        }
        console.log('✅ Events verified.');

        // 9. Verify Data Propagation
        const steps = db.select().from(executionSteps).where(eq(executionSteps.executionId, execution.id)).all();

        const setStep = steps.find(s => s.nodeId === 'set-node');
        const noopStep = steps.find(s => s.nodeId === 'noop-node');

        if (!setStep || !noopStep) throw new Error('Missing steps');

        const setOutput = setStep.outputData as any;
        if (setOutput.myVar !== 'hello world') throw new Error('Set node failed to set data');

        const noopOutput = noopStep.outputData as any;
        if (noopOutput.myVar !== 'hello world') throw new Error('Data propagation failed (NoOp did not receive Set output)');

        console.log('✅ Data propagation verified.');
        console.log('✅ Phase 7 Complete.');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
