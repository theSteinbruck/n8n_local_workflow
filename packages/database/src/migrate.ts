import { db } from './client';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

async function runMigrations() {
    console.log('⏳ Running migrations...');

    try {
        await migrate(db, {
            migrationsFolder: path.resolve(__dirname, '..', 'migrations'),
        });
        console.log('✅ Migrations completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runMigrations();
}

export { runMigrations };
