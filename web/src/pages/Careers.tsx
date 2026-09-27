import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefs } from "../i18n/PrefsProvider";
import { api, ApiError, type PublicOpening } from "../lib/api";
import { errorMessage, trimAll, validate } from "../lib/validate";
import { Honeypot, TextArea, TextField } from "../components/ui/Field";
import MagneticButton from "../components/ui/Magnetic";
import SplitWords from "../components/ui/SplitWords";

export default function Careers() {
  const { t } = usePrefs();
  const c = t.careers;
  const [openings, setOpenings] = useState<PublicOpening[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => {
    setFailed(false);
    api
      .openings()
      .then(setOpenings)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative min-h-[100svh] px-[var(--gutter)] pb-32 pt-32 md:pt-44"
    >
      <header className="relative max-w-5xl">
        <p className="label">{c.kicker}</p>
        <h1 className="display mt-4 text-[length:var(--fs-huge)]">
          <SplitWords text={c.title} />
        </h1>
        <p className="mt-6 max-w-xl text-[length:var(--fs-md)] font-light leading-snug opacity-80">{c.intro}</p>
      </header>

      <section aria-label={c.kicker} className="relative mt-16 max-w-5xl md:mt-24" aria-busy={openings === null && !failed}>
        {failed && (
          <p role="alert">
            {c.error}{" "}
            <button type="button" className="link-underline" onClick={load}>
              ↻
            </button>
          </p>
        )}
        {!failed && openings === null && <p className="label">{c.loading}</p>}
        {openings?.length === 0 && <p className="max-w-lg opacity-80">{c.empty}</p>}

        <ul className="border-b border-line">
          {openings?.map((o) => {
            const isOpen = expanded === o.id;
            const panelId = `opening-${o.id}`;
            return (
              <li key={o.id} className="border-t border-line" data-testid="opening">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 py-6 text-start md:grid-cols-[1fr_10rem_10rem_6rem] md:py-8"
                >
                  <span className="track-hover text-[clamp(1.3rem,2.6vw,2.4rem)] font-medium uppercase leading-none tracking-[-0.03em] group-hover:tracking-[0.01em]">
                    {o.title}
                  </span>
                  <span className="label hidden md:block">
                    {c.kinds[o.kind]} · {o.location}
                  </span>
                  <span className="label hidden md:flex md:items-center md:gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${o.status === "open" ? "bg-accent shadow-[0_0_10px_var(--accent)]" : "bg-current/30"}`}
                    />
                    {o.status === "open" ? c.open : c.closed}
                  </span>
                  <span className="label justify-self-end">{isOpen ? c.hide : o.status === "open" ? c.apply : "↓"}</span>
                  <span className="label col-span-2 -mt-2 md:hidden">
                    {c.kinds[o.kind]} · {o.location} · {o.status === "open" ? c.open : c.closed}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      key="panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-10 pb-12 md:grid-cols-[1fr_1.3fr] md:gap-16">
                        <p className="whitespace-pre-line font-light leading-relaxed opacity-85">{o.description}</p>
                        {o.status === "open" ? <ApplyForm opening={o} /> : <p className="label">{c.closedNote}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>

        <Link to="/" className="link-underline label mt-16 inline-block !opacity-100">
          <span aria-hidden="true" className="rtl:-scale-x-100 inline-block">←</span> {c.back}
        </Link>
      </section>
    </motion.div>
  );
}

const EMPTY = { name: "", email: "", portfolio: "", message: "" };
const RULES = { name: { min: 2 }, email: { email: true }, portfolio: { url: true }, message: { min: 10 } };

function ApplyForm({ opening }: { opening: PublicOpening }) {
  const { t } = usePrefs();
  const c = t.careers;
  const [values, setValues] = useState(EMPTY);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState("");

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const errs = validate(values, RULES, t.errors);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus("sending");
    try {
      await api.apply(opening.id, { ...trimAll(values), website });
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.code === "validation") setErrors(err.fields);
      else setFormError(errorMessage(err instanceof ApiError ? err.code : "generic", t.errors));
    }
  };

  if (status === "sent") {
    return (
      <motion.p role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-[length:var(--fs-md)]">
        <span aria-hidden="true" className="me-3 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
        {c.success}
      </motion.p>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5" aria-label={`${c.apply}: ${opening.title}`}>
      <TextField label={c.fields.name} name="name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} maxLength={100} required />
      <TextField label={c.fields.email} name="email" type="email" autoComplete="email" dir="ltr" value={values.email} onChange={set("email")} error={errors.email} maxLength={254} required />
      <TextField label={c.fields.portfolio} name="portfolio" type="url" inputMode="url" placeholder="https://" dir="ltr" value={values.portfolio} onChange={set("portfolio")} error={errors.portfolio} maxLength={500} required />
      <TextArea label={c.fields.message} name="message" value={values.message} onChange={set("message")} error={errors.message} maxLength={3000} required />
      <Honeypot value={website} onChange={setWebsite} />
      {formError && (
        <p role="alert" className="text-signal">
          {formError}
        </p>
      )}
      <div>
        <MagneticButton type="submit" disabled={status === "sending"}>
          {status === "sending" ? c.sending : c.submit}
        </MagneticButton>
      </div>
    </form>
  );
}
