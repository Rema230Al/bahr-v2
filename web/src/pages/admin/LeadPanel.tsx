import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError, STAGES, type Lead, type LeadDetail, type LeadPatch, type Stage } from "../../lib/api";
import { SelectField, TextArea, TextField } from "../../components/ui/Field";
import { budgetLabel, dateTime, isOverdue, longDate, ownerName } from "./format";
import { Avatar, Button, ServiceTag } from "./ui";

export type Admin = { id: number; email: string };

const EASE = [0.16, 1, 0.3, 1] as const;

/** Side panel for one lead: its properties, the client's message and brief, notes and the activity timeline. */
export default function LeadPanel({
  id,
  askLost,
  admins,
  onChange,
  onClose,
}: {
  id: number;
  askLost: boolean;
  admins: Admin[];
  onChange: (l: Lead) => void;
  onClose: () => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.lead(id).then(
      (l) => {
        setLead(l);
        setValue(l.dealValue === null ? "" : String(l.dealValue));
        setReason(l.lostReason ?? "");
      },
      () => setMsg("Couldn't load this lead."),
    );
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (patch: LeadPatch, done = "Saved.") => {
    setErrors({});
    setMsg("");
    try {
      const l = await api.updateLead(id, patch);
      setLead(l);
      onChange(l);
      setMsg(done);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation") setErrors(err.fields);
      else setMsg("Couldn't save. Please try again.");
      return false;
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return setErrors({ body: "Write a note first" });
    try {
      const l = await api.addLeadNote(id, note.trim());
      setLead(l);
      onChange(l);
      setNote("");
      setErrors({});
    } catch {
      setMsg("Couldn't add the note.");
    }
  };

  const showLost = lead && (askLost || lead.stage === "lost");
  const overdue = lead && isOverdue(lead);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[55] bg-[#0c2240]/25"
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-labelledby="lead-title"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="fixed inset-y-0 end-0 z-[56] flex w-full max-w-lg flex-col border-s border-line bg-[var(--card)] shadow-[-24px_0_48px_-24px_rgb(12_34_64/0.35)]"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4 md:px-6">
          {lead && <Avatar name={lead.name} size="lg" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted">Lead #{id}</p>
            {lead && (
              <>
                <h2 id="lead-title" className="truncate text-lg font-semibold tracking-tight">
                  {lead.name}
                </h2>
                <p className="truncate text-sm">
                  <a className="text-accent hover:underline" href={`mailto:${lead.email}`}>
                    {lead.email}
                  </a>
                  {lead.company && <span className="text-muted"> · {lead.company}</span>}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="grid h-8 w-8 flex-none place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
              <path d="m2 2 8 8M10 2 2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
          {!lead ? (
            <p className="text-sm text-muted">{msg || "Loading…"}</p>
          ) : (
            <div className="grid gap-6">
              {msg && (
                <p role="status" className="text-sm text-accent">
                  {msg}
                </p>
              )}

              {showLost && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    save({ stage: "lost", lostReason: reason.trim() }, "Marked as lost.");
                  }}
                  className="grid gap-3 rounded-lg border border-signal/50 bg-signal/[0.04] p-4"
                >
                  <TextArea
                    label="Why was it lost?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    error={errors.lostReason}
                    maxLength={500}
                    className="field min-h-20"
                  />
                  <div>
                    <Button type="submit" variant="primary">
                      {lead.stage === "lost" ? "Update reason" : "Mark as lost"}
                    </Button>
                  </div>
                </form>
              )}

              <section aria-label="Details" className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Stage"
                  value={lead.stage}
                  onChange={(e) =>
                    e.target.value === "lost" ? !showLost && setMsg("Give a reason above to mark it lost.") : save({ stage: e.target.value as Stage })
                  }
                  options={[...STAGES]}
                />
                <SelectField
                  label="Owner"
                  value={lead.ownerId === null ? "" : String(lead.ownerId)}
                  onChange={(e) => save({ ownerId: e.target.value ? Number(e.target.value) : null })}
                  options={[["", "Unassigned"], ...admins.map((a): [string, string] => [String(a.id), a.email])]}
                  error={errors.ownerId}
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    save({ dealValue: value.trim() === "" ? null : Number(value) });
                  }}
                  className="grid gap-2"
                >
                  <TextField
                    label="Deal value (SAR)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    error={errors.dealValue}
                  />
                  <button type="submit" className="justify-self-start text-sm font-medium text-accent hover:underline">
                    Save value
                  </button>
                </form>
                <TextField
                  label="Follow-up"
                  type="date"
                  value={lead.followUpOn ?? ""}
                  onChange={(e) => save({ followUpOn: e.target.value || null })}
                  error={errors.followUpOn}
                  hint={overdue ? <p className="text-sm font-medium text-signal">Overdue</p> : undefined}
                  className={`field ${overdue ? "!border-signal" : ""}`}
                />
              </section>

              <section aria-labelledby="message-title" className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="message-title" className="text-sm font-semibold">
                    Message
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <ServiceTag service={lead.service} />
                    <span className="tag tag-other">{budgetLabel(lead.budget)}</span>
                    <span>{longDate(lead.createdAt)}</span>
                  </div>
                </div>
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{lead.message}</p>
                {lead.aiBrief && (
                  <div className="rounded-lg bg-[var(--sunken)] p-4" data-testid="ai-brief">
                    <p className="text-xs font-medium text-muted">AI brief · edited by client</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{lead.aiBrief}</p>
                  </div>
                )}
              </section>

              <form onSubmit={addNote} className="grid gap-3">
                <TextArea label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} error={errors.body} maxLength={2000} className="field min-h-20" />
                <div>
                  <Button type="submit">Add note</Button>
                </div>
              </form>

              <section aria-labelledby="timeline-title">
                <h3 id="timeline-title" className="mb-3 text-sm font-semibold">
                  Activity
                </h3>
                <ol className="grid gap-4">
                  {lead.activities.map((a) => (
                    <li key={a.id} className="relative ps-5 before:absolute before:start-[3px] before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent/60">
                      <p className={`text-sm ${a.kind === "note" ? "whitespace-pre-line rounded-md bg-[var(--sunken)] px-3 py-2" : ""}`}>{a.body}</p>
                      <p className="mt-1 text-xs text-muted">
                        {dateTime(a.at)}
                        {a.by && ` · ${ownerName(a.by)}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
