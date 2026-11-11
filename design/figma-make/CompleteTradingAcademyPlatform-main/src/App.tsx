import { useMemo, useState } from "react";

type Role = "student" | "teacher" | "admin" | "owner";
type IconName =
  | "grid"
  | "book"
  | "chart"
  | "note"
  | "users"
  | "calendar"
  | "message"
  | "award"
  | "tool"
  | "settings"
  | "search"
  | "bell"
  | "chevron"
  | "play"
  | "arrow"
  | "plus"
  | "filter"
  | "download"
  | "shield"
  | "wallet"
  | "menu"
  | "close"
  | "check"
  | "clock"
  | "more"
  | "trend"
  | "briefcase";

const photo =
  "https://images.unsplash.com/photo-1789922129938-f02af2785d19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1600";

const icons: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 4 3 5-7" />
    </>
  ),
  note: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M8.2 13 7 22l5-3 5 3-1.2-9" />
    </>
  ),
  tool: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3-2.5 2.5" />
      <path d="m5 12-3 3 7 7 3-3M14 16l6-6M17 7l3 3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1v-4H3A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.37.34.7.65.94.3.24.68.38 1.07.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  play: <path d="m8 5 11 7-11 7Z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 5h16M7 12h10M10 19h4" />,
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 6h16v14H3z" />
      <path d="M3 8V4h13v4M15 13h6v4h-6a2 2 0 0 1 0-4Z" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V4h8v3M3 12h18" />
    </>
  ),
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

type NavItem = { label: string; icon: IconName };
const nav: Record<Role, NavItem[]> = {
  student: [
    { label: "Overview", icon: "grid" },
    { label: "My academy", icon: "book" },
    { label: "Learning journal", icon: "note" },
    { label: "Trading journal", icon: "chart" },
    { label: "Assessments", icon: "check" },
    { label: "Live classes", icon: "calendar" },
    { label: "Community", icon: "users" },
    { label: "Messages", icon: "message" },
    { label: "Toolkit", icon: "tool" },
    { label: "Certificates", icon: "award" },
    { label: "Billing & access", icon: "wallet" },
    { label: "Settings", icon: "settings" },
  ],
  teacher: [
    { label: "Overview", icon: "grid" },
    { label: "My courses", icon: "book" },
    { label: "My classes", icon: "calendar" },
    { label: "Students", icon: "users" },
    { label: "Course builder", icon: "tool" },
    { label: "Assignments", icon: "note" },
    { label: "Grading centre", icon: "check" },
    { label: "Live classes", icon: "play" },
    { label: "Messages", icon: "message" },
    { label: "Teaching analytics", icon: "chart" },
    { label: "Settings", icon: "settings" },
  ],
  admin: [
    { label: "Overview", icon: "grid" },
    { label: "Students", icon: "users" },
    { label: "Teachers", icon: "briefcase" },
    { label: "Courses", icon: "book" },
    { label: "Enrolments", icon: "check" },
    { label: "Payments", icon: "wallet" },
    { label: "Assessments", icon: "note" },
    { label: "Live classes", icon: "calendar" },
    { label: "Community", icon: "message" },
    { label: "Support tickets", icon: "tool" },
    { label: "Permissions", icon: "shield" },
    { label: "Settings", icon: "settings" },
  ],
  owner: [
    { label: "Overview", icon: "grid" },
    { label: "Finance", icon: "wallet" },
    { label: "Revenue analytics", icon: "chart" },
    { label: "Student analytics", icon: "users" },
    { label: "Products", icon: "book" },
    { label: "Staff", icon: "briefcase" },
    { label: "Access management", icon: "shield" },
    { label: "Reports", icon: "note" },
    { label: "Audit logs", icon: "clock" },
    { label: "Security centre", icon: "shield" },
    { label: "Integrations", icon: "tool" },
    { label: "Settings", icon: "settings" },
  ],
};

const roleMeta = {
  student: { name: "Jordan Blake", sub: "Pro Student", initials: "JB" },
  teacher: { name: "Marcus Hill", sub: "Lead Educator", initials: "MH" },
  admin: { name: "Amelia Reed", sub: "Operations Admin", initials: "AR" },
  owner: { name: "Josh J", sub: "Founder & Owner", initials: "JJ" },
};

const courses = [
  {
    title: "Technical Analysis Mastery",
    tag: "ADVANCED",
    progress: 68,
    lessons: 42,
    time: "18h 40m",
    modules: 8,
    image: photo,
  },
  {
    title: "Forex Foundations",
    tag: "FOUNDATION",
    progress: 92,
    lessons: 28,
    time: "11h 20m",
    modules: 6,
    image: "",
  },
  {
    title: "Trading Psychology & Discipline",
    tag: "INTERMEDIATE",
    progress: 34,
    lessons: 24,
    time: "8h 15m",
    modules: 5,
    image: "",
  },
];

function Logo({ compact = false }: { compact?: boolean }) {
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

function Button({
  children,
  icon,
  variant = "primary",
  onClick,
}: {
  children: React.ReactNode;
  icon?: IconName;
  variant?: "primary" | "ghost" | "outline";
  onClick?: () => void;
}) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
      {icon && <Icon name={icon} size={16} />}
    </button>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function Sparkline({
  data = [18, 25, 21, 36, 31, 46, 42, 61, 57, 72, 68, 83],
  positive = true,
}: {
  data?: number[];
  positive?: boolean;
}) {
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - v}`).join(" ");
  return (
    <svg
      className={`spark ${positive ? "" : "negative"}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <polyline points={points} />
    </svg>
  );
}

function Metric({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  icon: IconName;
}) {
  return (
    <div className="metric card">
      <div className="metric-top">
        <span className="metric-icon">
          <Icon name={icon} />
        </span>
        <span className={change.startsWith("-") ? "down" : "up"}>{change}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <Sparkline positive={!change.startsWith("-")} />
    </div>
  );
}

