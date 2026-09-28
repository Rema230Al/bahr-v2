import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError, type AdminOpening, type Application, type Inquiry } from "../lib/api";
import { TextArea, TextField, SelectField } from "../components/ui/Field";
import MagneticButton from "../components/ui/Magnetic";
import SeaWaves, { SEA_PADDING } from "../components/ui/SeaWaves";
import Leads from "./AdminLeads";

/**
 * Admin dashboard. The UI hides itself without a session, but the real gate is the server:
 * every /admin/* request is checked there regardless of what this page shows.
 * (English-only by design — it's an internal tool.)
 */
export default function Admin() {
  const [me, setMe] = useState<{ email: string } | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
  }, []);

  return (
    <div className={`relative min-h-[100svh] px-[var(--gutter)] pt-28 md:pt-36 ${SEA_PADDING}`} dir="ltr" lang="en">
      <SeaWaves />
      <div className="relative">
        {me === undefined && <p className="label">Checking session…</p>}
        {me === null && <Login onDone={setMe} />}
        {me && <Dashboard email={me.email} onLogout={() => setMe(null)} />}
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: (me: { email: string }) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(email.trim(), password);
      onDone(await api.me());
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "rate_limited"
          ? "Too many attempts. Try again in a few minutes."
          : code === "invalid_credentials"
            ? "Wrong email or password."
            : "Couldn't sign in. Please try again.",
      );
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      className="mx-auto grid max-w-sm gap-5"
      aria-labelledby="login-title"
    >
      <p className="label">Bahr · Admin</p>
      <h1 id="login-title" className="display text-[length:var(--fs-xl)]">
        Sign in
      </h1>
      <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && (
        <p role="alert" className="text-signal">
          {error}
        </p>
      )}
      <div>
        <MagneticButton type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </MagneticButton>
      </div>
    </motion.form>
  );
}

type Tab = "leads" | "inquiries" | "openings";
const TABS: [Tab, string][] = [
  ["leads", "Leads"],
  ["inquiries", "Inquiries"],
  ["openings", "Openings"],
];

