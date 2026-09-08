"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Requests stay same-origin in the browser; Next proxies them to the private backend.
const api = "";
const colors = [
  "#ef5b5b",
  "#f39a4b",
  "#48b982",
  "#5d8cff",
  "#a679f7",
  "#e575b3",
  "#e6bd4d",
];
type View =
  | "dashboard"
  | "employees"
  | "statistics"
  | "statistics-employees"
  | "statistics-departments"
  | "statistics-activity"
  | "statistics-sources"
  | "training"
  | "materials"
  | "integrations"
  | "review"
  | "dictionaries"
  | "users"
  | "audit"
  | "settings"
  | "unresolved";
type Activity = {
  id: string;
  code: string;
  name: string;
  weekQuantity: number;
  monthQuantity: number;
};
type Analytics = {
  employees: {
    id: string;
    gameName: string;
    rank: string;
    position: string;
    department: string;
    total: number;
    activity: { name: string; quantity: number }[];
  }[];
  departments: { name: string; total: number; employees: number }[];
  dynamics: { label: string; quantity: number }[];
  activityTypes: string[];
};
type Dashboard = {
  activeEmployees: number;
  reviewMessages: number;
  collector: { status: string; lastHeartbeatAt: string | null };
  activity: Activity[];
};
type Employee = {
  id: string;
  gameName: string;
  discordDisplayName?: string;
  rank?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
  positionRaw?: string | null;
  department?: { id: string; code: string } | null;
  active: boolean;
};
type ActivityDetail = {
  id: string;
  occurredAt: string;
  quantity: number;
  employee: { gameName: string; department?: { code: string } | null };
  activityType: { name: string };
  message?: { url?: string | null; textRaw: string; authorRaw: string } | null;
};
type Source = {
  id: string;
  name: string;
  guildId: string;
  channelId: string;
  parserMode: string;
  countMode: string;
  lookbackDays: number | null;
  enabled: boolean;
  rules: { activityType: { id: string; name: string } | null }[];
};
type ScanRequest = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  recentDays: number;
  limit: number;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  source?: { name: string } | null;
  result?: { source: string; scanned: number; accepted: number }[] | null;
};
type Dictionary = {
  activityTypes: { id: string; name: string }[];
  departments: { id: string; code: string; name: string }[];
  positions: { id: string; name: string }[];
  ranks: { id: string; name: string }[];
};
type Review = {
  items: {
    id: string;
    authorRaw: string;
    textRaw: string;
    status: string;
    errorCode?: string | null;
    messageTimestamp: string;
    discordSource: { name: string };
  }[];
  total: number;
};
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith("rmrp_csrf="))
    ?.split("=")[1] ?? "";
const icon = (name: string) => (
  <span className="nav-icon" aria-hidden="true">
    {name}
  </span>
);
const nav: { view: View; label: string; glyph: string; admin?: boolean }[] = [
  { view: "dashboard", label: "Главная", glyph: "⌂" },
  { view: "employees", label: "Сотрудники", glyph: "◉" },
  { view: "statistics", label: "Общий отчет", glyph: "↗" },
  { view: "statistics-employees", label: "Отчет: сотрудники", glyph: "▥" },
  { view: "statistics-departments", label: "Отчет: подразделения", glyph: "▦" },
  { view: "statistics-activity", label: "Отчет: активность", glyph: "◈" },
  { view: "statistics-sources", label: "Источники отчета", glyph: "⌁" },
  { view: "training", label: "Обучение", glyph: "▣" },
  { view: "materials", label: "Материалы", glyph: "▤" },
  { view: "integrations", label: "Интеграции", glyph: "⌁", admin: true },
  { view: "review", label: "Проверка данных", glyph: "!", admin: true },
  { view: "unresolved", label: "Неразобрано", glyph: "?", admin: true },
  { view: "dictionaries", label: "Справочники", glyph: "◇", admin: true },
  { view: "users", label: "Пользователи", glyph: "◌", admin: true },
  { view: "audit", label: "Аудит", glyph: "≡", admin: true },
  { view: "settings", label: "Настройки", glyph: "⚙", admin: true },
];

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">—</div>
      <strong>{title}</strong>
      <span>{text}</span>
      {action && <button className="button secondary">{action}</button>}
    </div>
  );
}
function StateCard({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <div className={error ? "state error-state" : "state"}>
      {error ? (
        <>
          <strong>Не удалось получить данные</strong>
          <span>{error}</span>
          <button className="button secondary" onClick={retry}>
            Повторить
          </button>
        </>
      ) : (
        <>
          <i />
          <i />
          <i />
        </>
      )}
    </div>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "good" | "warn" | "danger" | "neutral";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function MetricCard({
  label,
  value,
  index,
  note,
}: {
  label: string;
  value: number;
  index: number;
  note?: string;
}) {
  return (
    <article
      className="metric"
      style={
        { "--metric": colors[index % colors.length] } as React.CSSProperties
      }
    >
      <div>
        <span>{label}</span>
        <strong>{value.toLocaleString("ru-RU")}</strong>
      </div>
      <small>{note ?? "За выбранный период"}</small>
    </article>
  );
}
function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="data-table">
      <table>{children}</table>
    </div>
  );
}

