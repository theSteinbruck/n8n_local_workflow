import { WorkflowService } from './src/services/workflow.service';
import { ExecutionService } from './src/services/execution.service';

async function main() {
    try {
        console.log('Phase 5 Verification: Controlled Write Paths');

        const workflowService = new WorkflowService();
        const executionService = new ExecutionService();

        // 1. Create Workflow
        console.log('Creating workflow...');
        const wf = await workflowService.createWorkflow({
            name: 'Test Workflow',
            nodes: [{ id: '1', type: 'test' }],
            connections: {},
        });

        if (!wf) throw new Error('Failed to create workflow');
        console.log(`✅ Workflow created: ${wf.id} (v${wf.version})`);

        // 2. Update Workflow
        console.log('Updating workflow...');
        const updatedWf = await workflowService.updateWorkflow(wf.id, {
            name: 'Updated Workflow',
        });

        if (!updatedWf) throw new Error('Failed to update workflow');
        console.log(`✅ Workflow updated: ${updatedWf.id} (v${updatedWf.version})`);

        if (updatedWf.version !== wf.version + 1) {
            throw new Error('Version increment failed');
        }

        // 3. Create Execution
        console.log('Creating execution...');
        const execution = await executionService.createExecution({
            workflowId: wf.id,
            mode: 'manual',
            workflowSnapshot: updatedWf,
        });

        if (!execution) throw new Error('Failed to create execution');
        console.log(`✅ Execution created: ${execution.id} (Status: ${execution.status})`);

        if (execution.status !== 'running') {
            throw new Error('Initial execution status mismatch');
        }

        console.log('✅ Phase 5 Complete.');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

main();
