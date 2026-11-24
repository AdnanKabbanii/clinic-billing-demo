import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serviceSql } from './db.js';

export async function migrate(): Promise<void> {
  await serviceSql.unsafe(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOBYPASSRLS;
      END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO app_user;
  `);
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const file of readdirSync(dir).sort()) {
    await serviceSql.unsafe(readFileSync(join(dir, file), 'utf-8'));
  }
  await serviceSql.unsafe(`
    GRANT SELECT ON clinics, users TO app_user;
    GRANT SELECT, INSERT, UPDATE ON orders, refunds TO app_user;
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => process.exit(0));
}
