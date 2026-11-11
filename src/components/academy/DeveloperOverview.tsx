// Hidden Developer portal overview: configuration and health diagnostics.
import type { ReactNode } from "react";
import type { DevDiagnostics } from "../../lib/academy/developer";
import { TIME_ZONE } from "../../lib/academy/dashboard";
import { PORTALS } from "../../lib/academy/roles";
import { EmptyState, Metric, SectionHead } from "./ui";

const Ok = ({ ok, yes = "OK", no = "Missing" }: { ok: boolean; yes?: string; no?: string }) => (
  <span className={`status ${ok ? "" : "amber"}`}>{ok ? yes : no}</span>
);

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeveloperOverviewPage({
  data,
  session,
}: {
  data: DevDiagnostics;
  session: { email: string; userId: string; roles: string[]; permissions: string[] };
}) {
  const envOk = data.env.filter((e) => e.required).every((e) => e.set);
  const migOk = data.migrations.every((m) => m.ok);
  return (
    <div className="page-stack">
      <section className="welcome">
        <div>
          <div className="eyebrow">DEVELOPER · VISIBLE ONLY TO YOU</div>
          <h1>System diagnostics</h1>
          <p>Configuration, database health and recent activity. Secret values are never displayed — only whether they are set.</p>
        </div>
      </section>

      <div className="metrics-grid">
        <Metric label="Required settings" value={envOk ? "All set" : "Incomplete"} icon="settings" note={`${data.env.filter((e) => e.set).length}/${data.env.length} present`} />
        <Metric label="Migrations" value={migOk ? "Up to date" : "Pending"} icon="shield" note={`${data.migrations.filter((m) => m.ok).length}/${data.migrations.length} applied`} />
        <Metric label="Accounts" value={String(data.counts.find((c) => c.table === "profiles")?.count ?? "—")} icon="users" />
        <Metric label="Courses" value={String(data.counts.find((c) => c.table === "courses")?.count ?? "—")} icon="book" />
      </div>

      <div className="dashboard-grid">
        <section className="card table-card">
          <SectionHead kicker="CONFIGURATION" title="Environment variables" />
          <Table
            headers={["Variable", "Purpose", "Status"]}
            rows={data.env.map((e) => [
              <strong className="mono">{e.key}</strong>,
              e.note + (e.required ? "" : " (optional)"),
              <Ok ok={e.set} yes="Set" no={e.required ? "Missing" : "Not set"} />,
            ])}
          />
        </section>
        <section className="card table-card">
          <SectionHead kicker="YOUR SESSION" title="Signed in as" />
          <Table
            headers={["", ""]}
            rows={[
              ["Email", <strong>{session.email}</strong>],
              ["User ID", <span className="mono">{session.userId}</span>],
              ["Roles", session.roles.join(", ")],
              ["Portals", session.roles.filter((r) => r in PORTALS).length ? "All portals (developer access)" : "—"],
            ]}
          />
        </section>
      </div>

      <section className="card table-card">
        <SectionHead kicker="DATABASE" title="Migrations & data" />
        <Table
          headers={["Migration", "Status", "Detail"]}
          rows={data.migrations.map((m) => [<strong className="mono">{m.name}</strong>, <Ok ok={m.ok} yes="Applied" no="Not applied" />, m.detail])}
        />
        <Table headers={data.counts.map((c) => c.table)} rows={[data.counts.map((c) => <span className="mono">{c.count ?? "error"}</span>)]} />
      </section>

      <div className="dashboard-grid">
        <section className="card table-card">
          <SectionHead kicker="SECURITY" title="Recent audit log" />
          {data.audit.length === 0 ? (
            <EmptyState icon="clock" title="No audit entries yet" />
          ) : (
            <Table
              headers={["When", "Action", "Target"]}
              rows={data.audit.map((a) => [
                <span className="mono">{new Date(a.created_at).toLocaleString("en-GB", { timeZone: TIME_ZONE })}</span>,
                <strong>{a.action}</strong>,
                <span className="mono">{a.target_type ? `${a.target_type}:${a.target_id?.slice(0, 8) ?? ""}` : "—"}</span>,
              ])}
            />
          )}
        </section>
        <section className="card table-card">
          <SectionHead kicker="RUNTIME" title="Build" />
          <Table headers={["", ""]} rows={data.runtime.map((r) => [r.label, <span className="mono">{r.value}</span>])} />
        </section>
      </div>
    </div>
  );
}
