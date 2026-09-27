import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Base = { label: string; error?: string; hint?: ReactNode };

function Wrap({ id, label, error, hint, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label !opacity-90">
        {label}
      </label>
      {children}
      {hint}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-signal">
          {error}
        </p>
      )}
    </div>
  );
}

const aria = (id: string, error?: string) => ({
  id,
  "aria-invalid": error ? (true as const) : undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
});

export function TextField({ label, error, hint, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <input className="field" {...aria(id, error)} {...rest} />
    </Wrap>
  );
}

export function TextArea({ label, error, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error}>
      <textarea className="field min-h-36 resize-y" data-lenis-prevent {...aria(id, error)} {...rest} />
    </Wrap>
  );
}

export function SelectField({
  label,
  error,
  options,
  ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { options: [string, string][] }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error}>
      <select className="field pe-10" {...aria(id, error)} {...rest}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

/** Off-screen field that only bots fill in. Hidden from people and assistive tech. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Website
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
