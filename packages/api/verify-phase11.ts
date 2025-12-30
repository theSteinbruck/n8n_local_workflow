import { startServer } from './src/index';
import { WorkflowService } from '@local-n8n/core/src/services/workflow.service';
import http from 'http';

async function verify() {
    console.log('Phase 11 Verification: API Workflow Endpoints');

    const PORT = 3002;
    const server = startServer(PORT);
    const workflowService = new WorkflowService();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // 1. Create a test workflow directly via service
        const wf = await workflowService.createWorkflow({
            name: 'API Test Workflow',
            nodes: [],
            connections: {}
        });
        console.log(`Created test workflow: ${wf.id}`);

        // 2. Test GET /workflows
        console.log('Testing GET /workflows...');
        const listRes = await fetch(`http://localhost:${PORT}/workflows`);
        const listData = await listRes.json();

        if (!Array.isArray(listData)) throw new Error('GET /workflows did not return an array');
        const found = listData.find((w: any) => w.id === wf.id);
        if (!found) throw new Error('Created workflow not found in list');
        console.log('✅ GET /workflows passed');

        // 3. Test GET /workflows/:id
        console.log(`Testing GET /workflows/${wf.id}...`);
        const getRes = await fetch(`http://localhost:${PORT}/workflows/${wf.id}`);
        const getData = await getRes.json();

        if (getData.id !== wf.id) throw new Error('GET /workflows/:id returned wrong ID');
        console.log('✅ GET /workflows/:id passed');

        // 4. Test 404
        console.log('Testing 404...');
        const notFoundRes = await fetch(`http://localhost:${PORT}/workflows/non-existent-id`);
        if (notFoundRes.status !== 404) throw new Error('Expected 404 for non-existent workflow');
        console.log('✅ 404 passed');

        console.log('✅ Phase 11 Complete.');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        server.close();
    }
}

verify();
