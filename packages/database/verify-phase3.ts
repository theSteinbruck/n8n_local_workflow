import Database from 'better-sqlite3';

const db = new Database('sqlite.db', { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

console.log('Phase 3 Verification:');
console.log('Tables found:', tables.map((t: any) => t.name));

const expectedTables = ['workflows', 'executions', 'execution_steps', 'credentials'];
const foundTableNames = tables.map((t: any) => t.name);

const missing = expectedTables.filter(t => !foundTableNames.includes(t));

if (missing.length === 0) {
    console.log('✅ All expected tables created.');
} else {
    console.error('❌ Missing tables:', missing);
    process.exit(1);
}
