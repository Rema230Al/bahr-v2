import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, STAGES, type DateRange, type Lead, type Stage } from "../../lib/api";
import { matches, type Filters } from "./filters";
import { isOverdue, ownerName, sar, shortDate } from "./format";
import { Avatar, Loading, ServiceTag } from "./ui";
import LeadPanel, { type Admin } from "./LeadPanel";

/**
 * Leads CRM: every "Let's talk" inquiry is a lead. Drag cards between stages, or use each card's
 * stage select (keyboard). Moving to Lost opens the side panel to ask for a reason first.
 * Calm by design: only small Framer Motion fades/slides, no scroll effects.
 */
const EASE = [0.16, 1, 0.3, 1] as const;
const compact = (n: number) => `SAR ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
const sum = (ls: Lead[]) => ls.reduce((s, l) => s + (l.dealValue ?? 0), 0);

/** `range` filters on the server; the other filters, the stats and the column totals follow what's shown. */
export default function Leads({ range, filters, admins }: { range: DateRange; filters: Filters; admins: Admin[] }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [open, setOpen] = useState<{ id: number; askLost: boolean } | null>(null);
  const [error, setError] = useState("");

  const { from, to } = range;
  useEffect(() => {
    let live = true; // ignore a slower response for a range the admin has already changed
    api.leads({ from, to }).then(
      (r) => live && setLeads(r),
      () => live && setLeads([]),
    );
    return () => {
      live = false;
    };
  }, [from, to]);

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

  const { q, stage, service, owner } = filters;
  const visible = useMemo(
    () =>
      (leads ?? []).filter(
        (l) =>
          (stage === "all" || l.stage === stage) &&
          (service === "all" || l.service === service) &&
          (owner === "all" || (owner === "none" ? l.ownerId === null : String(l.ownerId) === owner)) &&
          matches(q, l.name, l.company, l.email),
      ),
    [leads, q, stage, service, owner],
  );

  if (!leads) return <Loading />;

  const won = visible.filter((l) => l.stage === "won").length;
  const lost = visible.filter((l) => l.stage === "lost").length;
  const openDeals = visible.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const pipeline = sum(openDeals);

  return (
    <div>
      <dl className="grid grid-cols-3 gap-3" aria-label="Summary">
        <Stat label="Total leads" value={String(visible.length)} hint={from || to ? "In date range" : "All time"} />
        <Stat label="Pipeline value" value={compact(pipeline)} title={sar(pipeline)} hint={`${openDeals.length} open deal${openDeals.length === 1 ? "" : "s"}`} />
        <Stat label="Win rate" value={won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"} hint={`${won} won · ${lost} lost`} />
      </dl>

      {error && (
        <p role="alert" className="mt-4 text-sm text-signal">
          {error}
        </p>
      )}

      {/* All five stages share the width equally (minmax(0, 1fr) tracks): nothing overflows into the next column. */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {STAGES.map(([key, label]) => (
          <Column
            key={key}
            stage={key}
            label={label}
            leads={visible.filter((l) => l.stage === key)}
            all={leads}
            onMove={move}
            onOpen={(id) => setOpen({ id, askLost: false })}
          />
        ))}
      </div>

      <AnimatePresence>
        {open && <LeadPanel key={open.id} id={open.id} askLost={open.askLost} admins={admins} onChange={replace} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, hint, title }: { label: string; value: string; hint: string; title?: string }) {
  return (
    <div className="card min-w-0 px-3 py-3 md:px-4 md:py-4">
      <dt className="truncate text-xs font-medium text-muted md:text-sm">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums md:text-2xl" title={title}>
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-muted">{hint}</dd>
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
  const total = sum(leads);

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
      className={`flex min-h-40 min-w-0 flex-col rounded-[10px] p-2 transition-[background-color,box-shadow] duration-200 ${
        over ? "bg-accent/[0.07] shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-[var(--sunken)]"
      }`}
    >
      <header className="mb-2 px-1.5 pb-1 pt-1">
        <div className="flex items-center gap-2">
          <span className={`dot dot-${stage}`} aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold">{label}</h2>
          <span className="rounded-full bg-ink/[0.07] px-1.5 text-xs font-medium tabular-nums text-muted">{leads.length}</span>
        </div>
        <p className="mt-0.5 ps-4 text-xs tabular-nums text-muted" title={sar(total)}>
          {compact(total)}
        </p>
      </header>
      {/* An explicit minmax(0, 1fr) track: an implicit `auto` one would grow to fit no-wrap text. */}
      <ul className="grid min-w-0 grid-cols-1 gap-2">
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
    <motion.li layout transition={{ duration: 0.3, ease: EASE }} data-testid="lead" className="min-w-0">
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(l.id));
          e.dataTransfer.effectAllowed = "move";
        }}
        className={`card relative w-full min-w-0 cursor-grab p-3 transition-[border-color,box-shadow] duration-200 hover:shadow-[0_4px_14px_-6px_rgb(12_34_64/0.25)] active:cursor-grabbing ${
          overdue ? "!border-signal/60" : "hover:!border-ink/20"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <Avatar name={l.name} />
          <div className="min-w-0 flex-1">
            {/* The name's button covers the whole card, so a click anywhere opens the lead. */}
            <button
              type="button"
              onClick={() => onOpen(l.id)}
              className="block max-w-full truncate text-start text-sm font-semibold after:absolute after:inset-0 after:rounded-[10px] hover:text-accent"
            >
              {l.name}
            </button>
            <p className="truncate text-xs text-muted">{l.company || "No company"}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <ServiceTag service={l.service} />
          <span className={`min-w-0 truncate text-sm tabular-nums ${l.dealValue === null ? "text-muted" : "font-semibold"}`}>
            {l.dealValue === null ? "No value" : sar(l.dealValue)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-muted">
          <time dateTime={l.createdAt} className="whitespace-nowrap">
            {shortDate(l.createdAt)}
          </time>
          <span className="flex min-w-0 items-center gap-1.5" title={l.ownerEmail ?? "Unassigned"}>
            {l.ownerEmail ? (
              <Avatar name={l.ownerEmail} size="sm" />
            ) : (
              <span aria-hidden="true" className="h-5 w-5 flex-none rounded-full border border-dashed border-muted/60" />
            )}
            <span className="truncate">{ownerName(l.ownerEmail)}</span>
          </span>
        </div>
        {overdue && <p className="mt-2 text-xs font-medium text-signal">Follow-up overdue · {l.followUpOn}</p>}
        {/* Keyboard alternative to dragging: hidden until it receives focus. */}
        <select
          aria-label={`Stage for ${l.name}`}
          value={l.stage}
          onChange={(e) => onMove(l, e.target.value as Stage)}
          className="field sr-only relative z-10 focus:not-sr-only focus:mt-3 focus:!block focus:w-full"
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
