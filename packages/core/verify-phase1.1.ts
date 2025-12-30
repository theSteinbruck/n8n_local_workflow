/**
 * Phase 1.1 Verification: API Security
 */

const API_PORT = 3099; // Use different port for testing
const API_KEY = 'test-api-key-12345';

// Set required env vars before importing
process.env.API_KEY = API_KEY;
process.env.N8N_ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwxyz123456'; // exactly 32 bytes

async function verifyPhase1_1() {
    console.log('🧪 Phase 1.1 Verification: API Security\n');

    // Import after setting env
    const { startServer } = await import('../api/src/index');

    // Start test server
    const server = startServer(API_PORT);

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1500));

    const baseUrl = `http://localhost:${API_PORT}`;

    try {
        // Test 1: Health endpoint should be public
        console.log('Test 1: Health endpoint is public');
        const healthRes = await fetch(`${baseUrl}/health`);
        const healthData = await healthRes.json();
        if (healthRes.status === 200 && healthData.authEnabled === true) {
            console.log('✅ Health endpoint accessible without auth');
        } else {
            console.error('❌ Health endpoint failed');
            process.exit(1);
        }

        // Test 2: Protected route without API key returns 401
        console.log('\nTest 2: Protected route without API key');
        const noAuthRes = await fetch(`${baseUrl}/workflows`);
        if (noAuthRes.status === 401) {
            console.log('✅ Protected route returns 401 without auth');
        } else {
            console.error(`❌ Expected 401, got ${noAuthRes.status}`);
            process.exit(1);
        }

        // Test 3: Protected route with wrong API key returns 401
        console.log('\nTest 3: Protected route with wrong API key');
        const wrongKeyRes = await fetch(`${baseUrl}/workflows`, {
            headers: { 'Authorization': 'Bearer wrong-key' }
        });
        if (wrongKeyRes.status === 401) {
            console.log('✅ Wrong API key returns 401');
        } else {
            console.error(`❌ Expected 401, got ${wrongKeyRes.status}`);
            process.exit(1);
        }

        // Test 4: Protected route with correct API key succeeds
        console.log('\nTest 4: Protected route with correct API key');
        const authRes = await fetch(`${baseUrl}/workflows`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        if (authRes.status === 200) {
            console.log('✅ Correct API key allows access');
        } else {
            console.error(`❌ Expected 200, got ${authRes.status}`);
            process.exit(1);
        }

        // Test 5: Other protected routes
        console.log('\nTest 5: Other protected routes');
        const routes = ['/nodes', '/credentials', '/scheduler/jobs'];
        for (const route of routes) {
            const noAuth = await fetch(`${baseUrl}${route}`);
            if (noAuth.status !== 401) {
                console.error(`❌ ${route} should return 401 without auth`);
                process.exit(1);
            }
            const withAuth = await fetch(`${baseUrl}${route}`, {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });
            if (withAuth.status !== 200) {
                console.error(`❌ ${route} should return 200 with auth`);
                process.exit(1);
            }
        }
        console.log('✅ All protected routes require authentication');

        // Test 6: Invalid auth format
        console.log('\nTest 6: Invalid auth format');
        const badFormatRes = await fetch(`${baseUrl}/workflows`, {
            headers: { 'Authorization': API_KEY } // Missing 'Bearer '
        });
        if (badFormatRes.status === 401) {
            console.log('✅ Invalid format returns 401');
        } else {
            console.error(`❌ Expected 401, got ${badFormatRes.status}`);
            process.exit(1);
        }

        console.log('\n🎉 Phase 1.1 Verified! API Security is working.');

    } finally {
        server.close();
    }

    process.exit(0);
}

verifyPhase1_1().catch((error: any) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
});