export default function Home() {
  const initialView =
    typeof window === "undefined"
      ? "dashboard"
      : ((new URLSearchParams(window.location.search).get(
          "section",
        ) as View | null) ?? "dashboard");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>(
    nav.some((item) => item.view === initialView) ? initialView : "dashboard",
  );
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [scanRequests, setScanRequests] = useState<ScanRequest[]>([]);
  const [activityDetails, setActivityDetails] = useState<ActivityDetail[]>([]);
  const [unresolved, setUnresolved] = useState<{
    users: {
      authorRaw: string;
      sourceNames: string[];
      messages: number;
      lastMessageAt: string;
    }[];
    employeeDetails: {
      employeeId: string;
      gameName: string;
      discordDisplayName: string;
      positionRaw?: string | null;
      departmentRaw: string;
      sourceName?: string | null;
      lastMessageAt?: string | null;
    }[];
  }>({ users: [], employeeDetails: [] });
  const fetchJson = async <T,>(url: string) => {
    const response = await fetch(`${api}${url}`, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  async function loadDashboard(next = period) {
    setLoading(true);
    setError("");
    try {
      const [summary, report, details] = await Promise.all([
        fetchJson<Dashboard>("/api/dashboard"),
        fetchJson<Analytics>(`/api/leadership/analytics?period=${next}`),
        fetchJson<ActivityDetail[]>(`/api/activity-details?period=${next}`),
      ]);
      setDashboard(summary);
      setAnalytics(report);
      setActivityDetails(details);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }
  async function loadView(next = view) {
    setError("");
    try {
      if (next === "employees") {
        const [value, dictionaryValue] = await Promise.all([
          fetchJson<{ items: Employee[]; total: number }>("/api/employees"),
          fetchJson<Dictionary>("/api/dictionaries"),
        ]);
        setEmployees(value.items);
        setEmployeeTotal(value.total);
        setDictionary(dictionaryValue);
      }
      if (next === "integrations") {
        const [sourceValue, dictionaryValue, requestValue] = await Promise.all([
          fetchJson<Source[]>("/api/admin/discord-sources"),
          fetchJson<Dictionary>("/api/dictionaries"),
          fetchJson<ScanRequest[]>("/api/admin/integrations/scan-requests"),
        ]);
        setSources(sourceValue);
        setDictionary(dictionaryValue);
        setScanRequests(requestValue);
      }
      if (next === "review")
        setReview(await fetchJson<Review>("/api/admin/integrations/review"));
      if (next === "unresolved") {
        const [value, dictionaryValue] = await Promise.all([
          fetchJson<{
            users: {
              authorRaw: string;
              sourceNames: string[];
              messages: number;
              lastMessageAt: string;
            }[];
            employeeDetails: {
              employeeId: string;
              gameName: string;
              discordDisplayName: string;
              positionRaw?: string | null;
              departmentRaw: string;
              sourceName?: string | null;
              lastMessageAt?: string | null;
            }[];
          }>("/api/admin/integrations/unresolved"),
          fetchJson<Dictionary>("/api/dictionaries"),
        ]);
        setUnresolved(value);
        setDictionary(dictionaryValue);
      }
      if (next === "dictionaries")
        setDictionary(await fetchJson<Dictionary>("/api/dictionaries"));
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "HTTP 403"
          ? "Недостаточно прав для этого раздела."
          : "Не удалось получить данные раздела.",
      );
    }
  }
  useEffect(() => {
    void loadDashboard();
  }, []);
  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).get(
        "section",
      ) as View | null;
      if (next && nav.some((item) => item.view === next)) setView(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (authenticated) void loadDashboard(period);
  }, [period]);
  useEffect(() => {
    if (authenticated) void loadView(view);
  }, [view, authenticated]);
  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`${api}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      setError("Неверные учетные данные.");
      return;
    }
    await loadDashboard();
  }
  async function logout() {
    await fetch(`${api}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrf() },
    });
    setAuthenticated(false);
    setDashboard(null);
    setAnalytics(null);
    setEmployees([]);
    setSources([]);
    setReview(null);
    setSelectedEmployee(null);
  }
  function go(next: View) {
    window.history.pushState({}, "", `/?section=${next}`);
    setView(next);
    setSelectedEmployee(null);
    setMenu(false);
  }
  async function updateSource(id: string, values: Record<string, unknown>) {
    const response = await fetch(`${api}/api/admin/discord-sources/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error("save");
    await loadView("integrations");
  }
  async function requestScan(sourceId?: string) {
    setScanNote("Запускаем read-only сбор...");
    const response = await fetch(
      `${api}/api/admin/integrations/scan-requests`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ sourceId, recentDays: 3, limit: 20 }),
      },
    );
    if (response.ok) {
      setScanNote(
        "Задача передана collector. Он возьмет ее автоматически в течение минуты: до 20 сообщений за 3 дня.",
      );
      await loadView("integrations");
    } else
      setScanNote("Не удалось создать задачу. Проверьте права администратора.");
  }
  async function updateEmployee(id: string, values: Record<string, unknown>) {
    const response = await fetch(`${api}/api/employees/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error("employee update");
    const updated = (await response.json()) as Employee;
    setEmployees((current) =>
      current.map((employee) => (employee.id === id ? updated : employee)),
    );
    setSelectedEmployee(updated);
    await loadDashboard();
  }
  if (!authenticated)
    return (
      <main className="login-page">
        <section className="login-brand">
          <div className="crest">У</div>
          <p>RMRP / УФСБ</p>
          <h1>
            Контур
            <br />
            управления.
          </h1>
          <span>Внутренний портал организации</span>
        </section>
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">ЗАЩИЩЕННЫЙ ВХОД</p>
          <h2>Авторизация</h2>
          <label>
            Логин
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button">
            Войти в систему <b>→</b>
          </button>
        </form>
      </main>
    );
  const filteredEmployees = employees.filter((employee) =>
    `${employee.gameName} ${employee.discordDisplayName ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="crest">У</div>
          <div>
            <b>RMRP | УФСБ</b>
            <span>Управление</span>
          </div>
        </div>
        <nav>
          {nav
            .filter((item) => !item.admin)
            .map((item) => (
              <button
                key={item.view}
                className={view === item.view ? "active" : ""}
                onClick={() => go(item.view)}
              >
                {icon(item.glyph)}
                {item.label}
              </button>
            ))}
          <p>АДМИНИСТРИРОВАНИЕ</p>
          {nav
            .filter((item) => item.admin)
            .map((item) => (
              <button
                key={item.view}
                className={view === item.view ? "active" : ""}
                onClick={() => go(item.view)}
              >
                {icon(item.glyph)}
                {item.label}
              </button>
            ))}
        </nav>
        <div className="sidebar-foot">
          <Badge
            tone={dashboard?.collector.status === "ONLINE" ? "good" : "warn"}
          >
            {dashboard?.collector.status === "ONLINE"
              ? "Collector online"
              : "Collector inactive"}
          </Badge>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Открыть меню"
            onClick={() => setMenu(!menu)}
          >
            ☰
          </button>
          <label className="global-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по сотрудникам, материалам, событиям..."
            />
          </label>
          <div className="top-actions">
            <button className="bell" aria-label="Уведомления">
              ◌
            </button>
            <div className="identity">
              <div>А</div>
              <span>
                <b>Администратор</b>
                <small>Руководитель</small>
                <button className="logout" onClick={() => void logout()}>
                  Выйти
                </button>
              </span>
            </div>
          </div>
        </header>
        <main className="content">
          {selectedEmployee ? (
            <EmployeeProfile
              employee={selectedEmployee}
              close={() => setSelectedEmployee(null)}
              dictionary={dictionary}
              onSave={updateEmployee}
            />
          ) : error ? (
            <StateCard
              error={error}
              retry={() => {
                setError("");
                void loadView(view);
              }}
            />
          ) : (
            renderView({
              view,
              go,
              dashboard,
              analytics,
              period,
              setPeriod,
              loading,
              employees: filteredEmployees,
              employeeTotal,
              sources,
              dictionary,
              review,
              updateSource,
              selectEmployee: setSelectedEmployee,
              requestScan,
              scanNote,
              scanRequests,
              unresolved,
              activityDetails,
            })
          )}
        </main>
      </div>
    </div>
  );
}

function renderView(props: {
  view: View;
  go: (view: View) => void;
  dashboard: Dashboard | null;
  analytics: Analytics | null;
  period: "week" | "month";
  setPeriod: (value: "week" | "month") => void;
  loading: boolean;
  employees: Employee[];
  employeeTotal: number;
  sources: Source[];
  dictionary: Dictionary | null;
  review: Review | null;
  updateSource: (id: string, values: Record<string, unknown>) => Promise<void>;
  selectEmployee: (employee: Employee) => void;
  requestScan: (sourceId?: string) => Promise<void>;
  scanNote: string;
  scanRequests: ScanRequest[];
  activityDetails: ActivityDetail[];
  unresolved: {
    users: {
      authorRaw: string;
      sourceNames: string[];
      messages: number;
      lastMessageAt: string;
    }[];
    employeeDetails: {
      employeeId: string;
      gameName: string;
      discordDisplayName: string;
      positionRaw?: string | null;
      departmentRaw: string;
      sourceName?: string | null;
      lastMessageAt?: string | null;
    }[];
  };
}) {
  if (props.view === "dashboard") return <DashboardView {...props} />;
  if (props.view === "employees") return <EmployeesView {...props} />;
  if (
    props.view === "statistics" ||
    props.view === "statistics-employees" ||
    props.view === "statistics-departments" ||
    props.view === "statistics-activity" ||
    props.view === "statistics-sources"
  )
    return <StatisticsView {...props} />;
  if (props.view === "integrations") return <IntegrationsView {...props} />;
  if (props.view === "review") return <ReviewView {...props} />;
  if (props.view === "unresolved") return <UnresolvedView {...props} />;
  if (props.view === "dictionaries") return <DictionariesView {...props} />;
  const titles: Record<string, [string, string]> = {
    training: ["Обучение", "Тесты, аттестации и результаты обучения"],
    materials: ["Материалы", "Справочные и методические материалы"],
    users: ["Пользователи", "Учетные записи и роли портала"],
    audit: ["Аудит", "Неизменяемая история действий"],
    settings: ["Настройки", "Рабочие параметры портала"],
  };
  const [title, subtitle] = titles[props.view];
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="panel">
        <EmptyState
          title="Раздел готов к подключению данных"
          text="Интерфейс и навигация подготовлены. Данные появятся после подключения соответствующего серверного API."
        />
      </section>
    </>
  );
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="page-header">
      <div>
        <p className="eyebrow">УФСБ RMRP / ВНУТРЕННИЙ ПОРТАЛ</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
      {action}
    </section>
  );
}
function DashboardView({
  dashboard,
  analytics,
  period,
  setPeriod,
  loading,
  activityDetails,
}: any) {
  const current = dashboard?.activity ?? [];
  const total = current.reduce(
    (sum: number, item: Activity) =>
      sum + (period === "week" ? item.weekQuantity : item.monthQuantity),
    0,
  );
  const donut = current.map((item: Activity, index: number) => ({
    name: item.name,
    value: period === "week" ? item.weekQuantity : item.monthQuantity,
    color: colors[index % colors.length],
  }));
  const top = (analytics?.employees ?? [])
    .slice(0, 8)
    .map((employee: any) => ({
      name: employee.gameName,
      total: employee.total,
    }));
  return (
    <>
      <PageHeader
        title="Главная — Дашборд"
        subtitle="Сводная информация по деятельности УФСБ"
        action={
          <div className="period">
            <button
              className={period === "week" ? "selected" : ""}
              onClick={() => setPeriod("week")}
            >
              7 дней
            </button>
            <button
              className={period === "month" ? "selected" : ""}
              onClick={() => setPeriod("month")}
            >
              30 дней
            </button>
          </div>
        }
      />
      {dashboard?.collector.status !== "ONLINE" && (
        <div className="collector-warning">
          <b>Discord Collector не активен.</b>
          <span>
            Статистика может быть неактуальной. Запустите сбор вручную после
            авторизации.
          </span>
        </div>
      )}
      <section className="metrics">
        <MetricCard
          label="Сотрудники"
          value={dashboard?.activeEmployees ?? 0}
          index={0}
          note="Активный состав"
        />
        {current.map((item: Activity, index: number) => (
          <MetricCard
            key={item.id}
            label={item.name}
            value={period === "week" ? item.weekQuantity : item.monthQuantity}
            index={index + 1}
          />
        ))}
      </section>
      {loading || !analytics ? (
        <StateCard />
      ) : (
        <>
          <section className="dashboard-grid">
            <article className="panel chart-panel wide">
              <PanelTitle eyebrow="ДИНАМИКА" title="Активность по дням" />
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.dynamics}>
                  <CartesianGrid vertical={false} stroke="#273041" />
                  <XAxis dataKey="label" stroke="#788399" />
                  <YAxis allowDecimals={false} stroke="#788399" />
                  <Tooltip
                    contentStyle={{
                      background: "#151c28",
                      border: "1px solid #303b50",
                    }}
                  />
                  <Legend />
                  {current.map((item: Activity, index: number) => (
                    <Line
                      key={item.id}
                      type="monotone"
                      dataKey="quantity"
                      name={index === 0 ? "Все действия" : item.name}
                      stroke={index === 0 ? "#6d8cff" : colors[index]}
                      hide={index !== 0}
                      strokeWidth={3}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </article>
            <article className="panel chart-panel">
              <PanelTitle eyebrow="РАСПРЕДЕЛЕНИЕ" title="Виды активности" />
              <div className="donut">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {donut.map((item: any) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#151c28",
                        border: "1px solid #303b50",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-total">
                  <b>{total}</b>
                  <span>Всего</span>
                </div>
              </div>
              <div className="legend">
                {donut.map((item: any) => (
                  <span key={item.name}>
                    <i style={{ background: item.color }} />
                    {item.name}
                    <b>{total ? Math.round((item.value / total) * 100) : 0}%</b>
                  </span>
                ))}
              </div>
            </article>
            <article className="panel chart-panel wide">
              <PanelTitle
                eyebrow="РЕЙТИНГ"
                title="Топ сотрудников по активности"
              />
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top} layout="vertical">
                  <CartesianGrid horizontal={false} stroke="#273041" />
                  <XAxis type="number" stroke="#788399" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    stroke="#b8c2d5"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#151c28",
                      border: "1px solid #303b50",
                    }}
                  />
                  <Bar dataKey="total" fill="#6d8cff" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
            <RecentEvents events={activityDetails} />
          </section>
        </>
      )}
    </>
  );
}
function StatisticsView({
  view,
  dashboard,
  analytics,
  period,
  setPeriod,
  loading,
  selectEmployee,
  activityDetails,
}: any) {
  const [activityFilter, setActivityFilter] = useState("");
  const activity = dashboard?.activity ?? [];
  const total = activity.reduce(
    (sum: number, item: Activity) =>
      sum + (period === "week" ? item.weekQuantity : item.monthQuantity),
    0,
  );
  const employeeRows = analytics?.employees ?? [];
  const departmentRows = analytics?.departments ?? [];
  const details = activityDetails.filter(
    (event: ActivityDetail) =>
      !activityFilter || event.activityType.name === activityFilter,
  );
  const labels: Record<string, [string, string]> = {
    statistics: [
      "Общий отчет",
      "Ключевые показатели и распределение результатов",
    ],
    "statistics-employees": [
      "Отчет по сотрудникам",
      "Результаты личного состава",
    ],
    "statistics-departments": [
      "Отчет по подразделениям",
      "Нагрузка и эффективность подразделений",
    ],
    "statistics-activity": [
      "Отчет по активности",
      "Распределение по видам деятельности",
    ],
    "statistics-sources": [
      "Источники отчета",
      "Детализация до исходных сообщений Discord",
    ],
  };
  const [title, subtitle] = labels[view];
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="period">
            <button
              className={period === "week" ? "selected" : ""}
              onClick={() => setPeriod("week")}
            >
              7 дней
            </button>
            <button
              className={period === "month" ? "selected" : ""}
              onClick={() => setPeriod("month")}
            >
              30 дней
            </button>
          </div>
        }
      />
      {loading || !analytics ? (
        <StateCard />
      ) : (
        <>
          {view === "statistics" && (
            <>
              <section className="metrics">
                <MetricCard label="Всего действий" value={total} index={0} />
                <MetricCard
                  label="Сотрудников с активностью"
                  value={employeeRows.filter((item: any) => item.total).length}
                  index={3}
                />
                <MetricCard
                  label="Подразделений"
                  value={departmentRows.length}
                  index={2}
                />
                <MetricCard
                  label="На проверке"
                  value={dashboard?.reviewMessages ?? 0}
                  index={1}
                />
              </section>
              <section className="dashboard-grid">
                <article className="panel chart-panel">
                  <PanelTitle
                    eyebrow="ПОДРАЗДЕЛЕНИЯ"
                    title="Нагрузка подразделений"
                  />
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={departmentRows}>
                      <CartesianGrid vertical={false} stroke="#273041" />
                      <XAxis dataKey="name" stroke="#788399" />
                      <YAxis stroke="#788399" />
                      <Tooltip
                        contentStyle={{
                          background: "#151c28",
                          border: "1px solid #303b50",
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill="#48b982"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </article>
                <article className="panel chart-panel">
                  <PanelTitle
                    eyebrow="ТИПЫ АКТИВНОСТИ"
                    title="Объем по направлениям"
                  />
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={activity.map((item: Activity) => ({
                        name: item.name,
                        total:
                          period === "week"
                            ? item.weekQuantity
                            : item.monthQuantity,
                      }))}
                    >
                      <CartesianGrid vertical={false} stroke="#273041" />
                      <XAxis dataKey="name" stroke="#788399" />
                      <YAxis stroke="#788399" />
                      <Tooltip
                        contentStyle={{
                          background: "#151c28",
                          border: "1px solid #303b50",
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill="#f39a4b"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </article>
              </section>
            </>
          )}
          {view === "statistics-employees" && (
            <ReportEmployees
              rows={employeeRows}
              selectEmployee={selectEmployee}
            />
          )}
          {view === "statistics-departments" && (
            <section className="panel">
              <PanelTitle
                eyebrow="ПОДРАЗДЕЛЕНИЯ"
                title="Сравнение по активности"
              />
              <DataTable>
                <thead>
                  <tr>
                    <th>Подразделение</th>
                    <th>Сотрудников</th>
                    <th>Действий</th>
                    <th>Среднее на сотрудника</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentRows.map((item: any) => (
                    <tr key={item.name}>
                      <td>
                        <Badge>{item.name}</Badge>
                      </td>
                      <td>{item.employees}</td>
                      <td className="number">{item.total}</td>
                      <td>
                        {item.employees
                          ? (item.total / item.employees).toFixed(1)
                          : "0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </section>
          )}
          {view === "statistics-activity" && (
            <section className="panel">
              <PanelTitle eyebrow="АКТИВНОСТЬ" title="Итоги по типам" />
              <DataTable>
                <thead>
                  <tr>
                    <th>Вид активности</th>
                    <th>Всего</th>
                    <th>Доля</th>
                    <th>Период</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item: Activity, index: number) => {
                    const value =
                      period === "week"
                        ? item.weekQuantity
                        : item.monthQuantity;
                    return (
                      <tr key={item.id}>
                        <td>
                          <span
                            className="activity-dot"
                            style={{
                              background: colors[index % colors.length],
                            }}
                          />
                          {item.name}
                        </td>
                        <td className="number">{value}</td>
                        <td>
                          {total ? Math.round((value / total) * 100) : 0}%
                        </td>
                        <td>{period === "week" ? "7 дней" : "30 дней"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </section>
          )}
          {view === "statistics-sources" && (
            <section className="panel">
              <div className="detail-toolbar">
                <PanelTitle
                  eyebrow="ПРОВЕРЯЕМАЯ ДЕТАЛИЗАЦИЯ"
                  title="Исходные сообщения Discord"
                />
                <label>
                  Вид активности
                  <select
                    value={activityFilter}
                    onChange={(event) => setActivityFilter(event.target.value)}
                  >
                    <option value="">Все виды</option>
                    {activity.map((item: Activity) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <DataTable>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Сотрудник</th>
                    <th>Подразделение</th>
                    <th>Активность</th>
                    <th>Количество</th>
                    <th>Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((event: ActivityDetail) => (
                    <tr key={event.id}>
                      <td>
                        {new Date(event.occurredAt).toLocaleString("ru-RU")}
                      </td>
                      <td>
                        <strong>{event.employee.gameName}</strong>
                      </td>
                      <td>{event.employee.department?.code ?? "—"}</td>
                      <td>{event.activityType.name}</td>
                      <td className="number">{event.quantity}</td>
                      <td>
                        {event.message?.url ? (
                          <a
                            className="discord-link"
                            href={event.message.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Discord ↗
                          </a>
                        ) : (
                          <span className="muted">Нет ссылки</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              {!details.length && (
                <EmptyState
                  title="Нет сообщений по фильтру"
                  text="Выберите другой вид активности или измените период."
                />
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
function ReportEmployees({
  rows,
  selectEmployee,
}: {
  rows: any[];
  selectEmployee: (employee: Employee) => void;
}) {
  const [department, setDepartment] = useState("");
  const departments = [...new Set(rows.map((item) => item.department))].sort(
    (left, right) => left.localeCompare(right, "ru"),
  );
  const filtered = rows.filter(
    (item) => !department || item.department === department,
  );
  const activities = new Map<string, number>();
  for (const employee of filtered)
    for (const activity of employee.activity ?? [])
      activities.set(
        activity.name,
        (activities.get(activity.name) ?? 0) + activity.quantity,
      );
  const pieData = [...activities.entries()].map(([name, value], index) => ({
    name,
    value,
    color: colors[index % colors.length],
  }));
  const activityValue = (employee: any, name: string) =>
    employee.activity.find((activity: any) => activity.name === name)?.quantity ??
    0;
  const barData = filtered
    .slice(0, 12)
    .map((employee) => ({
      name: employee.gameName,
      arrests: activityValue(employee, "Аресты"),
      fines: activityValue(employee, "Штрафы"),
    }));
  return (
    <>
      <section className="panel report-filter">
        <div>
          <PanelTitle eyebrow="СОТРУДНИКИ" title="Результаты личного состава" />
          <span className="muted">
            {filtered.length} из {rows.length} сотрудников
          </span>
        </div>
        <label>
          Подразделение
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="">Все подразделения</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="metrics">
        <MetricCard label="Аресты" value={activities.get("Аресты") ?? 0} index={0} />
        <MetricCard label="Штрафы" value={activities.get("Штрафы") ?? 0} index={1} />
        <MetricCard
          label="Всего действий"
          value={pieData.reduce((sum, item) => sum + item.value, 0)}
          index={2}
        />
        <MetricCard
          label="Сотрудников с активностью"
          value={filtered.filter((employee) => employee.total > 0).length}
          index={3}
        />
      </section>
      <section className="employee-report-grid">
        <article className="panel chart-panel">
          <PanelTitle
            eyebrow="РАСПРЕДЕЛЕНИЕ"
            title="Активность выбранного состава"
          />
          <div className="donut">
            <ResponsiveContainer width="100%" height={255}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={66}
                  outerRadius={94}
                  paddingAngle={3}
                >
                  {pieData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#151c28",
                    border: "1px solid #303b50",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-total">
              <b>{pieData.reduce((sum, item) => sum + item.value, 0)}</b>
              <span>Действий</span>
            </div>
          </div>
          <div className="legend">
            {pieData.map((item) => (
              <span key={item.name}>
                <i style={{ background: item.color }} />
                {item.name}
                <b>{item.value}</b>
              </span>
            ))}
          </div>
          {!pieData.length && (
            <EmptyState
              title="Нет активности"
              text="За выбранный период нет данных по этому подразделению."
            />
          )}
        </article>
        <article className="panel chart-panel">
          <PanelTitle
            eyebrow="АРЕСТЫ И ШТРАФЫ"
            title="Сравнение сотрудников"
          />
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={barData}>
              <CartesianGrid vertical={false} stroke="#342943" />
              <XAxis
                dataKey="name"
                stroke="#988bab"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-22}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} stroke="#988bab" />
              <Tooltip
                contentStyle={{
                  background: "#1a1229",
                  border: "1px solid #594069",
                }}
              />
              <Legend />
              <Bar
                dataKey="arrests"
                name="Аресты"
                fill="#ef5b5b"
                radius={[5, 5, 0, 0]}
              />
              <Bar
                dataKey="fines"
                name="Штрафы"
                fill="#fd8925"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>
      <section className="panel">
        <DataTable>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Должность</th>
              <th>Подразделение</th>
              <th>Всего</th>
              <th>Аресты</th>
              <th>Штрафы</th>
              {[...activities.keys()]
                .filter((name) => name !== "Аресты" && name !== "Штрафы")
                .map((name) => (
                  <th key={name}>{name}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                className="interactive-row"
                key={item.id}
                onClick={() =>
                  selectEmployee({
                    id: item.id,
                    gameName: item.gameName,
                    active: true,
                    positionRaw: item.position,
                    department: null,
                  })
                }
              >
                <td>
                  <strong>{item.gameName}</strong>
                </td>
                <td>{item.position}</td>
                <td>
                  <Badge>{item.department}</Badge>
                </td>
                <td className="number">{item.total}</td>
                <td className="number">{activityValue(item, "Аресты")}</td>
                <td className="number">{activityValue(item, "Штрафы")}</td>
                {[...activities.keys()]
                  .filter((name) => name !== "Аресты" && name !== "Штрафы")
                  .map((name) => (
                    <td className="number" key={name}>
                      {activityValue(item, name)}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </DataTable>
        {!filtered.length && (
          <EmptyState
            title="Сотрудники не найдены"
            text="Измените фильтр подразделения."
          />
        )}
      </section>
    </>
  );
}
function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}
function RecentEvents({ events }: { events: ActivityDetail[] }) {
  return (
    <article className="panel wide">
      <PanelTitle
        eyebrow="ИСТОЧНИКИ ДАННЫХ"
        title="Последние обработанные сообщения"
      />
      <DataTable>
        <thead>
          <tr>
            <th>Время</th>
            <th>Сотрудник</th>
            <th>Активность</th>
            <th>Количество</th>
            <th>Сообщение Discord</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 12).map((event) => (
            <tr key={event.id}>
              <td>{new Date(event.occurredAt).toLocaleString("ru-RU")}</td>
              <td>
                <strong>{event.employee.gameName}</strong>
                <small className="subline">
                  {event.employee.department?.code ?? "—"}
                </small>
              </td>
              <td>{event.activityType.name}</td>
              <td className="number">{event.quantity}</td>
              <td>
                {event.message?.url ? (
                  <a
                    className="discord-link"
                    href={event.message.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть сообщение ↗
                  </a>
                ) : (
                  <span className="muted">Нет ссылки</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {!events.length && (
        <EmptyState
          title="Нет событий за период"
          text="После импорта Discord-каналов здесь появится детализация до исходных сообщений."
        />
      )}
    </article>
  );
}
function EmployeesView({ employees, employeeTotal, selectEmployee }: any) {
  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle={`Личный состав: ${employeeTotal}`}
        action={<button className="button">+ Добавить сотрудника</button>}
      />
      <section className="panel">
        <div className="filterbar">
          <button className="filter">Подразделение ▾</button>
          <button className="filter">Звание ▾</button>
          <button className="filter">Должность ▾</button>
          <button className="filter">Статус ▾</button>
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Должность</th>
              <th>Звание</th>
              <th>Подразделение</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee: Employee) => (
              <tr
                key={employee.id}
                className="interactive-row"
                onClick={() => selectEmployee(employee)}
              >
                <td>
                  <div className="employee">
                    <div className="avatar">{employee.gameName[0]}</div>
                    <span>
                      <strong>{employee.gameName}</strong>
                      <small>
                        {employee.discordDisplayName ?? "Discord не указан"}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  {employee.position?.name ??
                    employee.positionRaw ??
                    "Не определена"}
                </td>
                <td>{employee.rank?.name ?? "Не назначено"}</td>
                <td>
                  <Badge>{employee.department?.code ?? "Не определено"}</Badge>
                </td>
                <td>
                  <Badge tone={employee.active ? "good" : "neutral"}>
                    {employee.active ? "Активен" : "Неактивен"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {!employees.length && (
          <EmptyState
            title="Сотрудники не найдены"
            text="Измените фильтр или импортируйте данные Discord."
          />
        )}
      </section>
    </>
  );
}
function EmployeeProfile({
  employee,
  close,
  dictionary,
  onSave,
}: {
  employee: Employee;
  close: () => void;
  dictionary: Dictionary | null;
  onSave: (id: string, values: Record<string, unknown>) => Promise<void>;
}) {
  const [tab, setTab] = useState("Обзор");
  const [departmentId, setDepartmentId] = useState(
    employee.department?.id ?? "",
  );
  const [positionId, setPositionId] = useState(employee.position?.id ?? "");
  const [rankId, setRankId] = useState(employee.rank?.id ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await onSave(employee.id, {
        departmentId: departmentId || null,
        positionId: positionId || null,
        ...(rankId ? { rankId } : {}),
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader
        title={employee.gameName}
        subtitle={employee.discordDisplayName ?? "Карточка сотрудника"}
        action={
          <button className="button secondary" onClick={close}>
            ← К списку
          </button>
        }
      />
      <section className="profile-card">
        <div className="profile-avatar">{employee.gameName[0]}</div>
        <div>
          <h2>{employee.gameName}</h2>
          <p>
            {employee.position?.name ??
              employee.positionRaw ??
              "Должность не определена"}{" "}
            · {employee.department?.code ?? "Подразделение не определено"}
          </p>
          <Badge tone={employee.active ? "good" : "neutral"}>
            {employee.active ? "Активен" : "Неактивен"}
          </Badge>
        </div>
      </section>
      <div className="tabs profile-tabs">
        {[
          "Обзор",
          "Статистика",
          "История",
          "Обучение",
          "Активность",
          "Заметки",
        ].map((item) => (
          <button
            key={item}
            className={tab === item ? "selected" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <section className="panel">
        {tab === "Обзор" ? (
          <div className="profile-grid">
            <div>
              <PanelTitle eyebrow="ПРОФИЛЬ" title="Данные сотрудника" />
              <dl>
                <dt>Discord</dt>
                <dd>{employee.discordDisplayName ?? "Не указан"}</dd>
                <dt>Звание</dt>
                <dd>{employee.rank?.name ?? "Не назначено"}</dd>
              </dl>
              <div className="editor">
                <label>
                  Подразделение
                  <select
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                  >
                    <option value="">Не определено</option>
                    {dictionary?.departments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Должность
                  <select
                    value={positionId}
                    onChange={(event) => setPositionId(event.target.value)}
                  >
                    <option value="">Не определена</option>
                    {dictionary?.positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Звание
                  <select
                    value={rankId}
                    onChange={(event) => setRankId(event.target.value)}
                  >
                    <option value="">Не назначено</option>
                    {dictionary?.ranks.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? "Сохранение..." : "Сохранить изменения"}
                </button>
              </div>
            </div>
            <div>
              <PanelTitle eyebrow="СТАТИСТИКА" title="Нет событий за период" />
              <EmptyState
                title="Активность еще не загружена"
                text="Подробная статистика появится после подключения API карточки сотрудника."
              />
            </div>
          </div>
        ) : (
          <EmptyState
            title={`${tab}: данных пока нет`}
            text="Раздел подготовлен для соответствующего API сотрудника."
          />
        )}
      </section>
    </>
  );
}
function IntegrationsView({
  sources,
  updateSource,
  requestScan,
  scanNote,
  scanRequests,
}: any) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Discord интеграции"
        subtitle="Каналы, правила обработки и статус collector"
        action={
          <button className="button" onClick={() => void requestScan()}>
            Запустить сбор <b>→</b>
          </button>
        }
      />
      {scanNote && (
        <div className="collector-warning">
          <b>Ручной запуск.</b>
          <span>{scanNote}</span>
        </div>
      )}
      <section className="panel">
        <div className="tabs">
          <button className="selected">Каналы</button>
          <button>Настройки</button>
          <button>Статус</button>
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>Название</th>
              <th>Parser</th>
              <th>Тип активности</th>
              <th>Глубина</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((source: Source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.name}</strong>
                  <small className="subline">{source.channelId}</small>
                </td>
                <td>
                  {source.parserMode === "TRAINING_MESSAGE"
                    ? "Экзамены / обучение"
                    : "Числовая последовательность"}
                </td>
                <td>{source.rules[0]?.activityType?.name ?? "—"}</td>
                <td>{source.lookbackDays ?? 3} дней</td>
                <td>
                  <Badge tone={source.enabled ? "good" : "warn"}>
                    {source.enabled ? "Активен" : "Выключен"}
                  </Badge>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="link-button"
                      onClick={() => void requestScan(source.id)}
                    >
                      Собрать 20
                    </button>
                    <button
                      className="link-button"
                      onClick={() =>
                        setEditing(editing === source.id ? null : source.id)
                      }
                    >
                      Настроить
                    </button>
                    <SourceToggle source={source} updateSource={updateSource} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {sources.map(
          (source: Source) =>
            editing === source.id && (
              <SourceSettings
                key={`${source.id}-settings`}
                source={source}
                save={updateSource}
                close={() => setEditing(null)}
              />
            ),
        )}
        {!sources.length && (
          <EmptyState
            title="Нет подключенных Discord-каналов"
            text="Добавьте разрешенный канал Discord для начала импорта."
            action="Добавить канал"
          />
        )}
      </section>
      <section className="panel collector-card">
        <div>
          <p className="eyebrow">COLLECTOR</p>
          <h2>Сбор данных Discord</h2>
          <span>
            Кнопка запускает задачу сразу. Collector использует сохраненный
            профиль Discord и читает только последние 20 сообщений за 3 дня в
            read-only режиме.
          </span>
        </div>
        <Badge tone="good">Готов к задачам</Badge>
      </section>
      <section className="panel scan-history">
        <PanelTitle eyebrow="ЗАДАЧИ СБОРА" title="Последние ручные запуски" />
        <DataTable>
          <thead>
            <tr>
              <th>Канал</th>
              <th>Параметры</th>
              <th>Статус</th>
              <th>Создана</th>
              <th>Результат</th>
            </tr>
          </thead>
          <tbody>
            {scanRequests.map((request: ScanRequest) => (
              <tr key={request.id}>
                <td>{request.source?.name ?? "Все включенные каналы"}</td>
                <td>
                  {request.limit} сообщений · {request.recentDays} дня
                </td>
                <td>
                  <Badge
                    tone={
                      request.status === "COMPLETED"
                        ? "good"
                        : request.status === "FAILED"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {request.status}
                  </Badge>
                </td>
                <td>{new Date(request.createdAt).toLocaleString("ru-RU")}</td>
                <td>
                  {request.errorMessage ??
                    request.result
                      ?.map(
                        (item) =>
                          `${item.source}: ${item.accepted}/${item.scanned}`,
                      )
                      .join(" · ") ??
                    "Ожидание collector"}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {!scanRequests.length && (
          <EmptyState
            title="Задач еще нет"
            text="Создайте ручную задачу запуска в верхней части раздела."
          />
        )}
      </section>
    </>
  );
}
function SourceSettings({
  source,
  save,
  close,
}: {
  source: Source;
  save: (id: string, values: Record<string, unknown>) => Promise<void>;
  close: () => void;
}) {
  const [name, setName] = useState(source.name);
  const [lookbackDays, setLookbackDays] = useState(source.lookbackDays ?? 3);
  const [countMode, setCountMode] = useState(source.countMode);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save(source.id, {
        name,
        lookbackDays: Number(lookbackDays),
        countMode,
        parserMode:
          countMode === "TRAINING_TEXT" ? "TRAINING_MESSAGE" : "SEQUENCE_RANGE",
      });
      close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="source-settings editor" onSubmit={submit}>
      <div className="settings-head">
        <div>
          <p className="eyebrow">ПРАВИЛА ПАРСИНГА</p>
          <h3>{source.name}</h3>
        </div>
        <button type="button" className="link-button" onClick={close}>
          Закрыть
        </button>
      </div>
      <label>
        Название канала
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        Способ подсчета
        <select
          value={countMode}
          onChange={(event) => setCountMode(event.target.value)}
        >
          <option value="ATTACHMENTS">По изображениям</option>
          <option value="TRAINING_TEXT">По тексту обучения</option>
        </select>
      </label>
      <label>
        Глубина истории, дней
        <input
          type="number"
          min="1"
          max="30"
          value={lookbackDays}
          onChange={(event) => setLookbackDays(Number(event.target.value))}
        />
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Сохранение..." : "Сохранить правила"}
      </button>
    </form>
  );
}
function SourceToggle({
  source,
  updateSource,
}: {
  source: Source;
  updateSource: (id: string, values: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="link-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await updateSource(source.id, { enabled: !source.enabled });
        } finally {
          setBusy(false);
        }
      }}
    >
      {source.enabled ? "Отключить" : "Включить"}
    </button>
  );
}
function ReviewView({ review }: any) {
  return (
    <>
      <PageHeader
        title="Проверка данных"
        subtitle="Очередь нераспознанных и конфликтных сообщений Discord"
      />
      <section className="panel">
        <div className="filterbar">
          <button className="filter">Все причины ▾</button>
          <button className="filter">Все каналы ▾</button>
          <Badge tone="warn">{review?.total ?? 0} на проверке</Badge>
        </div>
        {review ? (
          <DataTable>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Автор</th>
                <th>Сообщение</th>
                <th>Причина</th>
                <th>Канал</th>
              </tr>
            </thead>
            <tbody>
              {review.items.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.messageTimestamp).toLocaleString("ru-RU")}
                  </td>
                  <td>
                    <strong>{item.authorRaw}</strong>
                  </td>
                  <td className="message-cell">{item.textRaw || "—"}</td>
                  <td>
                    <Badge tone="warn">{item.errorCode ?? item.status}</Badge>
                  </td>
                  <td>{item.discordSource.name}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <StateCard />
        )}
        {review && !review.items.length && (
          <EmptyState
            title="Нет сообщений на проверке"
            text="Все поступившие сообщения успешно обработаны."
          />
        )}
      </section>
    </>
  );
}
function UnresolvedView({ unresolved, selectEmployee }: any) {
  return (
    <>
      <PageHeader
        title="Неразобрано"
        subtitle="Пользователи и подразделения, которым требуется ручное сопоставление"
      />
      <section className="unresolved-grid">
        <article className="panel">
          <PanelTitle eyebrow="ПОЛЬЗОВАТЕЛИ" title="Неопределенные авторы" />
          <DataTable>
            <thead>
              <tr>
                <th>Строка Discord</th>
                <th>Каналы</th>
                <th>Сообщений</th>
                <th>Последнее</th>
              </tr>
            </thead>
            <tbody>
              {unresolved.users.map((user: any) => (
                <tr key={user.authorRaw}>
                  <td>
                    <strong>{user.authorRaw}</strong>
                  </td>
                  <td>{user.sourceNames.join(", ")}</td>
                  <td>{user.messages}</td>
                  <td>
                    {new Date(user.lastMessageAt).toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {!unresolved.users.length && (
            <EmptyState
              title="Нет неразобранных авторов"
              text="Все новые Discord-строки имеют сопоставление."
            />
          )}
        </article>
        <article className="panel">
          <PanelTitle eyebrow="ПОДРАЗДЕЛЕНИЯ" title="Сотрудники без отдела" />
          <DataTable>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Строка Discord</th>
                <th>Код</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {unresolved.employeeDetails.map((employee: any) => (
                <tr key={employee.employeeId}>
                  <td>
                    <strong>{employee.gameName}</strong>
                  </td>
                  <td>{employee.discordDisplayName}</td>
                  <td>
                    <Badge tone="warn">{employee.departmentRaw}</Badge>
                  </td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() =>
                        selectEmployee({
                          id: employee.employeeId,
                          gameName: employee.gameName,
                          discordDisplayName: employee.discordDisplayName,
                          positionRaw: employee.positionRaw,
                          active: true,
                        })
                      }
                    >
                      Разобрать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {!unresolved.employeeDetails.length && (
            <EmptyState
              title="Нет сотрудников без отдела"
              text="Все сотрудники связаны с подразделениями."
            />
          )}
        </article>
      </section>
    </>
  );
}
function DictionariesView({ dictionary }: any) {
  return (
    <>
      <PageHeader
        title="Справочники"
        subtitle="Виды активности, подразделения, должности и звания"
      />
      <section className="dictionary-grid">
        {[
          ["Виды активности", dictionary?.activityTypes, "name"],
          ["Подразделения", dictionary?.departments, "code"],
          ["Должности", dictionary?.positions, "name"],
          ["Звания", dictionary?.ranks, "name"],
        ].map(([title, data, field]: any) => (
          <article className="panel" key={title}>
            <PanelTitle eyebrow="СПРАВОЧНИК" title={title} />
            <ul className="dictionary-list">
              {data?.slice(0, 8).map((item: any) => (
                <li key={item.id}>
                  {item[field]}
                  <span>{item.name !== item[field] ? item.name : ""}</span>
                </li>
              ))}
            </ul>
            {!data?.length && (
              <EmptyState
                title="Нет записей"
                text="Данные будут доступны после настройки справочника."
              />
            )}
          </article>
        ))}
      </section>
    </>
  );
}