function BarChart({ owner = false }: { owner?: boolean }) {
  const vals = owner
    ? [38, 54, 49, 67, 62, 78, 71, 89, 82, 94, 87, 98]
    : [52, 70, 44, 80, 63, 88, 76, 95, 68, 84, 92, 78];
  return (
    <div className="bars">
      {vals.map((v, i) => (
        <div className="bar-col" key={i}>
          <span style={{ height: `${v}%` }} />
          <small>{["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}</small>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ role, navigate }: { role: Role; navigate: (p: string) => void }) {
  const isStudent = role === "student";
  const copy = {
    student: ["Good morning, Jordan.", "Pick up where you left off and keep the momentum going."],
    teacher: [
      "Teaching command centre",
      "Your students are progressing. Here is what needs your attention today.",
    ],
    admin: [
      "Operations overview",
      "Monitor academy operations, resolve exceptions and keep learning moving.",
    ],
    owner: ["Executive overview", "A clear view of growth, revenue and platform health."],
  }[role];
  const metrics = {
    student: [
      ["Courses active", "3", "+1 this month", "book"],
      ["Learning hours", "46.2", "+8.4%", "clock"],
      ["Avg. assessment", "87%", "+3.2%", "chart"],
      ["Certificates", "2", "1 in progress", "award"],
    ],
    teacher: [
      ["Assigned students", "184", "+12 this month", "users"],
      ["Active classes", "6", "2 live today", "calendar"],
      ["Pending reviews", "18", "-6 this week", "note"],
      ["Avg. completion", "78%", "+4.1%", "chart"],
    ],
    admin: [
      ["Active students", "1,284", "+8.2%", "users"],
      ["Open tickets", "23", "-14.8%", "message"],
      ["Pending payments", "12", "-3 today", "wallet"],
      ["Course completion", "76.4%", "+2.7%", "chart"],
    ],
    owner: [
      ["Total revenue", "£486.2K", "+18.4%", "wallet"],
      ["Monthly revenue", "£62.8K", "+12.7%", "trend"],
      ["Active students", "1,284", "+8.2%", "users"],
      ["Course completion", "76.4%", "+2.7%", "award"],
    ],
  }[role] as [string, string, string, IconName][];

  return (
    <div className="page-stack">
      <section className={`welcome ${isStudent ? "student-welcome" : ""}`}>
        <div>
          <div className="eyebrow">
            {role === "owner"
              ? "BUSINESS HQ"
              : role === "student"
                ? "MONDAY, 24 JUNE"
                : `${role.toUpperCase()} PORTAL`}
          </div>
          <h1>{copy[0]}</h1>
          <p>{copy[1]}</p>
          {isStudent && (
            <Button icon="arrow" onClick={() => navigate("Lesson player")}>
              Continue lesson
            </Button>
          )}
        </div>
        {isStudent && (
          <div className="goal-ring">
            <div>
              <strong>
                4<span>/5</span>
              </strong>
              <small>WEEKLY GOAL</small>
            </div>
          </div>
        )}
      </section>
      <div className="metrics-grid">
        {metrics.map(([label, value, change, icon]) => (
          <Metric key={label} label={label} value={value} change={change} icon={icon} />
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <div className="section-head">
            <div>
              <span className="kicker">
                {isStudent
                  ? "LEARNING ACTIVITY"
                  : role === "owner"
                    ? "REVENUE PERFORMANCE"
                    : "PERFORMANCE"}
              </span>
              <h2>
                {isStudent
                  ? "Hours invested"
                  : role === "owner"
                    ? "Revenue overview"
                    : "Academy performance"}
              </h2>
            </div>
            <button className="text-btn">
              Last 12 months <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="chart-summary">
            <strong>
              {isStudent
                ? "46.2h"
                : role === "owner"
                  ? "£486,240"
                  : role === "teacher"
                    ? "78.4%"
                    : "1,284"}
            </strong>
            <span className="up">↗ {isStudent ? "12%" : "18.4%"} vs previous period</span>
          </div>
          <BarChart owner={role === "owner"} />
        </section>
        <section className="card agenda-card">
          <div className="section-head">
            <div>
              <span className="kicker">{isStudent ? "UP NEXT" : "TODAY"}</span>
              <h2>{isStudent ? "Your schedule" : "Priority actions"}</h2>
            </div>
            <button className="icon-btn">
              <Icon name="more" />
            </button>
          </div>
          {[
            isStudent
              ? ["10:00", "Live market breakdown", "Marcus Hill · Live class"]
              : [
                  "09:30",
                  role === "owner" ? "Leadership review" : "Team operations stand-up",
                  "30 min",
                ],
            isStudent
              ? ["14:30", "Risk management quiz", "Module 4 · 20 min"]
              : [
                  "11:00",
                  role === "teacher" ? "Grade EUR/USD assignments" : "Payment exceptions review",
                  "18 items",
                ],
            isStudent
              ? ["18:00", "Trading journal review", "Weekly reflection"]
              : [
                  "15:00",
                  role === "owner" ? "Q3 revenue planning" : "Student support escalation",
                  "Priority",
                ],
          ].map((item, i) => (
            <div className="agenda-item" key={item[1]}>
              <div className={`time-dot ${i === 0 ? "active" : ""}`} />
              <time>{item[0]}</time>
              <div>
                <strong>{item[1]}</strong>
                <span>{item[2]}</span>
              </div>
              <Icon name="chevron" size={16} />
            </div>
          ))}
          <button className="full-link" onClick={() => navigate("Live classes")}>
            View full schedule <Icon name="arrow" size={15} />
          </button>
        </section>
      </div>
      {isStudent ? (
        <ContinueLearning navigate={navigate} />
      ) : (
        <ManagementPreview role={role} navigate={navigate} />
      )}
    </div>
  );
}

function ContinueLearning({ navigate }: { navigate: (p: string) => void }) {
  return (
    <section>
      <div className="section-head outside">
        <div>
          <span className="kicker">YOUR ACADEMY</span>
          <h2>Continue learning</h2>
        </div>
        <button className="text-btn" onClick={() => navigate("My academy")}>
          View all courses <Icon name="arrow" size={14} />
        </button>
      </div>
      <div className="course-row">
        {courses.slice(0, 2).map((c, i) => (
          <article className="course-card card" key={c.title}>
            <div
              className={`course-visual course-art-${i}`}
              style={
                i === 0
                  ? {
                      backgroundImage: `linear-gradient(90deg,rgba(5,7,6,.22),rgba(5,7,6,.72)),url("${c.image}")`,
                    }
                  : {}
              }
            >
              <span className="course-tag">{c.tag}</span>
              <button className="play-btn" onClick={() => navigate("Lesson player")}>
                <Icon name="play" size={19} />
              </button>
            </div>
            <div className="course-body">
              <span className="kicker">JOSHJTRADEZ ACADEMY</span>
              <h3>{c.title}</h3>
              <p>With Marcus Hill · {c.modules} modules</p>
              <div className="course-progress">
                <Progress value={c.progress} />
                <strong>{c.progress}%</strong>
              </div>
              <button onClick={() => navigate("Lesson player")}>
                Continue learning <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ManagementPreview({ role, navigate }: { role: Role; navigate: (p: string) => void }) {
  const rows =
    role === "owner"
      ? [
          ["INV-2498", "Advanced Market Structure", "£799.00", "Completed"],
          ["INV-2497", "Forex Foundations", "£249.00", "Completed"],
          ["INV-2496", "Pro Academy Bundle", "£1,199.00", "Pending"],
        ]
      : role === "teacher"
        ? [
            ["Jordan Blake", "Market Structure Assignment", "92%", "Reviewed"],
            ["Maya Singh", "Risk Management Plan", "—", "Needs review"],
            ["Theo Martin", "Trading Psychology Essay", "—", "Needs review"],
          ]
        : [
            ["Jordan Blake", "Pro Academy Bundle", "Verified", "Active"],
            ["Maya Singh", "Technical Analysis", "Pending", "Review"],
            ["Theo Martin", "Forex Foundations", "Verified", "Active"],
          ];
  return (
    <section className="card table-card">
      <div className="section-head">
        <div>
          <span className="kicker">RECENT ACTIVITY</span>
          <h2>
            {role === "owner"
              ? "Latest transactions"
              : role === "teacher"
                ? "Submissions"
                : "Enrolment activity"}
          </h2>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            navigate(
              role === "owner" ? "Finance" : role === "teacher" ? "Grading centre" : "Enrolments",
            )
          }
        >
          View all
        </Button>
      </div>
      <div className="table-wrap">
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                <td>
                  <strong>{r[0]}</strong>
                </td>
                <td>{r[1]}</td>
                <td className="mono">{r[2]}</td>
                <td>
                  <span
                    className={`status ${r[3].includes("Pending") || r[3].includes("review") || r[3] === "Review" ? "amber" : ""}`}
                  >
                    {r[3]}
                  </span>
                </td>
                <td>
                  <button className="icon-btn">
                    <Icon name="more" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AcademyPage({ navigate }: { navigate: (p: string) => void }) {
  return (
    <div className="page-stack">
      <PageTitle
        kicker="MY ACADEMY"
        title="Build skill. Trade with clarity."
        description="Your courses, progress and next learning milestones in one place."
        action={
          <Button icon="search" variant="outline">
            Browse courses
          </Button>
        }
      />
      <div className="feature-course card">
        <div
          className="feature-photo"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(8,10,9,.08),rgba(8,10,9,.85)),url("${photo}")`,
          }}
        >
          <span className="course-tag">CONTINUE LEARNING</span>
        </div>
        <div className="feature-copy">
          <span className="kicker">ADVANCED · 18H 40M</span>
          <h2>Technical Analysis Mastery</h2>
          <p>
            Master market structure, liquidity and high-probability execution models with Marcus
            Hill.
          </p>
          <Progress value={68} />
          <div className="feature-progress">
            <strong>68% complete</strong>
            <span>29 of 42 lessons</span>
          </div>
          <Button icon="play" onClick={() => navigate("Lesson player")}>
            Resume module 6
          </Button>
        </div>
      </div>
      <div className="tab-line">
        <button className="active">
          In progress <span>3</span>
        </button>
        <button>
          Completed <span>2</span>
        </button>
        <button>
          Saved <span>4</span>
        </button>
      </div>
      <div className="academy-grid">
        {courses.map((c, i) => (
          <article className="academy-card card" key={c.title}>
            <div
              className={`academy-art art-${i}`}
              style={
                i === 0
                  ? {
                      backgroundImage: `linear-gradient(rgba(5,7,6,.2),rgba(5,7,6,.8)),url("${photo}")`,
                    }
                  : {}
              }
            >
              <span className="course-tag">{c.tag}</span>
              <span className="duration">
                <Icon name="clock" size={14} /> {c.time}
              </span>
            </div>
            <div className="academy-copy">
              <span className="kicker">JOSHJTRADEZ ACADEMY</span>
              <h3>{c.title}</h3>
              <p>
                Marcus Hill · {c.modules} modules · {c.lessons} lessons
              </p>
              <div className="course-progress">
                <Progress value={c.progress} />
                <strong>{c.progress}%</strong>
              </div>
              <button onClick={() => navigate("Lesson player")}>
                Continue course <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function LessonPage({ navigate }: { navigate: (p: string) => void }) {
  const [complete, setComplete] = useState(false);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="lesson-layout">
      <div className="lesson-main">
        <button className="back-link" onClick={() => navigate("My academy")}>
          ← Back to course
        </button>
        <div
          className="video-frame"
          style={{
            backgroundImage: `linear-gradient(rgba(2,3,3,.28),rgba(2,3,3,.48)),url("${photo}")`,
          }}
        >
          <button className="video-play" onClick={() => setPlaying(!playing)}>
            <Icon name={playing ? "close" : "play"} size={28} />
          </button>
          <div className="video-bottom">
            <span>{playing ? "12:48" : "00:00"} / 24:16</span>
            <div className="video-line">
              <span style={{ width: playing ? "53%" : "3%" }} />
            </div>
            <button>1×</button>
            <button>CC</button>
          </div>
        </div>
        <div className="lesson-title">
          <div>
            <span className="kicker">MODULE 6 · LESSON 3</span>
            <h1>Liquidity sweeps and market intent</h1>
            <p>
              Learn how to read liquidity events and distinguish genuine expansion from engineered
              stop runs.
            </p>
          </div>
          <Button
            variant={complete ? "outline" : "primary"}
            icon="check"
            onClick={() => setComplete(!complete)}
          >
            {complete ? "Completed" : "Mark complete"}
          </Button>
        </div>
        <div className="lesson-tabs">
          <button className="active">Overview</button>
          <button>Notes</button>
          <button>
            Resources <span>3</span>
          </button>
          <button>
            Q&A <span>12</span>
          </button>
        </div>
        <section className="lesson-content card">
          <h2>In this lesson</h2>
          <p>
            Liquidity is one of the most important concepts for understanding why price moves.
            You’ll learn to identify obvious pools of resting orders and study the behaviour that
            follows a sweep.
          </p>
          <div className="takeaway">
            <Icon name="note" />
            <div>
              <strong>Key takeaway</strong>
              <p>
                Do not treat every wick beyond a high or low as a reversal signal. Context and
                displacement confirm intent.
              </p>
            </div>
          </div>
        </section>
      </div>
      <aside className="curriculum">
        <div className="curriculum-head">
          <span className="kicker">COURSE CURRICULUM</span>
          <h3>Technical Analysis Mastery</h3>
          <Progress value={68} />
          <p>29 of 42 lessons complete</p>
        </div>
        {[
          "Market structure foundations",
          "Mapping liquidity",
          "Premium & discount",
          "Order flow fundamentals",
          "Execution frameworks",
          "Liquidity and intent",
          "Building your model",
        ].map((m, i) => (
          <div className={`module ${i === 5 ? "open" : ""}`} key={m}>
            <button>
              <span>
                <small>MODULE {i + 1}</small>
                <strong>{m}</strong>
              </span>
              <Icon name="chevron" size={15} />
            </button>
            {i === 5 && (
              <div className="lessons">
                {[
                  "Internal vs external liquidity",
                  "Inducement theory",
                  "Liquidity sweeps and market intent",
                  "Confirmation and entry",
                ].map((l, j) => (
                  <button className={j === 2 ? "current" : ""} key={l}>
                    <span className={j < 2 ? "lesson-check" : "lesson-num"}>
                      {j < 2 ? "✓" : j + 1}
                    </span>
                    <span>
                      {l}
                      <small>{j === 2 ? "24:16 · Playing" : `${12 + j * 4}:20`}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="instructor">
          <div className="avatar">MH</div>
          <div>
            <small>YOUR INSTRUCTOR</small>
            <strong>Marcus Hill</strong>
            <span>Lead trading educator</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TradingJournal({ toast }: { toast: (s: string) => void }) {
  const [modal, setModal] = useState(false);
  return (
    <div className="page-stack">
      <PageTitle
        kicker="TRADING JOURNAL"
        title="Your edge, measured."
        description="Review execution, uncover patterns and turn every trade into useful data."
        action={
          <Button icon="plus" onClick={() => setModal(true)}>
            Log a trade
          </Button>
        }
      />
      <div className="journal-hero card">
        <div>
          <span className="kicker">NET PERFORMANCE · JUNE</span>
          <strong>+£2,847.60</strong>
          <p>
            <span className="up">↗ 8.4%</span> on a £34,000 starting balance
          </p>
        </div>
        <div className="equity">
          <Sparkline data={[16, 24, 20, 32, 28, 44, 39, 56, 51, 62, 58, 75, 70, 82, 88]} />
        </div>
      </div>
      <div className="metrics-grid compact">
        <Metric label="Win rate" value="64.8%" change="+5.2%" icon="award" />
        <Metric label="Profit factor" value="2.14" change="+0.18" icon="trend" />
        <Metric label="Avg. R multiple" value="2.32R" change="+0.24R" icon="chart" />
        <Metric label="Consistency" value="82/100" change="+7 pts" icon="check" />
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <div className="section-head">
            <div>
              <span className="kicker">PERFORMANCE CURVE</span>
              <h2>Account growth</h2>
            </div>
            <button className="text-btn">
              Last 30 days <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="line-chart">
            <div className="grid-lines" />
            <Sparkline data={[20, 25, 22, 34, 29, 45, 42, 57, 51, 65, 59, 72, 78, 74, 88]} />
          </div>
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <span className="kicker">STRATEGY EDGE</span>
              <h2>Performance by setup</h2>
            </div>
          </div>
          {[
            ["Liquidity sweep", 74, "+8.4R"],
            ["Break & retest", 61, "+5.2R"],
            ["London reversal", 48, "+2.1R"],
            ["Range breakout", 32, "-0.8R"],
          ].map(([n, v, r]) => (
            <div className="strategy" key={n}>
              <div>
                <strong>{n}</strong>
                <span className={String(r).startsWith("-") ? "down" : "up"}>{r}</span>
              </div>
              <Progress value={Number(v)} />
              <small>{v}% win rate</small>
            </div>
          ))}
        </section>
      </div>
      <section className="card table-card">
        <div className="section-head">
          <div>
            <span className="kicker">TRADE HISTORY</span>
            <h2>Recent executions</h2>
          </div>
          <div className="actions">
            <button className="icon-btn">
              <Icon name="filter" />
            </button>
            <Button variant="outline" icon="download">
              Export
            </Button>
          </div>
        </div>
        <TradeTable />
      </section>
      {modal && (
        <TradeModal
          close={() => setModal(false)}
          save={() => {
            setModal(false);
            toast("Trade added to your private journal");
          }}
        />
      )}
    </div>
  );
}

function TradeTable() {
  const rows = [
    ["EUR/USD", "LONG", "1.07124", "1.07582", "+2.6R", "+£624.80"],
    ["XAU/USD", "SHORT", "2,336.40", "2,321.15", "+1.8R", "+£432.00"],
    ["GBP/USD", "LONG", "1.26842", "1.26510", "-1.0R", "-£240.00"],
    ["NAS100", "SHORT", "19,842.2", "19,721.6", "+3.1R", "+£744.00"],
  ];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Direction</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>Result</th>
            <th>P&L</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <td>
                <strong>{r[0]}</strong>
                <small>24 JUN · LONDON</small>
              </td>
              <td>
                <span className={`direction ${r[1] === "SHORT" ? "short" : ""}`}>{r[1]}</span>
              </td>
              <td className="mono">{r[2]}</td>
              <td className="mono">{r[3]}</td>
              <td className={`mono ${r[4].startsWith("-") ? "down" : "up"}`}>{r[4]}</td>
              <td className={`mono ${r[5].startsWith("-") ? "down" : "up"}`}>{r[5]}</td>
              <td>
                <button className="icon-btn">
                  <Icon name="more" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeModal({ close, save }: { close: () => void; save: () => void }) {
  return (
    <div className="modal-bg" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="section-head">
          <div>
            <span className="kicker">PRIVATE JOURNAL</span>
            <h2>Log a new trade</h2>
          </div>
          <button className="icon-btn" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        <div className="form-grid">
          <label>
            Instrument
            <input placeholder="e.g. EUR/USD" />
          </label>
          <label>
            Direction
            <select>
              <option>Long / Buy</option>
              <option>Short / Sell</option>
            </select>
          </label>
          <label>
            Entry price
            <input placeholder="0.00000" />
          </label>
          <label>
            Exit price
            <input placeholder="0.00000" />
          </label>
          <label>
            Position size
            <input placeholder="1.00 lot" />
          </label>
          <label>
            Risk percentage
            <input placeholder="1.0%" />
          </label>
          <label>
            Strategy
            <select>
              <option>Liquidity sweep</option>
              <option>Break & retest</option>
            </select>
          </label>
          <label>
            Emotional state
            <select>
              <option>Focused</option>
              <option>Confident</option>
              <option>Anxious</option>
            </select>
          </label>
          <label className="wide">
            Trade notes
            <textarea placeholder="What did you see? How did you execute?" />
          </label>
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button icon="check" onClick={save}>
            Save trade
          </Button>
        </div>
        <p className="prototype-note">
          <Icon name="shield" size={14} /> Prototype only — journal entries are not persisted yet.
        </p>
      </div>
    </div>
  );
}

function LearningJournal({ toast }: { toast: (s: string) => void }) {
  const [note, setNote] = useState(
    "The strongest setups appear when the higher-timeframe narrative and lower-timeframe displacement agree.\n\nReview: mark external liquidity before the London open.",
  );
  return (
    <div className="page-stack">
      <PageTitle
        kicker="LEARNING JOURNAL"
        title="Think on the page."
        description="Capture ideas, connect them to lessons and build a personal trading knowledge base."
        action={
          <Button icon="plus" onClick={() => toast("New note created")}>
            New note
          </Button>
        }
      />
      <div className="notes-layout">
        <aside className="card note-list">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder="Search your notes" />
          </div>
          <div className="note-filters">
            <button className="active">All notes</button>
            <button>Saved lessons</button>
            <button>Shared</button>
          </div>
          {[
            "Market structure confluence",
            "Liquidity sweep checklist",
            "Weekly reflection · 23 June",
            "Questions for Marcus",
            "Risk management rules",
          ].map((n, i) => (
            <button className={`note-row ${i === 0 ? "active" : ""}`} key={n}>
              <span className="note-icon">
                <Icon name={i === 2 ? "calendar" : "note"} size={16} />
              </span>
              <span>
                <strong>{n}</strong>
                <small>{i === 0 ? "Technical Analysis · Lesson 6.3" : `${i + 1} days ago`}</small>
              </span>
            </button>
          ))}
        </aside>
        <section className="card editor">
          <div className="editor-top">
            <div>
              <span className="kicker">TECHNICAL ANALYSIS MASTERY · LESSON 6.3</span>
              <input defaultValue="Market structure confluence" aria-label="Note title" />
            </div>
            <span className="saved">
              <Icon name="check" size={14} /> Saved
            </span>
          </div>
          <div className="editor-tools">
            <button>
              <strong>H1</strong>
            </button>
            <button>
              <strong>B</strong>
            </button>
            <button>
              <em>I</em>
            </button>
            <button>• List</button>
            <button>☑ Checklist</button>
            <button>Link</button>
            <span />
            <button>
              <Icon name="more" size={16} />
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note content"
          />
          <div className="tags">
            <span>#market-structure</span>
            <span>#liquidity</span>
            <button>+ Add tag</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toolkit() {
  const [balance, setBalance] = useState(10000);
  const [risk, setRisk] = useState(1);
  const [stop, setStop] = useState(25);
  const result = useMemo(
    () => (((balance * risk) / 100 / stop) * 10).toFixed(2),
    [balance, risk, stop],
  );
  return (
    <div className="page-stack">
      <PageTitle
        kicker="TRADING TOOLKIT"
        title="Calculate before you commit."
        description="Practical education tools to support consistent risk and structured decision-making."
      />
      <div className="tool-grid">
        <section className="card calculator">
          <div className="calc-head">
            <span className="metric-icon">
              <Icon name="tool" />
            </span>
            <div>
              <span className="kicker">RISK MANAGEMENT</span>
              <h2>Position size calculator</h2>
            </div>
          </div>
          <div className="calc-fields">
            <label>
              Account balance (£)
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
              />
            </label>
            <label>
              Risk per trade (%)
              <input type="number" value={risk} onChange={(e) => setRisk(Number(e.target.value))} />
            </label>
            <label>
              Stop loss (pips)
              <input type="number" value={stop} onChange={(e) => setStop(Number(e.target.value))} />
            </label>
          </div>
          <div className="calc-result">
            <span>Suggested position size</span>
            <strong>
              {result}
              <small> mini lots</small>
            </strong>
            <p>Maximum capital at risk: £{((balance * risk) / 100).toFixed(2)}</p>
          </div>
          <p className="disclaimer">
            <Icon name="shield" size={15} /> Educational estimate only. This does not constitute
            financial advice or execute any trade.
          </p>
        </section>
        <section className="card resource-panel">
          <span className="kicker">QUICK CALCULATORS</span>
          <h2>Plan with precision</h2>
          {[
            ["Risk-to-reward", "Compare downside against potential upside", "trend"],
            ["Pip value", "Calculate pip value across major pairs", "chart"],
            ["Risk percentage", "Work backwards from a fixed loss limit", "shield"],
          ].map(([t, d, i]) => (
            <button className="resource-link" key={t}>
              <span className="metric-icon">
                <Icon name={i as IconName} />
              </span>
              <span>
                <strong>{t}</strong>
                <small>{d}</small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </section>
      </div>
      <section>
        <div className="section-head outside">
          <div>
            <span className="kicker">KNOWLEDGE LIBRARY</span>
            <h2>Trading references</h2>
          </div>
        </div>
        <div className="library-grid">
          {[
            ["Trading glossary", "142 essential terms", "book"],
            ["Candlestick library", "24 formations explained", "chart"],
            ["Chart patterns", "16 continuation & reversal patterns", "trend"],
            ["Market structure", "Core concepts and diagrams", "tool"],
            ["Psychology resources", "Build process-driven discipline", "users"],
            ["Trading checklists", "Pre-market and execution templates", "check"],
          ].map(([t, s, i]) => (
            <button className="card library-card" key={t}>
              <span className="metric-icon">
                <Icon name={i as IconName} />
              </span>
              <strong>{t}</strong>
              <small>{s}</small>
              <span className="open-link">
                Open resource <Icon name="arrow" size={14} />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Community() {
  return (
    <div className="page-stack">
      <PageTitle
        kicker="COMMUNITY"
        title="Learn in good company."
        description="Ask better questions, share thoughtful analysis and grow alongside serious traders."
        action={<Button icon="plus">Start discussion</Button>}
      />
      <div className="community-grid">
        <section className="feed">
          <div className="tab-line">
            <button className="active">Latest</button>
            <button>Following</button>
            <button>Unanswered</button>
          </div>
          {[
            [
              "AM",
              "Alicia Morgan",
              "How I map weekly liquidity before Monday open",
              "I’ve refined this process over the last month. Here is the exact sequence I use before marking lower timeframes…",
              "Technical Analysis",
              "24 replies",
            ],
            [
              "TK",
              "Theo King",
              "Question about displacement after a sweep",
              "When the candle closes strongly but immediately retraces 50%, do you still classify this as valid displacement?",
              "Teacher Q&A",
              "8 replies",
            ],
            [
              "JS",
              "Jordan Blake",
              "June review: fewer trades, better outcomes",
              "Sharing my biggest lesson from this month: waiting for alignment has improved both my win rate and my mindset.",
              "Trading Psychology",
              "31 replies",
            ],
          ].map((p, i) => (
            <article className="card post" key={p[2]}>
              <div className="post-top">
                <div className={`avatar av-${i}`}>{p[0]}</div>
                <div>
                  <strong>
                    {p[1]} {i === 1 && <span className="verified">EDUCATOR</span>}
                  </strong>
                  <small>2h ago · {p[4]}</small>
                </div>
                <button className="icon-btn">
                  <Icon name="more" />
                </button>
              </div>
              <h2>{p[2]}</h2>
              <p>{p[3]}</p>
              <div className="post-foot">
                <button>△ {12 + i * 9}</button>
                <button>
                  <Icon name="message" size={15} /> {p[5]}
                </button>
                <button>Bookmark</button>
              </div>
            </article>
          ))}
        </section>
        <aside className="community-side">
          <section className="card">
            <span className="kicker">LIVE NOW</span>
            <h3>London session breakdown</h3>
            <p>Marcus is reviewing today’s EUR/USD execution.</p>
            <div className="live-row">
              <span className="live-dot" /> 84 watching
            </div>
            <Button icon="play">Join session</Button>
          </section>
          <section className="card guidelines">
            <span className="kicker">COMMUNITY STANDARD</span>
            <h3>Process over predictions.</h3>
            <p>
              Be constructive, protect privacy and never present trade ideas as financial advice.
            </p>
            <button>
              Read community guidelines <Icon name="arrow" size={14} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Certificates() {
  return (
    <div className="page-stack">
      <PageTitle
        kicker="ACHIEVEMENTS"
        title="Proof of progress."
        description="Certificates are issued only after all learning and assessment requirements are satisfied."
      />
      <div className="certificate-grid">
        <div className="certificate">
          <div className="cert-inner">
            <Logo />
            <span>ACADEMY CERTIFICATE</span>
            <p>This certifies that</p>
            <h2>Jordan Blake</h2>
            <p>has successfully completed</p>
            <h3>Forex Foundations</h3>
            <div className="cert-bottom">
              <span>
                ISSUED 12 MAY 2025
                <br />
                <strong>JJA-FF-2025-00842</strong>
              </span>
              <div className="seal">JJ</div>
              <span>
                AUTHORISED BY
                <br />
                <strong>JOSHJTRADEZ ACADEMY</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="cert-info card">
          <span className="status">VERIFIED</span>
          <h1>Forex Foundations</h1>
          <p>Completed with a final assessment score of 91%.</p>
          <dl>
            <div>
              <dt>Issued to</dt>
              <dd>Jordan Blake</dd>
            </div>
            <div>
              <dt>Completion date</dt>
              <dd>12 May 2025</dd>
            </div>
            <div>
              <dt>Credential ID</dt>
              <dd className="mono">JJA-FF-2025-00842</dd>
            </div>
          </dl>
          <Button icon="download">Download PDF</Button>
          <Button variant="outline" icon="arrow">
            Share credential
          </Button>
          <div className="verify-note">
            <Icon name="shield" />
            <span>
              <strong>Cryptographically verifiable</strong>
              <small>Scan the QR code or use the credential ID.</small>
            </span>
            <div className="qr">▦</div>
          </div>
        </div>
      </div>
      <section>
        <div className="section-head outside">
          <div>
            <span className="kicker">IN PROGRESS</span>
            <h2>Next credentials</h2>
          </div>
        </div>
        <div className="cert-progress card">
          <div>
            <span className="metric-icon">
              <Icon name="award" />
            </span>
            <div>
              <strong>Technical Analysis Mastery</strong>
              <p>Course 68% · Assessment requirement: 80%</p>
            </div>
          </div>
          <div>
            <Progress value={68} />
            <span>68%</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function GenericPage({
  role,
  page,
  toast,
}: {
  role: Role;
  page: string;
  toast: (s: string) => void;
}) {
  const singular = page.endsWith("s") ? page.slice(0, -1) : page;
  const people = page === "Students" || page === "Staff" || page === "Teachers";
  const security =
    page.includes("Security") || page.includes("Permissions") || page.includes("Audit");
  const finance = page.includes("Finance") || page.includes("Revenue") || page.includes("Payment");
  const title = page;
  const rows = people
    ? [
        ["Jordan Blake", "jordan.blake@example.com", "Pro Academy", "Active"],
        ["Maya Singh", "maya.singh@example.com", "Technical Analysis", "Active"],
        ["Theo Martin", "theo.martin@example.com", "Forex Foundations", "Review"],
        ["Amara Lewis", "amara.lewis@example.com", "Trading Psychology", "Active"],
      ]
    : security
      ? [
          ["24 Jun · 10:42", "Login verified", "Jordan Blake", "London, UK"],
          ["24 Jun · 10:31", "Permission updated", "Amelia Reed", "Admin portal"],
          ["24 Jun · 09:58", "MFA challenge passed", "Marcus Hill", "Manchester, UK"],
          ["24 Jun · 09:41", "Resource access denied", "Unknown session", "Blocked"],
        ]
      : [
          ["Technical Analysis Mastery", "Marcus Hill", "842 enrolled", "Published"],
          ["Forex Foundations", "Marcus Hill", "1,204 enrolled", "Published"],
          ["Trading Psychology", "Simone Reed", "626 enrolled", "Published"],
          ["Institutional Risk Management", "—", "Draft", "Review"],
        ];
  return (
    <div className="page-stack">
      <PageTitle
        kicker={`${role.toUpperCase()} PORTAL`}
        title={title}
        description={`Manage ${page.toLowerCase()} with complete visibility, clear status and role-based controls.`}
        action={
          <Button icon="plus" onClick={() => toast(`${singular} workflow opened`)}>
            Add {singular.toLowerCase()}
          </Button>
        }
      />
      <div className="metrics-grid compact">
        <Metric
          label={finance ? "Period total" : "Total records"}
          value={finance ? "£62.8K" : "1,284"}
          change="+8.2%"
          icon={finance ? "wallet" : "grid"}
        />
        <Metric label="Active" value="1,126" change="+4.8%" icon="check" />
        <Metric label="Needs attention" value="18" change="-12.1%" icon="bell" />
        <Metric label="Updated today" value="42" change="+16" icon="clock" />
      </div>
      <section className="card table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder={`Search ${page.toLowerCase()}...`} />
          </div>
          <div className="actions">
            <Button variant="outline" icon="filter">
              Filter
            </Button>
            <Button variant="outline" icon="download">
              Export
            </Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["Name / event", "Details", "Scope", "Status", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <td>
                    <strong>{r[0]}</strong>
                  </td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>
                    <span
                      className={`status ${r[3] === "Review" || r[3] === "Blocked" ? "amber" : ""}`}
                    >
                      {r[3]}
                    </span>
                  </td>
                  <td>
                    <button className="icon-btn">
                      <Icon name="more" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>Showing 1–4 of 1,284</span>
          <div>
            <button>←</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>→</button>
          </div>
        </div>
      </section>
      <div className="prototype-banner">
        <Icon name="shield" />
        <div>
          <strong>Prototype environment</strong>
          <p>
            Actions demonstrate the intended workflow. Persistent data, payment verification and
            server-side authorisation require the planned production backend.
          </p>
        </div>
      </div>
    </div>
  );
}

function BillingPage() {
  return (
    <div className="page-stack">
      <PageTitle
        kicker="PURCHASES & ACCESS"
        title="Your academy access."
        description="One account for every course, receipt and subscription."
      />
      <div className="access-card card">
        <div>
          <span className="status">ACTIVE</span>
          <h2>Pro Academy Membership</h2>
          <p>Full access to 3 purchased courses and all member resources.</p>
        </div>
        <div>
          <span>NEXT BILLING DATE</span>
          <strong>12 July 2025</strong>
          <Button variant="outline">Manage subscription</Button>
        </div>
      </div>
      <section className="card table-card">
        <div className="section-head">
          <div>
            <span className="kicker">BILLING HISTORY</span>
            <h2>Payments & receipts</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                ["12 Jun 2025", "Pro Academy Membership", "•••• 4242", "£89.00", "Paid"],
                ["12 May 2025", "Pro Academy Membership", "•••• 4242", "£89.00", "Paid"],
                ["04 Apr 2025", "Forex Foundations", "•••• 4242", "£249.00", "Paid"],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td>
                    <strong>{r[1]}</strong>
                  </td>
                  <td className="mono">{r[2]}</td>
                  <td className="mono">{r[3]}</td>
                  <td>
                    <span className="status">{r[4]}</span>
                  </td>
                  <td>
                    <button className="text-btn">
                      <Icon name="download" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PageTitle({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
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

function WireframeMiniature({
  role,
  item,
  onOpen,
}: {
  role: Role;
  item: NavItem;
  onOpen: () => void;
}) {
  const isData =
    item.icon === "chart" ||
    item.icon === "wallet" ||
    item.label.includes("analytics") ||
    item.label.includes("Reports");
  const isLearning =
    item.icon === "book" ||
    item.label.includes("course") ||
    item.label.includes("Academy") ||
    item.label.includes("builder");
  const isCommunication =
    item.icon === "message" || item.label.includes("Community") || item.label.includes("Support");

  return (
    <button className="wf-screen" onClick={onOpen}>
      <div className="wf-screen-canvas">
        <div className="wf-mini-side">
          <i />
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <span className={n === 2 ? "active" : ""} key={n} />
          ))}
        </div>
        <div className="wf-mini-main">
          <div className="wf-mini-top">
            <span />
            <i />
            <i />
          </div>
          <div className="wf-mini-content">
            <div className="wf-mini-title">
              <strong />
              <span />
            </div>
            {isData ? (
              <>
                <div className="wf-mini-metrics">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="wf-mini-panels">
                  <div className="wf-mini-chart">
                    {[36, 58, 45, 72, 61, 84, 68].map((height, index) => (
                      <i key={index} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <div className="wf-mini-list">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </>
            ) : isLearning ? (
              <>
                <div className="wf-mini-hero">
                  <span />
                  <i />
                </div>
                <div className="wf-mini-cards">
                  <i />
                  <i />
                  <i />
                </div>
              </>
            ) : isCommunication ? (
              <div className="wf-mini-feed">
                <i />
                <i />
                <i />
              </div>
            ) : (
              <>
                <div className="wf-mini-toolbar">
                  <span />
                  <i />
                  <i />
                </div>
                <div className="wf-mini-table">
                  {[1, 2, 3, 4].map((n) => (
                    <i key={n} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="wf-screen-meta">
        <span className="wf-page-icon">
          <Icon name={item.icon} size={14} />
        </span>
        <span>
          <strong>{item.label}</strong>
          <small>
            /{role}/{item.label.toLowerCase().replace(/ /g, "-")}
          </small>
        </span>
        <Icon name="arrow" size={14} />
      </div>
    </button>
  );
}

function WireframeBoard({ openPage }: { openPage: (role: Role, page: string) => void }) {
  const [filter, setFilter] = useState<"all" | Role>("all");
  const roles: Role[] = ["owner", "admin", "teacher", "student"];
  const visibleRoles = filter === "all" ? roles : [filter];
  const total = roles.reduce((sum, role) => sum + nav[role].length, 0);

  return (
    <div className="wireframe-board">
      <header className="wf-board-head">
        <div>
          <span className="kicker">COMPLETE PRODUCT WIREFRAMES</span>
          <h1>All portals. All pages.</h1>
          <p>
            A complete low-fidelity map of the JoshJTradez academy. Select any frame to open the
            full interactive page.
          </p>
        </div>
        <div className="wf-count">
          <strong>{total}</strong>
          <span>CONNECTED SCREENS</span>
        </div>
      </header>
      <div className="wf-board-toolbar">
        <div className="wf-filters">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            All portals
          </button>
          {roles.map((role) => (
            <button
              className={filter === role ? "active" : ""}
              onClick={() => setFilter(role)}
              key={role}
            >
              {role}
            </button>
          ))}
        </div>
        <span>Desktop wireframes · Responsive layouts included</span>
      </div>
      {visibleRoles.map((role) => (
        <section className="wf-portal" key={role}>
          <div className="wf-portal-heading">
            <div className={`wf-role-mark ${role}`}>{roleMeta[role].initials}</div>
            <div>
              <span>{role.toUpperCase()} PORTAL</span>
              <h2>{roleMeta[role].sub} workspace</h2>
            </div>
            <p>{nav[role].length} connected pages</p>
          </div>
          <div className="wf-screen-grid">
            {nav[role].map((item) => (
              <WireframeMiniature
                role={role}
                item={item}
                onOpen={() => openPage(role, item.label)}
                key={item.label}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("student");
  const [page, setPage] = useState("Overview");
  const [wireframe, setWireframe] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [toastText, setToastText] = useState("");
  const navigate = (next: string) => {
    setPage(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const switchRole = (r: Role) => {
    setRole(r);
    setPage("Overview");
    setRoleOpen(false);
    setMobileOpen(false);
  };
  const openWireframe = (nextRole: Role, nextPage: string) => {
    setRole(nextRole);
    setPage(nextPage);
    setWireframe(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toast = (s: string) => {
    setToastText(s);
    window.setTimeout(() => setToastText(""), 2800);
  };

  let content: React.ReactNode;
  if (page === "All wireframes") content = <WireframeBoard openPage={openWireframe} />;
  else if (page === "Overview") content = <Dashboard role={role} navigate={navigate} />;
  else if (role === "student" && page === "My academy")
    content = <AcademyPage navigate={navigate} />;
  else if (role === "student" && page === "Lesson player")
    content = <LessonPage navigate={navigate} />;
  else if (role === "student" && page === "Trading journal")
    content = <TradingJournal toast={toast} />;
  else if (role === "student" && page === "Learning journal")
    content = <LearningJournal toast={toast} />;
  else if (role === "student" && page === "Toolkit") content = <Toolkit />;
  else if (role === "student" && page === "Community") content = <Community />;
  else if (role === "student" && page === "Certificates") content = <Certificates />;
  else if (role === "student" && page === "Billing & access") content = <BillingPage />;
  else content = <GenericPage role={role} page={page} toast={toast} />;

  return (
    <div className={`app-shell ${wireframe ? "wireframe" : "finished-design"}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="side-logo">
          <Logo />
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        <nav>
          <span className="nav-label">{role === "student" ? "LEARN" : "WORKSPACE"}</span>
          {nav[role].map((item) => (
            <button
              key={item.label}
              className={page === item.label ? "active" : ""}
              onClick={() => navigate(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Messages" && <b>3</b>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="upgrade">
            <span className="kicker">ACADEMY PRO</span>
            <strong>
              {role === "student" ? "Next live class in 2h" : "System status: healthy"}
            </strong>
            <Progress value={role === "student" ? 72 : 98} />
            <small>{role === "student" ? "Weekly goal 72%" : "All services operational"}</small>
          </div>
          <button className="profile-mini">
            <div className="avatar">{roleMeta[role].initials}</div>
            <span>
              <strong>{roleMeta[role].name}</strong>
              <small>{roleMeta[role].sub}</small>
            </span>
            <Icon name="more" size={17} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <button className="icon-btn" onClick={() => setMobileOpen(true)}>
              <Icon name="menu" />
            </button>
            <Logo compact />
          </div>
          <div className="crumb">
            <span>{role} portal</span>
            <Icon name="chevron" size={13} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <button
              className={`all-screens-trigger ${page === "All wireframes" ? "active" : ""}`}
              onClick={() => {
                setWireframe(true);
                navigate("All wireframes");
              }}
            >
              <Icon name="grid" size={15} />
              <span>All wireframes</span>
            </button>
            <div className="design-mode" aria-label="Design presentation mode">
              <button
                className={wireframe ? "active" : ""}
                onClick={() => setWireframe(true)}
                aria-pressed={wireframe}
              >
                Wireframe
              </button>
              <button
                className={!wireframe ? "active" : ""}
                onClick={() => setWireframe(false)}
                aria-pressed={!wireframe}
              >
                Final
              </button>
            </div>
            <button className="search-trigger">
              <Icon name="search" />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="popover-wrap">
              <button
                className="icon-btn notification"
                onClick={() => setNotifications(!notifications)}
              >
                <Icon name="bell" />
                <i />
              </button>
              {notifications && (
                <div className="popover notifications">
                  <div className="section-head">
                    <h3>Notifications</h3>
                    <span>3 new</span>
                  </div>
                  {[
                    "Your live class starts in 2 hours",
                    "Marcus replied to your question",
                    "Assessment result is ready",
                  ].map((n, i) => (
                    <button key={n}>
                      <span className={i === 0 ? "unread" : ""} />
                      <div>
                        <strong>{n}</strong>
                        <small>{i + 1}h ago</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="role-wrap">
              <button className="role-trigger" onClick={() => setRoleOpen(!roleOpen)}>
                <span>{roleMeta[role].initials}</span>
                <div>
                  <small>VIEW AS</small>
                  <strong>{role[0].toUpperCase() + role.slice(1)}</strong>
                </div>
                <Icon name="chevron" size={14} />
              </button>
              {roleOpen && (
                <div className="popover role-menu">
                  {(["student", "teacher", "admin", "owner"] as Role[]).map((r) => (
                    <button
                      className={role === r ? "active" : ""}
                      key={r}
                      onClick={() => switchRole(r)}
                    >
                      <span>{roleMeta[r].initials}</span>
                      <div>
                        <strong>{r[0].toUpperCase() + r.slice(1)} portal</strong>
                        <small>{roleMeta[r].name}</small>
                      </div>
                      {role === r && <Icon name="check" size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={page === "Lesson player" ? "lesson-page-wrap" : ""}>{content}</main>
      </div>
      {toastText && (
        <div className="toast">
          <span>
            <Icon name="check" size={16} />
          </span>
          {toastText}
        </div>
      )}
    </div>
  );
}
