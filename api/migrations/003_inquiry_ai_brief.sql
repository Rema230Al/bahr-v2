-- 003 · The "Help me shape my idea" assistant's project brief, as edited and sent by the client.
-- Nullable: the assistant is optional. Plain text, capped at 2000 characters by the API.

ALTER TABLE inquiries ADD COLUMN ai_brief text;

-- Expose it to the board / side panel (new view columns may only be appended at the end).
CREATE OR REPLACE VIEW lead_cards AS
  SELECT l.id, l.inquiry_id, l.stage, l.deal_value, l.owner_id, a.email AS owner_email,
         l.follow_up_on::text AS follow_up_on, l.lost_reason, l.created_at, l.updated_at,
         i.name, i.email, i.company, i.service, i.budget, i.message, i.ai_brief
  FROM leads l
  JOIN inquiries i ON i.id = l.inquiry_id
  LEFT JOIN admins a ON a.id = l.owner_id;
