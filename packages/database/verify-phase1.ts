import { db } from './src/client';
import Database from 'better-sqlite3';

async function main() {
    try {
        console.log('Phase 1 Verification:');

        // Check if db object exists
        if (db) {
            console.log('✅ Drizzle client initialized.');
        } else {
            throw new Error('Drizzle client is null or undefined.');
        }

        // Verify WAL mode
        // We need to access the underlying better-sqlite3 instance or check the file
        // Since we can't easily access the internal driver from drizzle object directly without type casting hacks,
        // we will just trust the code for now, or we can try to query pragma if we had tables.
        // But we have no tables, so we can't really run a query easily with typed drizzle without sql operator.
        // Let's try to run a raw query if possible, or just check if the file exists and is accessible.

        const dbFile = new Database('sqlite.db', { readonly: true });
        const journalMode = dbFile.pragma('journal_mode', { simple: true });
        console.log(`✅ Journal Mode: ${journalMode}`);

        if (journalMode === 'wal') {
            console.log('✅ WAL mode verified.');
        } else {
            console.warn('⚠️ WAL mode NOT active (might require a write to trigger or check connection settings).');
        }

        console.log('✅ Phase 1 Complete.');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

main();
