import axios from 'axios';

const API_URL = 'http://localhost:3000';
const API_KEY = 'test_secret_key';

async function verifyPhase1_1() {
    console.log('🧪 Phase 1.1 Verification: API Protection\n');

    const testEndpoints = [
        { method: 'GET', url: '/workflows' },
        { method: 'POST', url: '/workflows', data: { name: 'Test' } },
        { method: 'GET', url: '/credentials' },
        { method: 'GET', url: '/nodes' },
        { method: 'POST', url: '/executions/canvas', data: { workflow: { nodes: [] } } },
    ];

    console.log('--- Testing Unauthorized Access (No Key) ---');
    for (const endpoint of testEndpoints) {
        try {
            await axios({
                method: endpoint.method,
                url: `${API_URL}${endpoint.url}`,
                data: endpoint.data
            });
            console.error(`❌ ${endpoint.method} ${endpoint.url} allowed access without API Key!`);
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.log(`✅ ${endpoint.method} ${endpoint.url} correctly returned 401`);
            } else {
                console.error(`❌ ${endpoint.method} ${endpoint.url} returned unexpected error: ${error.message}`);
                if (error.code) console.error(`   Error Code: ${error.code}`);
                if (error.response) console.error(`   Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
            }
        }
    }

    console.log('\n--- Testing Health Endpoint (Should be Public) ---');
    try {
        const res = await axios.get(`${API_URL}/health`);
        if (res.status === 200) {
            console.log('✅ /health is public');
        }
    } catch (error: any) {
        console.error(`❌ /health failed: ${error.message}`);
    }

    console.log('\n--- Testing Authorized Access (With Correct Key) ---');
    for (const endpoint of testEndpoints) {
        try {
            const res = await axios({
                method: endpoint.method,
                url: `${API_URL}${endpoint.url}`,
                headers: { 'Authorization': `Bearer ${API_KEY}` },
                data: endpoint.data
            });
            console.log(`✅ ${endpoint.method} ${endpoint.url} allowed access with API Key (Status: ${res.status})`);
        } catch (error: any) {
            console.error(`❌ ${endpoint.method} ${endpoint.url} failed with correct API Key: ${error.message} (Status: ${error.response?.status})`);
        }
    }

    console.log('\nPhase 1.1 Verification Complete.');
}

// Note: This script assumes the server is running with API_KEY=test_secret_key
verifyPhase1_1().catch(console.error);
