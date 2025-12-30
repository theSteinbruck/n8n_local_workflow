import { startServer } from './src/index';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { db, executions, eq } from '@local-n8n/database';
import http from 'http';

async function verify() {
    console.log('Phase 12 Verification: API Execution Endpoints');

    const PORT = 3003;
    const server = startServer(PORT);
    const workflowService = new WorkflowService();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // 1. Create a test workflow
        const wf = await workflowService.createWorkflow({
            name: 'Async Exec Workflow',
            nodes: [
                { id: 'set1', type: 'core.set', parameters: { values: { foo: 'bar' } } },
                { id: 'noop1', type: 'core.noop' }
            ],
            connections: {}
        });
        console.log(`Created workflow: ${wf.id}`);

        // 2. Trigger Execution via API
        console.log('Triggering execution...');
        const res = await fetch(`http://localhost:${PORT}/executions/${wf.id}`, {
            method: 'POST'
        });
        const data = await res.json();

        if (res.status !== 200) throw new Error(`Status mismatch: ${res.status} - ${JSON.stringify(data)}`);
        if (!data.executionId) throw new Error('No executionId returned');
        if (data.status !== 'started') throw new Error('Status not started');

        console.log(`✅ Execution started: ${data.executionId}`);

        // 3. Wait for Async Execution to Complete
        console.log('Waiting for execution to complete...');
        let attempts = 0;
        while (attempts < 10) {
            await new Promise(r => setTimeout(r, 500));
            const exec = await db.select().from(executions).where(eq(executions.id, data.executionId)).get();

            if (exec && exec.status === 'success') {
                console.log('✅ Execution completed successfully');
                break;
            }
            if (exec && exec.status === 'error') {
                throw new Error('Execution failed');
            }
            attempts++;
        }

        if (attempts >= 10) throw new Error('Execution timed out');

        console.log('✅ Phase 12 Complete.');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        server.close();
    }
}

verify();
