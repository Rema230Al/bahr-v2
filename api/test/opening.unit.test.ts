import { describe, expect, test } from "bun:test";
import { acceptApplicant, canApply, OpeningClosedError, type Opening } from "../src/domain/opening";

const opening: Opening = {
  id: 1,
  title: "Design Intern",
  kind: "internship",
  location: "Jeddah",
  description: "Six months with the design team.",
  status: "open",
  acceptedApplicationId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  closedAt: null,
};

describe("opening lifecycle", () => {
  test("an open opening accepts applications", () => {
    expect(canApply(opening)).toBe(true);
  });

  test("accepting an applicant moves it from open to closed", () => {
    const at = new Date("2026-09-27T10:00:00.000Z");
    const closed = acceptApplicant(opening, 42, at);
    expect(closed.status).toBe("closed");
    expect(closed.acceptedApplicationId).toBe(42);
    expect(closed.closedAt).toBe(at.toISOString());
    expect(canApply(closed)).toBe(false);
  });

  test("does not mutate the original opening", () => {
    acceptApplicant(opening, 42);
    expect(opening.status).toBe("open");
  });

  test("a closed opening cannot accept a second applicant", () => {
    const closed = acceptApplicant(opening, 42);
    expect(() => acceptApplicant(closed, 43)).toThrow(OpeningClosedError);
  });
});
