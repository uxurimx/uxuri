/**
 * Mueve todas las transacciones de una cuenta a otra.
 * Uso: npx tsx scripts/move-transactions.ts <fromAccountId> <toAccountId>
 *
 * También actualiza toAccountId cuando la cuenta de origen era destino de una transferencia.
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const [, , fromId, toId] = process.argv;

if (!fromId || !toId) {
  console.error("Uso: npx tsx scripts/move-transactions.ts <fromAccountId> <toAccountId>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Verify both accounts exist
  const accounts = await sql`SELECT id, name FROM accounts WHERE id IN (${fromId}, ${toId})`;
  const from = accounts.find((a) => a.id === fromId);
  const to   = accounts.find((a) => a.id === toId);

  if (!from) { console.error(`❌ Cuenta origen no encontrada: ${fromId}`); process.exit(1); }
  if (!to)   { console.error(`❌ Cuenta destino no encontrada: ${toId}\n\nCuentas disponibles:`);
    const all = await sql`SELECT id, name, type FROM accounts ORDER BY name`;
    for (const a of all) console.log(`  ${a.name} (${a.type}) — ${a.id}`);
    process.exit(1);
  }

  console.log(`\nMoviendo transacciones:`);
  console.log(`  De:   ${from.name} (${fromId})`);
  console.log(`  Hacia: ${to.name}   (${toId})\n`);

  // Count first
  const [{ count: asOrigin }] = await sql`
    SELECT COUNT(*) as count FROM transactions WHERE account_id = ${fromId}
  `;
  const [{ count: asDest }] = await sql`
    SELECT COUNT(*) as count FROM transactions WHERE to_account_id = ${fromId}
  `;
  console.log(`  ${asOrigin} transacciones como origen`);
  console.log(`  ${asDest} transacciones como destino`);

  if (Number(asOrigin) + Number(asDest) === 0) {
    console.log("\n✓ No hay transacciones que mover.");
    return;
  }

  // Move
  await sql`UPDATE transactions SET account_id = ${toId},    updated_at = now() WHERE account_id    = ${fromId}`;
  await sql`UPDATE transactions SET to_account_id = ${toId}, updated_at = now() WHERE to_account_id = ${fromId}`;

  console.log(`\n✓ Listo. ${Number(asOrigin) + Number(asDest)} transacciones movidas a "${to.name}".`);
  console.log(`\nYa puedes eliminar la cuenta "${from.name}" desde Finanzas → Cuentas.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
