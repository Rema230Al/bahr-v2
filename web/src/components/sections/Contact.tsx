import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefs } from "../../i18n/PrefsProvider";
import { api, ApiError } from "../../lib/api";
import { errorMessage, trimAll, validate } from "../../lib/validate";
import { Honeypot, SelectField, TextArea, TextField } from "../ui/Field";
import MagneticButton from "../ui/Magnetic";
import BriefAssistant from "./BriefAssistant";

const EMPTY = { name: "", email: "", company: "", service: "web", budget: "not-sure", message: "" };
const RULES = {
  name: { min: 2 },
  email: { email: true },
  company: { optional: true },
  message: { min: 10 },
};

/** "Let's talk" — project inquiry form, down in the abyss. */
export default function Contact() {
  const { t } = usePrefs();
  const c = t.contact;
  const [values, setValues] = useState(EMPTY);
  const [website, setWebsite] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState("");

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const errs = validate(values, RULES, t.errors);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus("sending");
    try {
      await api.sendInquiry({ ...trimAll(values), website, ...(aiBrief.trim() ? { aiBrief: aiBrief.trim() } : {}) });
      setStatus("sent");
      setValues(EMPTY);
      setAiBrief("");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.code === "validation") setErrors(err.fields);
      else setFormError(errorMessage(err instanceof ApiError ? err.code : "generic", t.errors));
    }
  };

  return (
    <section
      id="contact"
      aria-labelledby="talk-title"
      className="relative px-[var(--gutter)] pb-24 pt-28 md:pb-32 md:pt-40"
      style={{ backgroundColor: "#0a1628", color: "#dfe6ee", ["--line" as string]: "rgb(223 230 238 / 0.16)", ["--field" as string]: "rgb(223 230 238 / 0.04)", ["--signal" as string]: "#8ec0ff" }}
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
        <div>
          <p className="label text-signal !opacity-100">{c.kicker}</p>
          <h2 id="talk-title" className="display mt-4 text-[length:var(--fs-xl)]">
            {c.title}
          </h2>
          <p className="mt-6 max-w-sm text-[length:var(--fs-md)] font-light leading-snug opacity-80">{c.intro}</p>
          <p className="label mt-10">{c.emailLabel}</p>
          <a href={`mailto:${c.email}`} className="link-underline mt-2 text-[clamp(1.2rem,2vw,1.8rem)]" dir="ltr">
            {c.email}
          </a>
        </div>

        <div className="relative min-h-[28rem]">
          <AnimatePresence mode="wait" initial={false}>
            {status === "sent" ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full flex-col items-start justify-center gap-8"
                role="status"
              >
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-signal shadow-[0_0_24px_#8ec0ff]" />
                <p className="text-[length:var(--fs-lg)] font-light leading-tight">{c.success}</p>
                <button type="button" onClick={() => setStatus("idle")} className="link-underline label !opacity-100">
                  {c.another}
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                noValidate
                onSubmit={submit}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="grid gap-6 md:grid-cols-2"
              >
                <TextField label={c.fields.name} name="name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} maxLength={100} required />
                <TextField label={c.fields.email} name="email" type="email" autoComplete="email" dir="ltr" value={values.email} onChange={set("email")} error={errors.email} maxLength={254} required />
                <TextField label={c.fields.company} name="company" autoComplete="organization" value={values.company} onChange={set("company")} error={errors.company} maxLength={120} />
                <SelectField label={c.fields.service} name="service" value={values.service} onChange={set("service")} error={errors.service} options={Object.entries(c.services)} />
                <div className="md:col-span-2">
                  <SelectField label={c.fields.budget} name="budget" value={values.budget} onChange={set("budget")} error={errors.budget} options={Object.entries(c.budgets)} />
                </div>
                <div className="md:col-span-2">
                  <TextArea label={c.fields.message} name="message" value={values.message} onChange={set("message")} error={errors.message} maxLength={4000} required />
                </div>
                <div className="md:col-span-2">
                  <BriefAssistant brief={aiBrief} onBrief={setAiBrief} seed={values.message} />
                </div>
                <Honeypot value={website} onChange={setWebsite} />
                {formError && (
                  <p role="alert" className="text-signal md:col-span-2">
                    {formError}
                  </p>
                )}
                <div className="md:col-span-2">
                  <MagneticButton type="submit" disabled={status === "sending"}>
                    {status === "sending" ? c.sending : c.submit} <span aria-hidden="true" className="rtl:-scale-x-100">→</span>
                  </MagneticButton>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
