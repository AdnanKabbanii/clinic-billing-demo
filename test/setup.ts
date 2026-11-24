import { serviceSql } from '../src/db.js';

export async function seed() {
  const [a] = await serviceSql<{ id: string }[]>`INSERT INTO clinics (name) VALUES ('Clinic A') RETURNING id`;
  const [b] = await serviceSql<{ id: string }[]>`INSERT INTO clinics (name) VALUES ('Clinic B') RETURNING id`;
  const [adminA] = await serviceSql<{ id: string }[]>`INSERT INTO users (clinic_id, role) VALUES (${a!.id}, 'admin') RETURNING id`;
  const [staffA] = await serviceSql<{ id: string }[]>`INSERT INTO users (clinic_id, role) VALUES (${a!.id}, 'staff') RETURNING id`;
  const [adminB] = await serviceSql<{ id: string }[]>`INSERT INTO users (clinic_id, role) VALUES (${b!.id}, 'admin') RETURNING id`;
  const [orderA] = await serviceSql<{ id: string }[]>`INSERT INTO orders (clinic_id, amount_cents) VALUES (${a!.id}, 10000) RETURNING id`;
  return { clinicA: a!.id, clinicB: b!.id, adminA: adminA!.id, staffA: staffA!.id, adminB: adminB!.id, orderA: orderA!.id };
}
