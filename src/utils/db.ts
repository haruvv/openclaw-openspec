import type Database from "better-sqlite3";
import { getSqliteDb, resetSqliteDb } from "../storage/sqlite.js";

export async function getDb(): Promise<Database.Database> {
  return getSqliteDb();
}

export function resetDb(): void {
  resetSqliteDb();
}
