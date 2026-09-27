/**
 * Creates the admin or replaces its password, and signs out its existing sessions.
 * Reads DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD from the environment — never from arguments,
 * so the password doesn't end up in shell history.
 *
 *   fly ssh console -C "bun scripts/set-admin.ts"      (on the server, using its secrets)
 */
import { connect } from "../src/db";
import { createAdmins } from "../src/security/admins";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required");
if (ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

const sql = connect(DATABASE_URL, 1);
await createAdmins(sql).upsert(ADMIN_EMAIL, ADMIN_PASSWORD);
await sql.close();
console.log(`Admin ${ADMIN_EMAIL.toLowerCase()} is set; their old sessions were signed out.`);
