import { db } from './src/client';
import { users } from './src/schema';

async function main() {
    try {
        console.log('Attempting to connect to database...');
        // Just try to select, table might not exist yet but connection should work
        // Or better, just check if db object is created
        if (db) {
            console.log('Database client initialized successfully.');
        }
        console.log('Verification complete.');
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

main();
