-- 001 · Initial schema for Bahr (PostgreSQL)

CREATE TABLE admins (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Only an HMAC of each session token is stored (keyed with SESSION_SECRET).
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  admin_id   integer NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_by_expiry ON sessions (expires_at);

CREATE TABLE inquiries (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL,
  company    text,
  service    text NOT NULL CHECK (service IN ('web', 'ai', 'mobile', 'other')),
  budget     text NOT NULL CHECK (budget IN ('under-50k', '50k-150k', '150k-500k', '500k-plus', 'not-sure')),
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE openings (
  id                      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title                   text NOT NULL,
  kind                    text NOT NULL CHECK (kind IN ('job', 'internship')),
  location                text NOT NULL,
  description             text NOT NULL,
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  accepted_application_id integer,
  created_at              timestamptz NOT NULL DEFAULT now(),
  closed_at               timestamptz
);

CREATE TABLE applications (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opening_id integer NOT NULL REFERENCES openings(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL,
  portfolio  text NOT NULL,
  message    text NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'not_selected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- the same email can't apply twice to the same opening (emails are stored lower-cased)
  UNIQUE (opening_id, email)
);
CREATE INDEX applications_by_opening ON applications (opening_id);

-- The database itself guarantees at most one accepted applicant per opening.
CREATE UNIQUE INDEX one_accepted_per_opening ON applications (opening_id) WHERE status = 'accepted';

ALTER TABLE openings
  ADD CONSTRAINT openings_accepted_application_fk
  FOREIGN KEY (accepted_application_id) REFERENCES applications(id) ON DELETE SET NULL;
