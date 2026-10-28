import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#022C22] md:text-[30px]" data-testid="page-title">{title}</h1>
        <div className="gold-hairline mt-2 w-24" />
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = "", testId }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string;
}) {
  return (
    <section className={`lux-card rounded-xl border ${className}`} data-testid={testId}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ text, testId }: { text: string; testId?: string }) {
  return (
    <div className="rounded-md border border-dashed bg-[#F6FBF8] px-4 py-8 text-center text-sm text-muted-foreground" data-testid={testId}>
      {text}
    </div>
  );
}
