import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = /* sql */ `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  company    TEXT,
  service    TEXT NOT NULL,
  budget     TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS openings (
  id                      INTEGER PRIMARY KEY,
  title                   TEXT NOT NULL,
  kind                    TEXT NOT NULL CHECK (kind IN ('job','internship')),
  location                TEXT NOT NULL,
  description             TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  accepted_application_id INTEGER,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at               TEXT
);

CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY,
  opening_id INTEGER NOT NULL REFERENCES openings(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  portfolio  TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','not_selected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (opening_id, email)
);

-- The database itself guarantees at most one accepted applicant per opening.
CREATE UNIQUE INDEX IF NOT EXISTS one_accepted_per_opening
  ON applications(opening_id) WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS applications_by_opening ON applications(opening_id);
CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions(expires_at);
`;

export function openDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

export type Db = Database;
