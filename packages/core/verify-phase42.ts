import { ExecutionEngine } from './src/execution/execution-engine';
import { ExecutionService } from './src/services/execution.service';
import { WorkflowService } from './src/services/workflow.service';
import { NodeRegistry } from './src/execution/node-registry';
import { EventBus } from './src/execution/event-bus';
import { ManualTriggerNode } from './src/nodes/core.manualTrigger';
import { SetNode } from './src/nodes/core.set';
import { ExecuteWorkflowNode } from './src/nodes/core.executeWorkflow';
import { db, executions, executionSteps, eq } from '@local-n8n/database';

async function verify() {
    console.log('🧪 Phase 42 Verification: Subworkflow / Execute Workflow Node\n');

    const executionService = new ExecutionService();
    const workflowService = new WorkflowService();
    const nodeRegistry = new NodeRegistry();
    const eventBus = new EventBus();

    nodeRegistry.register(new ManualTriggerNode());
    nodeRegistry.register(new SetNode());
    nodeRegistry.register(new ExecuteWorkflowNode());

    const engine = new ExecutionEngine(executionService, nodeRegistry, eventBus, workflowService);

    // 1. Create Subworkflow
    console.log('Step 1: Creating subworkflow');
    const subWf = await workflowService.createWorkflow({
        name: 'Subworkflow',
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: {} },
            { id: 'set', type: 'core.set', parameters: { values: { fromSub: true, received: '{{ $json.val }}' } } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'set', type: 'main', index: 0 }]] }
        }
    });
    console.log(`✅ Subworkflow created: ${subWf.id}`);

    // 2. Create Parent Workflow
    console.log('\nStep 2: Creating parent workflow');
    const parentWf = await workflowService.createWorkflow({
        name: 'Parent Workflow',
        nodes: [
            { id: 'trigger', type: 'ManualTrigger', parameters: { data: { val: 'hello' } } },
            { id: 'execute', type: 'core.executeWorkflow', parameters: { workflowId: subWf.id } }
        ],
        connections: {
            'trigger': { main: [[{ node: 'execute', type: 'main', index: 0 }]] }
        }
    });
    console.log(`✅ Parent workflow created: ${parentWf.id}`);

    // 3. Run Parent Workflow
    console.log('\nStep 3: Running parent workflow');
    const exec = await executionService.createExecution({
        workflowId: parentWf.id,
        mode: 'manual',
        workflowSnapshot: parentWf
    });

    const result = await engine.run(exec.id, parentWf);
    console.log('Result:', JSON.stringify(result));

    // 4. Verify Results
    if (result && result.length > 0 && result[0].fromSub === true && result[0].received === 'hello') {
        console.log('✅ Subworkflow: Correctly returned output to parent');
    } else {
        console.error('❌ Subworkflow: Incorrect output');
        process.exit(1);
    }

    // 5. Verify Database Records
    const allExecs = await db.select().from(executions).all();
    const subExec = allExecs.find(e => e.workflowId === subWf.id);

    if (subExec) {
        console.log('✅ Subworkflow: Execution record found in database');
        const subSteps = await db.select().from(executionSteps).where(eq(executionSteps.executionId, subExec.id)).all();
        if (subSteps.length === 2) {
            console.log('✅ Subworkflow: All steps recorded');
        } else {
            console.error(`❌ Subworkflow: Expected 2 steps, got ${subSteps.length}`);
            process.exit(1);
        }
    } else {
        console.error('❌ Subworkflow: No execution record found');
        process.exit(1);
    }

    console.log('\n🎉 Phase 42 Verified!');
    process.exit(0);
}

verify().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
