/**
 * An opening's lifecycle: it starts `open`, and closes exactly once — when an admin
 * accepts a single applicant. A closed opening never reopens and takes no applications.
 */
export type OpeningStatus = "open" | "closed";
export type OpeningKind = "job" | "internship";

export type Opening = {
  id: number;
  title: string;
  kind: OpeningKind;
  location: string;
  description: string;
  status: OpeningStatus;
  acceptedApplicationId: number | null;
  createdAt: string;
  closedAt: string | null;
};

export class OpeningClosedError extends Error {
  constructor() {
    super("This opening is closed");
    this.name = "OpeningClosedError";
  }
}

export const canApply = (o: Pick<Opening, "status">) => o.status === "open";

/** open → closed, recording the one accepted application. Throws if it was already closed. */
export function acceptApplicant(o: Opening, applicationId: number, at = new Date()): Opening {
  if (o.status !== "open") throw new OpeningClosedError();
  return { ...o, status: "closed", acceptedApplicationId: applicationId, closedAt: at.toISOString() };
}