function Dashboard({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("inquiries");

  const logout = async () => {
    await api.logout().catch(() => undefined);
    onLogout();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label">Signed in as {email}</p>
          <h1 className="display mt-3 text-[length:var(--fs-xl)]">Dashboard</h1>
        </div>
        <button type="button" onClick={logout} className="link-underline label !opacity-100">
          Sign out
        </button>
      </div>

      <div role="tablist" aria-label="Sections" className="mt-10 flex gap-8 border-b border-line">
        {TABS.map(([k, name]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            id={`tab-${k}`}
            onClick={() => setTab(k)}
            className="relative pb-3 font-mono text-[12px] uppercase tracking-[0.16em]"
          >
            {name}
            {tab === k && <motion.span layoutId="tab-line" className="absolute inset-x-0 -bottom-px h-px bg-current" />}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-10">
        {tab === "leads" ? <Leads /> : tab === "inquiries" ? <Inquiries /> : <Openings />}
      </div>
    </div>
  );
}

function Inquiries() {
  const [items, setItems] = useState<Inquiry[] | null>(null);
  useEffect(() => {
    api.inquiries().then(setItems, () => setItems([]));
  }, []);
  if (!items) return <p className="label">Loading…</p>;
  if (!items.length) return <p className="opacity-70">No inquiries yet.</p>;
  return (
    <ul className="grid gap-4" aria-label="Inquiries">
      {items.map((q) => (
        <li key={q.id} className="border border-line p-5 md:p-6" data-testid="inquiry">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-lg font-medium">
              {q.name} {q.company && <span className="opacity-60">· {q.company}</span>}
            </p>
            <p className="label">{new Date(q.created_at).toLocaleString()}</p>
          </div>
          <p className="label mt-2">
            <a className="link-underline" href={`mailto:${q.email}`}>
              {q.email}
            </a>{" "}
            · {q.service} · {q.budget}
          </p>
          <p className="mt-4 whitespace-pre-line font-light leading-relaxed">{q.message}</p>
        </li>
      ))}
    </ul>
  );
}

function Openings() {
  const [items, setItems] = useState<AdminOpening[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const reload = useCallback(() => api.adminOpenings().then(setItems, () => setItems([])), []);
  useEffect(() => {
    reload();
  }, [reload]);

  const current = items?.find((o) => o.id === selected) ?? null;

  return (
    <div className="grid gap-12 md:grid-cols-[1fr_1.3fr]">
      <div className="grid content-start gap-10">
        <NewOpening onCreated={reload} />
        <div>
          <h2 className="label mb-4">All openings</h2>
          {!items && <p className="label">Loading…</p>}
          {items?.length === 0 && <p className="opacity-70">No openings yet.</p>}
          <ul className="grid gap-2">
            {items?.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSelected(o.id)}
                  aria-pressed={selected === o.id}
                  className={`flex w-full items-center justify-between gap-4 border px-4 py-3 text-start transition-colors ${
                    selected === o.id ? "border-current" : "border-line hover:border-current/50"
                  }`}
                >
                  <span>
                    <span className="block font-medium">{o.title}</span>
                    <span className="label">
                      {o.kind} · {o.location} · {o.applicants} applicant{o.applicants === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className={`label !opacity-100 ${o.status === "open" ? "text-accent" : ""}`}>{o.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {current ? (
          <motion.div key={current.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <Applicants opening={current} onAccepted={reload} />
          </motion.div>
        ) : (
          <p className="opacity-60">Select an opening to see its applicants.</p>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewOpening({ onCreated }: { onCreated: () => void }) {
  const empty = { title: "", kind: "job", location: "Jeddah", description: "" };
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.createOpening({ ...v, title: v.title.trim(), location: v.location.trim(), description: v.description.trim() });
      setV(empty);
      setErrors({});
      setMsg("Opening posted.");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation") setErrors(err.fields);
      else setMsg("Couldn't post the opening.");
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 border border-line p-5" aria-labelledby="new-opening">
      <h2 id="new-opening" className="label">
        Post an opening
      </h2>
      <TextField label="Title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} error={errors.title} maxLength={120} />
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Type" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={[["job", "Job"], ["internship", "Internship"]]} />
        <TextField label="Location" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} error={errors.location} maxLength={80} />
      </div>
      <TextArea label="Description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} error={errors.description} maxLength={5000} />
      {msg && <p role="status">{msg}</p>}
      <div>
        <MagneticButton type="submit">Post opening</MagneticButton>
      </div>
    </form>
  );
}

function Applicants({ opening, onAccepted }: { opening: AdminOpening; onAccepted: () => void }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => api.applications(opening.id).then(setApps, () => setApps([])), [opening.id]);
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
    <section aria-labelledby="applicants-title">
      <p className="label">{opening.status === "open" ? "Open — accept one applicant to close it" : "Closed"}</p>
      <h2 id="applicants-title" className="mt-2 text-2xl font-medium">
        {opening.title}
      </h2>
      {error && (
        <p role="alert" className="mt-4 text-signal">
          {error}
        </p>
      )}
      {!apps && <p className="label mt-6">Loading…</p>}
      {apps?.length === 0 && <p className="mt-6 opacity-70">No applicants yet.</p>}
      <ul className="mt-6 grid gap-4" aria-label="Applicants">
        {apps?.map((a) => (
          <li key={a.id} className={`border p-5 ${a.status === "accepted" ? "border-accent" : "border-line"}`} data-testid="applicant">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-medium">{a.name}</p>
              <p className={`label !opacity-100 ${a.status === "accepted" ? "text-accent" : ""}`}>{a.status.replace("_", " ")}</p>
            </div>
            <p className="label mt-1">
              <a className="link-underline" href={`mailto:${a.email}`}>
                {a.email}
              </a>{" "}
              ·{" "}
              <a className="link-underline" href={a.portfolio} target="_blank" rel="noopener noreferrer nofollow">
                Portfolio ↗
              </a>
            </p>
            <p className="mt-3 whitespace-pre-line font-light">{a.message}</p>
            {opening.status === "open" && a.status === "pending" && (
              <div className="mt-4 flex items-center gap-4">
                {confirming === a.id ? (
                  <>
                    <button type="button" onClick={() => accept(a.id)} className="rounded-full bg-accent px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#1d1d1d]">
                      Confirm accept
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="link-underline label !opacity-100">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirming(a.id)} className="rounded-full border border-current/30 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] hover:border-current">
                    Accept {a.name}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
