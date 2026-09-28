/**
 * A lead's pipeline: New → Contacted → Proposal sent → Won / Lost. Admins may move a lead to any
 * stage (a lost deal can come back), but moving it to Lost needs a reason. Every change is
 * recorded as an activity so the timeline explains how the lead got where it is.
 */
export const STAGES = ["new", "contacted", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  proposal: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

export type LeadState = {
  stage: Stage;
  dealValue: number | null;
  ownerId: number | null;
  followUpOn: string | null;
  lostReason: string | null;
};

export type LeadPatch = Partial<Omit<LeadState, "lostReason">> & { lostReason?: string };
export type Activity = { kind: "stage" | "value" | "owner" | "follow_up"; body: string };

export class LeadValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Invalid lead change");
    this.name = "LeadValidationError";
  }
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export const isIsoDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

export const formatSar = (n: number) => `SAR ${n.toLocaleString("en-US")}`;

/** Applies a patch; returns the next state plus one activity per real change. Throws on invalid input. */
export function applyLeadPatch(current: LeadState, patch: LeadPatch, ownerEmail: string | null = null) {
  const next = { ...current };
  const activities: Activity[] = [];
  const reason = patch.lostReason?.trim();

  if (patch.stage !== undefined && patch.stage !== current.stage) {
    next.stage = patch.stage;
    if (patch.stage === "lost") {
      if (!reason || reason.length < 3) throw new LeadValidationError({ lostReason: "Say why the lead was lost (3+ characters)" });
      next.lostReason = reason;
    } else {
      if (reason) throw new LeadValidationError({ lostReason: "Only lost leads have a reason" });
      next.lostReason = null;
    }
    const why = patch.stage === "lost" ? ` — ${reason}` : "";
    activities.push({ kind: "stage", body: `Moved from ${STAGE_LABEL[current.stage]} to ${STAGE_LABEL[patch.stage]}${why}` });
  } else if (patch.lostReason !== undefined) {
    if (current.stage !== "lost") throw new LeadValidationError({ lostReason: "Only lost leads have a reason" });
    if (!reason || reason.length < 3) throw new LeadValidationError({ lostReason: "Say why the lead was lost (3+ characters)" });
    if (reason !== current.lostReason) {
      next.lostReason = reason;
      activities.push({ kind: "stage", body: `Lost reason updated — ${reason}` });
    }
  }

  if (patch.dealValue !== undefined && patch.dealValue !== current.dealValue) {
    next.dealValue = patch.dealValue;
    activities.push({ kind: "value", body: patch.dealValue === null ? "Deal value cleared" : `Deal value set to ${formatSar(patch.dealValue)}` });
  }

  if (patch.ownerId !== undefined && patch.ownerId !== current.ownerId) {
    next.ownerId = patch.ownerId;
    activities.push({ kind: "owner", body: patch.ownerId === null ? "Owner removed" : `Owner set to ${ownerEmail ?? `#${patch.ownerId}`}` });
  }

  if (patch.followUpOn !== undefined && patch.followUpOn !== current.followUpOn) {
    if (patch.followUpOn !== null && !isIsoDate(patch.followUpOn)) throw new LeadValidationError({ followUpOn: "Enter a valid date" });
    next.followUpOn = patch.followUpOn;
    activities.push({ kind: "follow_up", body: patch.followUpOn === null ? "Follow-up cleared" : `Follow-up set for ${patch.followUpOn}` });
  }

  return { next, activities };
}
