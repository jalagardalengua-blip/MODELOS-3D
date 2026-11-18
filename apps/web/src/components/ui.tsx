/** Componentes básicos de interfaz reutilizables. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger';

export function Button({
  variant = 'subtle',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-[var(--accent)] text-white hover:brightness-110',
    subtle: 'bg-white/5 text-zinc-200 hover:bg-white/10 border border-white/10',
    ghost: 'text-zinc-300 hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30',
  };
  return (
    <button
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; badge?: ReactNode }[];
}) {
  return (
    <div className="flex shrink-0 border-b border-[var(--line)]">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`relative flex h-9 flex-1 items-center justify-center gap-1.5 px-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
            value === it.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {it.label}
          {it.badge}
          {value === it.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-[var(--accent)]" />}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-[var(--line)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-[0.12em] text-zinc-500 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 py-0.5">
      <span className="shrink-0 text-zinc-400">{label}</span>
      <span className="mono truncate text-right text-zinc-200">{children}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[11px] text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'h-8 w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 text-[12px] text-zinc-100 outline-none focus:border-[var(--accent)]';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`h-7 rounded-md border px-2.5 text-[11px] font-medium transition ${
        checked ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-zinc-100' : 'border-white/10 text-zinc-400 hover:text-zinc-200'
      }`}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}

export function StatusDot({ state }: { state: 'ok' | 'warn' | 'off' | 'error' }) {
  const c = { ok: 'bg-emerald-400', warn: 'bg-amber-400', off: 'bg-zinc-600', error: 'bg-red-500' }[state];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-[12px] leading-relaxed text-zinc-500">{children}</div>;
}
