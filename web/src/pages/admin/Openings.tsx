import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError, type AdminOpening, type Application, type DateRange } from "../../lib/api";
import { SelectField, TextArea, TextField } from "../../components/ui/Field";
import { matches, type Filters } from "./filters";
import { longDate } from "./format";
import { Avatar, Button, Empty, Loading, StatusBadge } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Openings({ range, filters }: { range: DateRange; filters: Filters }) {
  const [items, setItems] = useState<AdminOpening[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [msg, setMsg] = useState("");
  const detail = useRef<HTMLDivElement>(null);
  const reload = useCallback(() => api.adminOpenings().then(setItems, () => setItems([])), []);
  useEffect(() => {
    reload();
  }, [reload]);

  const current = items?.find((o) => o.id === selected) ?? null;
  const visible = items?.filter((o) => matches(filters.q, o.title, o.location, o.kind)) ?? [];

  const select = (id: number) => {
    setSelected(id);
    // On one-column layouts the applicants sit below the list: bring them into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detail.current?.scrollIntoView({ block: "start" }));
    }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{items ? `${items.length} openings` : ""}</p>
          <Button variant="primary" onClick={() => setComposing((c) => !c)} aria-expanded={composing}>
            {composing ? "Cancel" : "New opening"}
          </Button>
        </div>
        {msg && (
          <p role="status" className="text-sm text-accent">
            {msg}
          </p>
        )}
        <AnimatePresence initial={false}>
          {composing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <NewOpening
                onCreated={() => {
                  setComposing(false);
                  setMsg("Opening posted.");
                  reload();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!items ? (
          <Loading />
        ) : !items.length ? (
          <Empty>No openings yet.</Empty>
        ) : !visible.length ? (
          <Empty>No openings match “{filters.q.trim()}”.</Empty>
        ) : (
          <ul className="grid gap-2" aria-label="Openings">
            {visible.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => select(o.id)}
                  aria-pressed={selected === o.id}
                  className={`card flex w-full items-center justify-between gap-4 px-4 py-3 text-start transition-[border-color,box-shadow] duration-200 ${
                    selected === o.id ? "!border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]" : "hover:!border-ink/25"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{o.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {o.kind === "job" ? "Job" : "Internship"} · {o.location} · {o.applicants} applicant{o.applicants === 1 ? "" : "s"}
                    </span>
                  </span>
                  <StatusBadge tone={o.status === "open" ? "accent" : "muted"}>{o.status === "open" ? "Open" : "Closed"}</StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div ref={detail} className="scroll-mt-20">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div key={current.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
              <Applicants opening={current} onAccepted={reload} range={range} />
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Empty>Select an opening to see its applicants.</Empty>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NewOpening({ onCreated }: { onCreated: () => void }) {
  const empty = { title: "", kind: "job", location: "Jeddah", description: "" };
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      await api.createOpening({ ...v, title: v.title.trim(), location: v.location.trim(), description: v.description.trim() });
      setV(empty);
      setErrors({});
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation") setErrors(err.fields);
      else setMsg("Couldn't post the opening.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card grid gap-4 p-4 md:p-5" aria-labelledby="new-opening">
      <h2 id="new-opening" className="font-semibold">
        Post an opening
      </h2>
      <TextField label="Title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} error={errors.title} maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Type" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={[["job", "Job"], ["internship", "Internship"]]} />
        <TextField label="Location" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} error={errors.location} maxLength={80} />
      </div>
      <TextArea
        label="Description"
        value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })}
        error={errors.description}
        maxLength={5000}
        className="field min-h-28 resize-y"
      />
      {msg && <p role="alert" className="text-sm text-signal">{msg}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Posting…" : "Post opening"}
        </Button>
      </div>
    </form>
  );
}

const STATUS: Record<Application["status"], string> = { pending: "Pending", accepted: "Accepted", not_selected: "Not selected" };

function Applicants({ opening, onAccepted, range }: { opening: AdminOpening; onAccepted: () => void; range: DateRange }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState("");

  const { from, to } = range;
  const load = useCallback(() => api.applications(opening.id, { from, to }).then(setApps, () => setApps([])), [opening.id, from, to]);
  useEffect(() => {
    load();
  }, [load, opening.status]);

  const accept = async (id: number) => {
    setError("");
    try {
      await api.accept(opening.id, id);
      setConfirming(null);
      await load();
      onAccepted();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "opening_closed" ? "This opening is already closed." : "Couldn't accept.");
    }
  };

  return (
    <section aria-labelledby="applicants-title" className="card overflow-hidden">
      <header className="border-b border-line px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="applicants-title" className="text-lg font-semibold tracking-tight">
            {opening.title}
          </h2>
          <StatusBadge tone={opening.status === "open" ? "accent" : "muted"}>{opening.status === "open" ? "Open" : "Closed"}</StatusBadge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {opening.status === "open"
            ? "Accept one applicant to fill the role. The opening then closes."
            : `Filled${opening.closedAt ? ` on ${longDate(opening.closedAt)}` : ""}.`}
        </p>
      </header>
      {error && (
        <p role="alert" className="border-b border-line px-5 py-3 text-sm text-signal">
          {error}
        </p>
      )}
      {!apps && (
        <div className="p-5">
          <Loading />
        </div>
      )}
      {apps?.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">{from || to ? "No applicants in this date range." : "No applicants yet."}</p>}
      {!!apps?.length && (
        <ul aria-label="Applicants" className="divide-y divide-line">
          {apps.map((a) => (
            <li key={a.id} className={`px-4 py-4 md:px-5 ${a.status === "accepted" ? "bg-accent/[0.05]" : ""}`} data-testid="applicant">
              <div className="flex items-start gap-3">
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{a.name}</p>
                    <StatusBadge tone={a.status === "accepted" ? "accent" : "muted"}>{STATUS[a.status]}</StatusBadge>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm">
                    <a className="text-accent hover:underline" href={`mailto:${a.email}`}>
                      {a.email}
                    </a>
                    <a className="text-accent hover:underline" href={a.portfolio} target="_blank" rel="noopener noreferrer nofollow">
                      Portfolio ↗
                    </a>
                    <span className="text-muted">Applied {longDate(a.created_at)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{a.message}</p>
                  {opening.status === "open" && a.status === "pending" && (
                    <div className="mt-3 flex items-center gap-2">
                      {confirming === a.id ? (
                        <>
                          <Button variant="primary" onClick={() => accept(a.id)}>
                            Confirm accept
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirming(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => setConfirming(a.id)}>Accept {a.name}</Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
