-- 002 · Leads CRM: every "Let's talk" inquiry is a lead moving through a sales pipeline.

CREATE TABLE leads (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inquiry_id   integer NOT NULL UNIQUE REFERENCES inquiries(id) ON DELETE CASCADE,
  stage        text NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'proposal', 'won', 'lost')),
  deal_value   integer CHECK (deal_value BETWEEN 0 AND 1000000000), -- whole SAR
  owner_id     integer REFERENCES admins(id) ON DELETE SET NULL,
  follow_up_on date,
  lost_reason  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- a lost lead always says why; any other stage has no reason
  CHECK ((stage = 'lost') = (lost_reason IS NOT NULL))
);

CREATE TABLE lead_activities (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id    integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  admin_id   integer REFERENCES admins(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('created', 'stage', 'value', 'owner', 'follow_up', 'note')),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_activities_by_lead ON lead_activities (lead_id, id);

-- Convert the inquiries that already exist.
INSERT INTO leads (inquiry_id, created_at, updated_at) SELECT id, created_at, created_at FROM inquiries ORDER BY id;
INSERT INTO lead_activities (lead_id, kind, body, created_at)
  SELECT id, 'created', 'Inquiry received via Let''s talk', created_at FROM leads;

-- What the board and side panel read: the lead plus its inquiry and owner.
CREATE VIEW lead_cards AS
  SELECT l.id, l.inquiry_id, l.stage, l.deal_value, l.owner_id, a.email AS owner_email,
         l.follow_up_on::text AS follow_up_on, l.lost_reason, l.created_at, l.updated_at,
         i.name, i.email, i.company, i.service, i.budget, i.message
  FROM leads l
  JOIN inquiries i ON i.id = l.inquiry_id
  LEFT JOIN admins a ON a.id = l.owner_id;
