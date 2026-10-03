/** The dashboard's views and the filters each one uses. The Dashboard owns the values, so they survive switching views. */
export type View = "leads" | "inquiries" | "openings";
export type Control = "stage" | "service" | "owner";

export type Filters = { q: string; stage: string; service: string; owner: string };
export const NO_FILTERS: Filters = { q: "", stage: "all", service: "all", owner: "all" };

export const VIEWS: Record<View, { title: string; subtitle: string; search: string; controls: Control[]; dateLabel: string }> = {
  leads: {
    title: "Leads",
    subtitle: "Every “Let's talk” inquiry, moving through the pipeline.",
    search: "Search name, company, email",
    controls: ["stage", "service", "owner"],
    dateLabel: "Created",
  },
  inquiries: {
    title: "Inquiries",
    subtitle: "Project requests sent from the site.",
    search: "Search name, company, message",
    controls: ["service"],
    dateLabel: "Created",
  },
  openings: {
    title: "Openings",
    subtitle: "Post roles and choose one applicant to fill each.",
    search: "Search openings",
    controls: [],
    dateLabel: "Applied",
  },
};

/** Case-insensitive "contains" across a record's text fields. */
export const matches = (needle: string, ...values: (string | null | undefined)[]) => {
  const n = needle.trim().toLowerCase();
  return !n || values.some((v) => v?.toLowerCase().includes(n));
};
