import { startServer } from './src/index';
import http from 'http';

async function verify() {
    console.log('Phase 10 Verification: API Package');

    const PORT = 3001;
    const server = startServer(PORT);

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // Check Health
        const response = await fetch(`http://localhost:${PORT}/health`);
        const data = await response.json();

        if (response.status !== 200) throw new Error(`Status mismatch: ${response.status}`);
        if (data.status !== 'ok') throw new Error(`Body mismatch: ${JSON.stringify(data)}`);

        console.log('✅ API Health Check Passed');
        console.log('✅ Phase 10 Complete.');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        server.close();
    }
}

verify();
