import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefs } from "../../i18n/PrefsProvider";
import { api, ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/validate";
import { TextArea, TextField } from "../ui/Field";
import MagneticButton from "../ui/Magnetic";

const MAX = [600, 300, 600];
const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } as const;

/**
 * Optional "Help me shape my idea" helper inside the Let's talk form: three short questions,
 * then an AI-drafted brief the client can edit. The brief travels with the form as plain text.
 */
export default function BriefAssistant({ brief, onBrief, seed }: { brief: string; onBrief: (b: string) => void; seed: string }) {
  const { t, lang } = usePrefs();
  const a = t.contact.assistant;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");

  const start = () => {
    setAnswers((v) => [v[0] || seed.trim().slice(0, MAX[0]), v[1]!, v[2]!]);
    setStep(0);
    setError("");
    setOpen(true);
  };

  const write = async () => {
    setBusy(true);
    setError("");
    try {
      const [idea, audience, features] = answers.map((s) => s.trim());
      const res = await api.brief({ lang: lang as "en" | "ar", idea: idea!, audience: audience!, features: features! });
      onBrief(res.brief);
      setDemo(res.demo);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? (err.code === "validation" ? "assistant_unavailable" : err.code) : "generic", t.errors));
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (step === 0 && answers[0]!.trim().length < 10) return setError(t.errors.short(10));
    setError("");
    if (step < 2) setStep(step + 1);
    else void write();
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {brief ? (
        <motion.div key="brief" {...fade} className="grid gap-2">
          <TextArea label={a.brief} name="aiBrief" value={brief} onChange={(e) => onBrief(e.target.value)} maxLength={2000} />
          <p className="text-sm opacity-70">{demo ? `${a.briefHint} ${a.demo}` : a.briefHint}</p>
          <button type="button" onClick={() => onBrief("")} className="link-underline label justify-self-start !opacity-100">
            {a.remove}
          </button>
        </motion.div>
      ) : open ? (
        <motion.div key="ask" {...fade} className="grid gap-5 border border-line p-5 md:p-6" role="group" aria-label={a.open}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="label text-signal !opacity-100">{a.step(step + 1, 3)}</p>
            <button type="button" onClick={() => setOpen(false)} className="link-underline label !opacity-100">
              {a.close}
            </button>
          </div>
          {step === 0 && <p className="text-sm font-light opacity-80">{a.intro}</p>}
          <TextField
            key={step}
            label={a.questions[step]!}
            name={`assistant-${step}`}
            value={answers[step]}
            onChange={(e) => setAnswers((v) => v.map((x, i) => (i === step ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                advance();
              }
            }}
            maxLength={MAX[step]}
            autoFocus
            error={error}
          />
          <div className="flex flex-wrap items-center gap-4">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="link-underline label !opacity-100" disabled={busy}>
                {a.back}
              </button>
            )}
            <MagneticButton type="button" onClick={advance} disabled={busy}>
              {busy ? a.writing : step < 2 ? a.next : a.write}
            </MagneticButton>
          </div>
        </motion.div>
      ) : (
        <motion.div key="open" {...fade}>
          <MagneticButton type="button" onClick={start}>
            <span aria-hidden="true">✦</span> {a.open}
          </MagneticButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
