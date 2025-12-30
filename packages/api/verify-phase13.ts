import { startServer } from './src/index';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { db, executions, eq } from '@local-n8n/database';
import http from 'http';

async function verify() {
    console.log('Phase 13 Verification: API Event Logging');

    const PORT = 3004;
    const server = startServer(PORT);
    const workflowService = new WorkflowService();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Spy on console.log
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
    };

    try {
        // 1. Create Success Workflow
        const successWf = await workflowService.createWorkflow({
            name: 'Logging Success',
            nodes: [{ id: 'set1', type: 'core.set' }],
            connections: {}
        });

        // 2. Trigger Success Execution
        console.log('\n--- Triggering Success Execution ---');
        const res1 = await fetch(`http://localhost:${PORT}/executions/${successWf.id}`, { method: 'POST' });
        const data1 = await res1.json();

        // Wait for completion
        await new Promise(r => setTimeout(r, 1000));

        // Verify Logs
        const exec1Logs = logs.filter(l => l.includes(`[execution:${data1.executionId}]`));
        if (!exec1Logs.some(l => l.includes('node:start core.set'))) throw new Error('Missing node:start log');
        if (!exec1Logs.some(l => l.includes('node:finish core.set'))) throw new Error('Missing node:finish log');
        if (!exec1Logs.some(l => l.includes('execution:finish success'))) throw new Error('Missing execution:finish success log');
        console.log('✅ Success logs verified');


        // 3. Create Failure Workflow
        const failWf = await workflowService.createWorkflow({
            name: 'Logging Failure',
            nodes: [{ id: 'fail1', type: 'core.fail' }],
            connections: {}
        });

        // 4. Trigger Failure Execution
        console.log('\n--- Triggering Failure Execution ---');
        const res2 = await fetch(`http://localhost:${PORT}/executions/${failWf.id}`, { method: 'POST' });
        const data2 = await res2.json();

        // Wait for completion
        await new Promise(r => setTimeout(r, 1000));

        // Verify Logs
        const exec2Logs = logs.filter(l => l.includes(`[execution:${data2.executionId}]`));
        if (!exec2Logs.some(l => l.includes('node:start core.fail'))) throw new Error('Missing node:start log');
        if (!exec2Logs.some(l => l.includes('node:error core.fail Simulated Failure'))) throw new Error('Missing node:error log');
        if (!exec2Logs.some(l => l.includes('execution:finish error'))) throw new Error('Missing execution:finish error log');
        console.log('✅ Failure logs verified');

        console.log('✅ Phase 13 Complete.');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        console.log = originalLog;
        server.close();
    }
}

verify();
