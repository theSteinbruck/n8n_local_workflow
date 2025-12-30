import { startServer } from './src/index';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import { io as Client } from 'socket.io-client';

async function verify() {
    console.log('Phase 15 Verification: WebSocket Event Emission');

    const PORT = 3006;
    const server = startServer(PORT);
    const workflowService = new WorkflowService();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // 1. Create Workflow
        const wf = await workflowService.createWorkflow({
            name: 'WS Event Workflow',
            nodes: [{ id: 'set1', type: 'core.set' }],
            connections: {}
        });

        // 2. Connect WebSocket
        console.log('Connecting to WebSocket...');
        const socket = Client(`http://localhost:${PORT}/executions`);

        const events: any[] = [];

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for events')), 5000);

            socket.on('connect', async () => {
                console.log('✅ Connected');

                // 3. Trigger Execution
                console.log('Triggering execution...');
                await fetch(`http://localhost:${PORT}/executions/${wf.id}`, { method: 'POST' });
            });

            socket.on('execution:event', (data) => {
                console.log('Received event:', data.type);
                events.push(data);

                // Check if we have all expected events
                const hasStart = events.some(e => e.type === 'node:start');
                const hasFinish = events.some(e => e.type === 'node:finish');
                const hasExecFinish = events.some(e => e.type === 'execution:finish');

                if (hasStart && hasFinish && hasExecFinish) {
                    clearTimeout(timeout);
                    resolve();
                }
            });

            socket.on('connect_error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        // Verify Payload Structure
        const startEvent = events.find(e => e.type === 'node:start');
        if (!startEvent.executionId) throw new Error('Missing executionId');
        if (!startEvent.timestamp) throw new Error('Missing timestamp');
        if (startEvent.nodeType !== 'core.set') throw new Error('Wrong nodeType');

        console.log('✅ All events received with correct payload');
        console.log('✅ Phase 15 Complete.');

        socket.disconnect();

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        server.close();
    }
}

verify();
