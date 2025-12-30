import { startServer } from './src/index';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { io as Client } from 'socket.io-client';
import { db, executions, eq } from '@local-n8n/database';

async function verify() {
    console.log('Phase 17 Verification: Execution Replay');

    const PORT = 3008;
    const server = startServer(PORT);
    const workflowService = new WorkflowService();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // 1. Create Workflow
        const wf = await workflowService.createWorkflow({
            name: 'Replay Workflow',
            nodes: [
                { id: 'set1', type: 'core.set', parameters: { values: { a: 1 } } },
                { id: 'set2', type: 'core.set', parameters: { values: { b: 2 } } }
            ],
            connections: {}
        });

        // 2. Run Execution (Wait for completion)
        console.log('Running execution...');
        const res = await fetch(`http://localhost:${PORT}/executions/${wf.id}`, { method: 'POST' });
        const data = await res.json();
        const executionId = data.executionId;

        // Poll for completion
        let attempts = 0;
        while (attempts < 10) {
            await new Promise(r => setTimeout(r, 500));
            const exec = await db.select().from(executions).where(eq(executions.id, executionId)).get();
            if (exec?.status === 'success') break;
            attempts++;
        }
        console.log('Execution completed.');

        // 3. Connect WebSocket and Subscribe
        console.log('Connecting and subscribing...');
        const socket = Client(`http://localhost:${PORT}/executions`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for replay')), 5000);

            socket.on('connect', () => {
                socket.emit('subscribe', { executionId });
            });

            socket.on('execution:replay', (data) => {
                console.log('Received replay event');

                if (data.execution.id !== executionId) reject(new Error('Wrong execution ID'));
                if (data.execution.status !== 'success') reject(new Error('Wrong status'));
                if (data.steps.length !== 2) reject(new Error(`Wrong step count: ${data.steps.length}`));

                console.log(`✅ Replay verified: ${data.steps.length} steps`);
                clearTimeout(timeout);
                resolve();
            });

            socket.on('connect_error', (err) => reject(err));
        });

        console.log('✅ Phase 17 Complete.');
        socket.disconnect();

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        server.close();
    }
}

verify();
