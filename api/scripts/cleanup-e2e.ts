/**
 * Removes the records created by the E2E tests when they run against the live site.
 * Every E2E record carries a unique "e2e-" marker, so only test data matches:
 *   openings  "Motion Designer e2e-…"  (their applications are deleted with them)
 *   inquiries  company "Depth Co e2e-…"
 *
 *   fly ssh console -C "bun scripts/cleanup-e2e.ts"
 */
import { connect } from "../src/db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const sql = connect(url, 1);
const openings = await sql`DELETE FROM openings WHERE title LIKE 'Motion Designer e2e-%' RETURNING id`;
const inquiries = await sql`DELETE FROM inquiries WHERE company LIKE 'Depth Co e2e-%' RETURNING id`;
await sql.close();
console.log(`Removed ${openings.length} test opening(s) (with their applications) and ${inquiries.length} test inquiry(ies).`);
