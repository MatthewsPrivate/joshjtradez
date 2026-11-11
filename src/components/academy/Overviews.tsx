// Overview (dashboard) screens for each portal, following the Figma Make design.
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { BarChart, EmptyState, Metric, Progress, SectionHead } from "./ui";
import {
  TIME_ZONE,
  formatInt,
  formatMoney,
  type AdminOverview,
  type MonthBucket,
  type OwnerOverview,
  type StudentOverview,
  type TeacherOverview,
} from "../../lib/academy/dashboard";
import { navHref } from "../../lib/academy/nav";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Welcome({
  eyebrow,
  title,
  text,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="welcome">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartCard({
  kicker,
  title,
  summary,
  change,
  months,
  values,
  format,
  emptyText,
}: {
  kicker: string;
  title: string;
  summary: string;
  change: string | null;
  months: MonthBucket[];
  values: number[];
  format: (v: number) => string;
  emptyText: string;
}) {
  return (
    <section className="card chart-card">
      <SectionHead kicker={kicker} title={title} action={<span className="text-btn">Last 12 months</span>} />
      <div className="chart-summary">
        <strong>{summary}</strong>
        {change && (
          <span className={change.startsWith("-") ? "down" : "up"}>
            {change.startsWith("-") ? "↘" : "↗"} {change.replace(/^\+/, "")} vs previous period
          </span>
        )}
      </div>
      <BarChart values={values} labels={months.map((m) => m.label)} format={format} emptyText={emptyText} />
    </section>
  );
}

function AgendaCard({
  kicker,
  title,
  empty,
  href,
  linkLabel = "View full schedule",
}: {
  kicker: string;
  title: string;
  empty: ReactNode;
  href: string;
  linkLabel?: string;
}) {
  return (
    <section className="card agenda-card">
      <SectionHead kicker={kicker} title={title} />
      {empty}
      <a className="full-link" href={href}>
        {linkLabel} <Icon name="arrow" size={15} />
      </a>
    </section>
  );
}

function TableCard({
  kicker,
  title,
  href,
  headers,
  rows,
  empty,
}: {
  kicker: string;
  title: string;
  href: string;
  headers: string[];
  rows: ReactNode[][];
  empty: ReactNode;
}) {
  return (
    <section className="card table-card">
      <SectionHead
        kicker={kicker}
        title={title}
        action={
          <a className="btn btn-outline" href={href}>
            View all
          </a>
        }
      />
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, i) => (
                <tr key={i}>
                  {cells.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const Status = ({ value }: { value: string }) => (
  <span className={`status ${/pending|review|partially/i.test(value) ? "amber" : ""}`}>{value.replace(/_/g, " ")}</span>
);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: TIME_ZONE }).toUpperCase();

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------
function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function StudentOverviewPage({ data, firstName, base }: { data: StudentOverview; firstName: string; base?: string }) {
  const now = new Date();
  const dateLine = now
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE })
    .replace(",", "")
    .toUpperCase();
  const goalPct = Math.min(100, (data.lessonsThisWeek / data.weeklyGoal) * 100);
  const hours12m = data.hoursByMonth.reduce((a, b) => a + b, 0);
  const academy = navHref("student", "my-academy", base);
  // The dev preview has no course pages, so its links fall back to My academy.
  const courseHref = (slug: string) => (base ? academy : `/academy/student/courses/${slug}`);

  return (
    <div className="page-stack">
      <Welcome
        eyebrow={dateLine}
        title={`${greeting(now)}${firstName ? `, ${firstName}` : ""}.`}
        text={data.courses.length ? "Pick up where you left off and keep the momentum going." : "Your learning space is ready. Your courses will appear here once you're enrolled."}
        action={
          data.courses.length > 0 && (
            <a className="btn btn-primary" href={courseHref(data.courses[0]!.slug)}>
              Continue lesson <Icon name="arrow" size={16} />
            </a>
          )
        }
      >
        <div className="goal-ring" style={{ background: `conic-gradient(var(--gold) 0 ${goalPct}%, #242823 ${goalPct}%)` }} aria-label={`Weekly goal: ${data.lessonsThisWeek} of ${data.weeklyGoal} lessons`}>
          <div>
            <strong>
              {data.lessonsThisWeek}
              <span>/{data.weeklyGoal}</span>
            </strong>
            <small>WEEKLY GOAL</small>
          </div>
        </div>
      </Welcome>

      <div className="metrics-grid">
        <Metric label="Courses active" value={formatInt(data.coursesActive)} icon="book" change={data.coursesAddedThisMonth ? `+${data.coursesAddedThisMonth} this month` : null} />
        <Metric label="Learning hours" value={data.learningHours.toFixed(1)} icon="clock" change={data.hoursChange} spark={data.hoursByMonth} />
        <Metric label="Avg. assessment" value="—" icon="chart" note="No results yet" />
        <Metric label="Certificates" value="0" icon="award" note="None yet" />
      </div>

      <div className="dashboard-grid">
        <ChartCard
          kicker="LEARNING ACTIVITY"
          title="Hours invested"
          summary={`${hours12m.toFixed(1)}h`}
          change={data.hoursChange}
          months={data.months}
          values={data.hoursByMonth}
          format={(v) => `${v.toFixed(1)}h`}
          emptyText="Complete lessons to see your learning hours build up month by month."
        />
        <AgendaCard
          kicker="UP NEXT"
          title="Your schedule"
          href={navHref("student", "live-classes", base)}
          empty={<EmptyState icon="calendar" title="Nothing scheduled" text="Upcoming live classes and quizzes will show here." />}
        />
      </div>

      <section>
        <div className="section-head outside">
          <div>
            <span className="kicker">YOUR ACADEMY</span>
            <h2>Continue learning</h2>
          </div>
          <a className="text-btn" href={academy}>
            View all courses <Icon name="arrow" size={14} />
          </a>
        </div>
        {data.courses.length === 0 ? (
          <div className="card">
            <EmptyState icon="book" title="No courses yet" text="When you purchase a course it will appear here straight away." />
          </div>
        ) : (
          <div className="course-row">
            {data.courses.slice(0, 2).map((c, i) => (
              <article className="course-card card" key={c.id}>
                <div className={`course-visual course-art-${i % 2}`}>
                  {c.level && <span className="course-tag">{c.level.toUpperCase()}</span>}
                  <a className="play-btn" href={courseHref(c.slug)} aria-label={`Continue ${c.title}`}>
                    <Icon name="play" size={19} />
                  </a>
                </div>
                <div className="course-body">
                  <span className="kicker">JOSHJTRADEZ ACADEMY</span>
                  <h3>{c.title}</h3>
                  <p>{[c.instructor && `With ${c.instructor}`, plural(c.modules, "module")].filter(Boolean).join(" · ")}</p>
                  <div className="course-progress">
                    <Progress value={c.progress} />
                    <strong>{Math.round(c.progress)}%</strong>
                  </div>
                  <a href={courseHref(c.slug)}>
                    Continue learning <Icon name="arrow" size={15} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------
export function TeacherOverviewPage({ data, base }: { data: TeacherOverview; base?: string }) {
  const total = data.completionsByMonth.reduce((a, b) => a + b, 0);
  return (
    <div className="page-stack">
      <Welcome eyebrow="TEACHER PORTAL" title="Teaching command centre" text="Your students and courses at a glance. Here is what needs your attention today." />
      <div className="metrics-grid">
        <Metric label="Assigned students" value={formatInt(data.assignedStudents)} icon="users" change={data.newStudentsThisMonth ? `+${data.newStudentsThisMonth} this month` : null} />
        <Metric label="Courses taught" value={formatInt(data.coursesTaught)} icon="book" />
        <Metric label="Pending reviews" value="—" icon="note" note="No submissions" />
        <Metric label="Avg. completion" value={pct(data.avgCompletion)} icon="chart" />
      </div>
      <div className="dashboard-grid">
        <ChartCard
          kicker="PERFORMANCE"
          title="Lessons completed"
          summary={formatInt(total)}
          change={null}
          months={data.months}
          values={data.completionsByMonth}
          format={(v) => plural(v, "lesson")}
          emptyText="Lesson completions across your courses will chart here."
        />
        <AgendaCard
          kicker="TODAY"
          title="Priority actions"
          href={navHref("teacher", "live-classes", base)}
          empty={<EmptyState icon="check" title="You're all caught up" text="Grading and class reminders will appear here." />}
        />
      </div>
      <TableCard
        kicker="RECENT ACTIVITY"
        title="Submissions"
        href={navHref("teacher", "grading-centre", base)}
        headers={[]}
        rows={[]}
        empty={<EmptyState icon="note" title="No submissions yet" text="Student assignment submissions will be listed here for grading." />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------
export function OwnerOverviewPage({ data, base }: { data: OwnerOverview; base?: string }) {
  const money = (m: number, compact = false) => formatMoney(m, data.currency, compact);
  const last12 = data.revenueByMonth.reduce((a, b) => a + b, 0);
  return (
    <div className="page-stack">
      <Welcome eyebrow="BUSINESS HQ" title="Executive overview" text="A clear view of growth, revenue and platform health." />
      <div className="metrics-grid">
        <Metric label="Total revenue" value={money(data.totalRevenueMinor, true)} icon="wallet" change={data.revenueChange12m} spark={data.revenueByMonth} />
        <Metric label="Monthly revenue" value={money(data.monthRevenueMinor, true)} icon="trend" change={data.monthRevenueChange} spark={data.revenueByMonth.slice(-6)} />
        <Metric label="Active students" value={formatInt(data.activeStudents)} icon="users" />
        <Metric label="Course completion" value={pct(data.avgCompletion)} icon="award" />
      </div>
      <div className="dashboard-grid">
        <ChartCard
          kicker="REVENUE PERFORMANCE"
          title="Revenue overview"
          summary={money(last12)}
          change={data.revenueChange12m}
          months={data.months}
          values={data.revenueByMonth}
          format={(v) => money(v)}
          emptyText="Revenue will chart here once the payment provider is connected and sales come in."
        />
        <AgendaCard
          kicker="TODAY"
          title="Priority actions"
          href={navHref("owner", "enquiries", base)}
          linkLabel={data.newEnquiryCount ? `View all ${data.newEnquiryCount} new enquiries` : "View enquiries"}
          empty={
            data.newEnquiries.length ? (
              data.newEnquiries.map((e, i) => (
                <a className="agenda-item" key={e.id} href={`${navHref("owner", "enquiries", base)}#${e.id}`}>
                  <div className={`time-dot ${i === 0 ? "active" : ""}`} />
                  <time>{shortDate(e.created_at)}</time>
                  <div>
                    <strong>New enquiry: {e.name}</strong>
                    <span>{e.experience ?? "Website contact form"}</span>
                  </div>
                  <Icon name="chevron" size={16} />
                </a>
              ))
            ) : (
              <EmptyState icon="check" title="Nothing needs your attention" text="New website enquiries and payment exceptions will surface here." />
            )
          }
        />
      </div>
      <TableCard
        kicker="RECENT ACTIVITY"
        title="Latest transactions"
        href={navHref("owner", "finance", base)}
        headers={["Reference", "Product", "Amount", "Status", "Date"]}
        rows={data.latestOrders.map((o) => [
          <strong className="mono">{o.provider_reference ?? o.id.slice(0, 8).toUpperCase()}</strong>,
          o.productName,
          <span className="mono">{formatMoney(o.amount_minor, o.currency)}</span>,
          <Status value={o.status} />,
          <span className="mono">{shortDate(o.created_at)}</span>,
        ])}
        empty={<EmptyState icon="wallet" title="No transactions yet" text="Purchases will appear here as soon as they're verified by the payment provider." />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export function AdminOverviewPage({ data, base }: { data: AdminOverview; base?: string }) {
  const total = data.enrolmentsByMonth.reduce((a, b) => a + b, 0);
  const noAccess = "No access";
  return (
    <div className="page-stack">
      <Welcome eyebrow="ADMIN PORTAL" title="Operations overview" text="Monitor academy operations, resolve exceptions and keep learning moving." />
      <div className="metrics-grid">
        <Metric label="Active students" value={data.canSeeStudents ? formatInt(data.activeStudents) : "—"} icon="users" note={data.canSeeStudents ? null : noAccess} />
        <Metric label="Open tickets" value="—" icon="message" note="Support not set up" />
        <Metric label="Pending payments" value={data.canSeePayments ? formatInt(data.pendingPayments) : "—"} icon="wallet" note={data.canSeePayments ? null : noAccess} />
        <Metric label="Course completion" value={data.canSeeStudents ? pct(data.avgCompletion) : "—"} icon="chart" note={data.canSeeStudents ? null : noAccess} />
      </div>
      <div className="dashboard-grid">
        <ChartCard
          kicker="PERFORMANCE"
          title="New enrolments"
          summary={formatInt(total)}
          change={data.enrolmentsChange}
          months={data.months}
          values={data.enrolmentsByMonth}
          format={(v) => plural(v, "enrolment")}
          emptyText={data.canSeeStudents ? "Enrolments will chart here as students join courses." : "You don't have permission to view student data."}
        />
        <AgendaCard
          kicker="TODAY"
          title="Priority actions"
          href={navHref("admin", "live-classes", base)}
          empty={<EmptyState icon="check" title="Nothing needs your attention" text="Escalations and exceptions will surface here." />}
        />
      </div>
      <TableCard
        kicker="RECENT ACTIVITY"
        title="Enrolment activity"
        href={navHref("admin", "enrolments", base)}
        headers={["Student", "Course", "Source", "Status", "Date"]}
        rows={data.recentEnrolments.map((e) => [
          <strong>{e.student}</strong>,
          e.course,
          <span className="mono">{e.source}</span>,
          <Status value={e.status} />,
          <span className="mono">{shortDate(e.grantedAt)}</span>,
        ])}
        empty={<EmptyState icon="users" title="No enrolments yet" text={data.canSeeStudents ? "New enrolments will be listed here." : "You don't have permission to view enrolments."} />}
      />
    </div>
  );
}
