import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError, STAGES, type Lead, type LeadDetail, type LeadPatch, type Stage } from "../lib/api";
import { SelectField, TextArea, TextField } from "../components/ui/Field";
import MagneticButton from "../components/ui/Magnetic";

/**
 * Leads CRM: every "Let's talk" inquiry is a lead. Drag cards between stages, or use each card's
 * stage select (keyboard). Moving to Lost opens the side panel to ask for a reason first.
 * Calm by design: only small Framer Motion fades/slides, no scroll effects.
 */
const EASE = [0.16, 1, 0.3, 1] as const;
const SERVICES: [string, string][] = [
  ["web", "Web"],
  ["ai", "AI"],
  ["mobile", "Mobile"],
  ["other", "Other"],
];
const serviceLabel = (s: string) => SERVICES.find(([v]) => v === s)?.[1] ?? s;
const sar = (n: number) => `SAR ${n.toLocaleString("en-US")}`;
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const isOverdue = (l: Lead) => !!l.followUpOn && l.followUpOn < today() && l.stage !== "won" && l.stage !== "lost";
const ownerName = (email: string | null) => (email ? email.split("@")[0] : "Unassigned");

type Admin = { id: number; email: string };

export default function Leads() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [open, setOpen] = useState<{ id: number; askLost: boolean } | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [service, setService] = useState("all");
  const [owner, setOwner] = useState("all");

  useEffect(() => {
    api.leads().then(setLeads, () => setLeads([]));
    api.admins().then(setAdmins, () => undefined);
  }, []);

  const replace = (l: Lead) => setLeads((all) => all?.map((x) => (x.id === l.id ? l : x)) ?? null);

  const move = async (lead: Lead, to: Stage) => {
    if (to === lead.stage) return;
    if (to === "lost") return setOpen({ id: lead.id, askLost: true }); // a reason comes first
    setError("");
    replace({ ...lead, stage: to }); // optimistic; reverted below if the server refuses
    try {
      replace(await api.updateLead(lead.id, { stage: to }));
    } catch {
      replace(lead);
      setError(`Couldn't move ${lead.name}. Please try again.`);
    }
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (leads ?? []).filter(
      (l) =>
        (stage === "all" || l.stage === stage) &&
        (service === "all" || l.service === service) &&
        (owner === "all" || (owner === "none" ? l.ownerId === null : String(l.ownerId) === owner)) &&
        (!needle || [l.name, l.company, l.email].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [leads, q, stage, service, owner]);

  if (!leads) return <p className="label">Loading…</p>;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Search" type="search" placeholder="Name, company, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} options={[["all", "All stages"], ...STAGES]} />
        <SelectField label="Service" value={service} onChange={(e) => setService(e.target.value)} options={[["all", "All services"], ...SERVICES]} />
        <SelectField
          label="Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          options={[["all", "All owners"], ["none", "Unassigned"], ...admins.map((a): [string, string] => [String(a.id), a.email])]}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-signal">
          {error}
        </p>
      )}

      <div className="mt-8 grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4" data-lenis-prevent>
        {STAGES.map(([key, label]) => (
          <Column key={key} stage={key} label={label} leads={visible.filter((l) => l.stage === key)} all={leads} onMove={move} onOpen={(id) => setOpen({ id, askLost: false })} />
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <Panel
            key={open.id}
            id={open.id}
            askLost={open.askLost}
            admins={admins}
            onChange={replace}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Column({
  stage,
  label,
  leads,
  all,
  onMove,
  onOpen,
}: {
  stage: Stage;
  label: string;
  leads: Lead[];
  all: Lead[];
  onMove: (l: Lead, to: Stage) => void;
  onOpen: (id: number) => void;
}) {
  const [over, setOver] = useState(false);
  const total = leads.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);

  return (
    <section
      aria-label={label}
      data-testid={`stage-${stage}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const lead = all.find((l) => String(l.id) === e.dataTransfer.getData("text/plain"));
        if (lead) onMove(lead, stage);
      }}
      className={`flex min-h-64 flex-col border p-3 transition-colors duration-300 ${over ? "border-current bg-[var(--field)]" : "border-line"}`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
        <h2 className="label !opacity-100">{label}</h2>
        <span className="label">
          {leads.length}
          {total > 0 && ` · ${sar(total)}`}
        </span>
      </header>
      <ul className="grid gap-2">
        {leads.map((l) => (
          <Card key={l.id} lead={l} onMove={onMove} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function Card({ lead: l, onMove, onOpen }: { lead: Lead; onMove: (l: Lead, to: Stage) => void; onOpen: (id: number) => void }) {
  const overdue = isOverdue(l);
  return (
    // Native HTML5 drag lives on the inner div: Framer Motion reserves onDragStart on motion.* for its own gestures.
    <motion.li layout transition={{ duration: 0.3, ease: EASE }} data-testid="lead">
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(l.id));
          e.dataTransfer.effectAllowed = "move";
        }}
        className={`cursor-grab border bg-bg p-3 active:cursor-grabbing ${overdue ? "border-signal" : "border-line hover:border-current/50"}`}
      >
        <button type="button" onClick={() => onOpen(l.id)} className="block w-full text-start">
          <span className="block font-medium">{l.name}</span>
          {l.company && <span className="block text-sm opacity-70">{l.company}</span>}
        </button>
        <p className="label mt-2">
          {serviceLabel(l.service)} · {l.dealValue === null ? "No value" : sar(l.dealValue)}
        </p>
        <p className="label mt-1">
          {new Date(l.createdAt).toLocaleDateString()} · {ownerName(l.ownerEmail)}
        </p>
        {overdue && <p className="label mt-1 !opacity-100 text-signal">Follow-up overdue · {l.followUpOn}</p>}
        <select
          aria-label={`Stage for ${l.name}`}
          value={l.stage}
          onChange={(e) => onMove(l, e.target.value as Stage)}
          className="mt-3 w-full border border-line bg-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
        >
          {STAGES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </motion.li>
  );
}

function Panel({
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
    api.lead(id).then((l) => {
      setLead(l);
      setValue(l.dealValue === null ? "" : String(l.dealValue));
      setReason(l.lostReason ?? "");
    }, () => setMsg("Couldn't load this lead."));
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
        className="fixed inset-0 z-[55] bg-ink/20"
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-labelledby="lead-title"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.35, ease: EASE }}
        data-lenis-prevent
        className="fixed inset-y-0 end-0 z-[56] w-full max-w-md overflow-y-auto border-s border-line bg-bg p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="label">Lead #{id}</p>
          <button type="button" onClick={onClose} className="link-underline label !opacity-100" autoFocus>
            Close
          </button>
        </div>
        {!lead ? (
          <p className="label mt-6">{msg || "Loading…"}</p>
        ) : (
          <div className="mt-4 grid gap-8">
            <div>
              <h2 id="lead-title" className="text-2xl font-medium">
                {lead.name}
              </h2>
              <p className="label mt-2">
                <a className="link-underline" href={`mailto:${lead.email}`}>
                  {lead.email}
                </a>
                {lead.company && ` · ${lead.company}`}
              </p>
              <p className="label mt-1">
                {serviceLabel(lead.service)} · Budget {lead.budget} · {new Date(lead.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-4 whitespace-pre-line font-light leading-relaxed">{lead.message}</p>
            </div>

            {msg && <p role="status">{msg}</p>}

            {showLost && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save({ stage: "lost", lostReason: reason.trim() }, "Marked as lost.");
                }}
                className="grid gap-3 border border-signal p-4"
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
                  <MagneticButton type="submit">{lead.stage === "lost" ? "Update reason" : "Mark as lost"}</MagneticButton>
                </div>
              </form>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Stage"
                value={lead.stage}
                onChange={(e) => (e.target.value === "lost" ? !showLost && setMsg("Give a reason above to mark it lost.") : save({ stage: e.target.value as Stage }))}
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
                <button type="submit" className="link-underline label justify-self-start !opacity-100">
                  Save value
                </button>
              </form>
              <TextField
                label="Follow-up"
                type="date"
                value={lead.followUpOn ?? ""}
                onChange={(e) => save({ followUpOn: e.target.value || null })}
                error={errors.followUpOn}
                hint={overdue ? <p className="label !opacity-100 text-signal">Overdue</p> : undefined}
                className={`field ${overdue ? "!border-signal" : ""}`}
              />
            </div>

            <form onSubmit={addNote} className="grid gap-3">
              <TextArea label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} error={errors.body} maxLength={2000} className="field min-h-20" />
              <div>
                <MagneticButton type="submit">Add note</MagneticButton>
              </div>
            </form>

            <section aria-labelledby="timeline-title">
              <h3 id="timeline-title" className="label mb-4">
                Activity
              </h3>
              <ol className="grid gap-4 border-s border-line ps-4">
                {lead.activities.map((a) => (
                  <li key={a.id}>
                    <p className={a.kind === "note" ? "whitespace-pre-line" : "font-light"}>{a.body}</p>
                    <p className="label mt-1">
                      {new Date(a.at).toLocaleString()}
                      {a.by && ` · ${ownerName(a.by)}`}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </motion.aside>
    </>
  );
}
