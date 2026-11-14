import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary', size = 'md', className, children, icon, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent/85',
        variant === 'secondary' && 'border border-line bg-panel-2 text-fg hover:bg-hover',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-fg',
        variant === 'danger' && 'bg-danger/90 text-white hover:bg-danger',
        className
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function Card({ className, children, title, actions, subtitle }: { className?: string; children?: ReactNode; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={clsx('rounded-lg border border-line bg-panel p-4', className)}>
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-fg">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'ok'; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap',
        tone === 'neutral' && 'bg-hover text-muted',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'danger' && 'bg-danger/15 text-danger',
        tone === 'ok' && 'bg-ok/15 text-ok'
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className ?? 'h-4 w-4')} />
}

export function Meter({ value, tone }: { value: number; tone?: 'accent' | 'warn' | 'danger' }) {
  const t = tone ?? (value >= 90 ? 'danger' : value >= 75 ? 'warn' : 'accent')
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500', t === 'accent' && 'bg-accent', t === 'warn' && 'bg-warn', t === 'danger' && 'bg-danger')}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted/80">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'h-8 rounded-md border border-line bg-bg px-2.5 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none'

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{children}</div>
}

export function InfoNote({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-fg">{children}</div>
}
