import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Resolve database path relative to this file (dist/client.js or src/client.ts)
// If running from src (tsx), we are in src/. DB is in ../sqlite.db
// If running from dist (node), we are in dist/. DB is in ../sqlite.db
const dbPath = path.resolve(__dirname, '..', 'sqlite.db');

const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
