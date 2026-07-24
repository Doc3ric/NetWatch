import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { setupSchema } from './schema.js';

export function initDb(dbPath: string): Database.Database {
  // Ensure the directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency and performance
  db.pragma('journal_mode = WAL');

  // Set up the schema if tables don't exist
  setupSchema(db);

  return db;
}
