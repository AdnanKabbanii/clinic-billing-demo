import postgres from 'postgres';

const serviceUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/billing_test';
const appUrl = process.env.APP_DATABASE_URL ?? 'postgres://app_user:app_user@localhost:5432/billing_test';

export const appSql = postgres(appUrl, { max: 10, onnotice: () => {} });

export const serviceSql = postgres(serviceUrl, { max: 5, onnotice: () => {} });

export type Tx = postgres.TransactionSql;

export async function withTenant<T>(clinicId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return appSql.begin(async (tx) => {
    await tx`SELECT set_config('app.clinic_id', ${clinicId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
