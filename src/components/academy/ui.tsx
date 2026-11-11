// Presentational building blocks ported from the Figma Make design.
// Server-rendered; none of these need client JavaScript.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span>
          JOSHJ<span>TRADEZ</span>
        </span>
      )}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Scales any series into the 10–90 band of the 0–100 viewBox. Returns null for flat/empty data. */
function normalise(data: number[]): number[] | null {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (max === min) return null;
  return data.map((v) => 10 + ((v - min) / (max - min)) * 80);
}

export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  const scaled = normalise(data);
  if (!scaled) return null;
  const points = scaled.map((v, i) => `${(i / (scaled.length - 1)) * 100},${100 - v}`).join(" ");
  return (
    <svg className={`spark ${positive ? "" : "negative"}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

export interface MetricProps {
  label: string;
  value: string;
  icon: IconName;
  /** Signed change, e.g. "+12.4%". Coloured green/red. */
  change?: string | null;
  /** Neutral annotation shown where change would be, e.g. "No results yet". */
  note?: string | null;
  spark?: number[] | null;
}

export function Metric({ label, value, icon, change, note, spark }: MetricProps) {
  const negative = change?.startsWith("-") ?? false;
  return (
    <div className="metric card">
      <div className="metric-top">
        <span className="metric-icon">
          <Icon name={icon} />
        </span>
        {change ? <span className={negative ? "down" : "up"}>{change}</span> : note ? <span className="metric-sub">{note}</span> : null}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {spark && <Sparkline data={spark} positive={!negative} />}
    </div>
  );
}

export function BarChart({
  values,
  labels,
  format,
  emptyText,
}: {
  values: number[];
  labels: string[];
  format: (v: number) => string;
  emptyText: string;
}) {
  const max = Math.max(0, ...values);
  if (max === 0) {
    return (
      <div className="chart-empty">
        <EmptyState icon="chart" title="No data yet" text={emptyText} />
      </div>
    );
  }
  return (
    <div className="bars">
      {values.map((v, i) => (
        <div className="bar-col" key={i} title={`${labels[i]}: ${format(v)}`}>
          <span style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
          <small>{labels[i]?.[0]}</small>
        </div>
      ))}
    </div>
  );
}

export function PageTitle({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={22} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}

export function SectionHead({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <span className="kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
