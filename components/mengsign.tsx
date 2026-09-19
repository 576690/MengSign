"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  Eye,
  EyeOff,
  Github,
  GraduationCap,
  Laptop,
  LoaderCircle,
  LogOut,
  Moon,
  QrCode,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import {
  api,
  ClientError,
  clearPersonal,
  demoCourses,
  readCache,
  writeCache,
} from "@/lib/client";
import {
  courseInstant,
  currentAndNext,
  shanghaiDay,
  timeLabel,
  todaySorted,
} from "@/lib/course";
import type { Course, CourseResult, Profile, SignResult } from "@/lib/types";
import QrPanel from "./qr-panel";
type Tab = "today" | "qr" | "settings";
type Theme = "system" | "light" | "dark";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const tabs = [
  { id: "today" as const, name: "今日", icon: CalendarDays },
  { id: "qr" as const, name: "二维码", icon: QrCode },
  { id: "settings" as const, name: "设置", icon: Settings2 },
];
function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`logo ${large ? "large" : ""}`}>
      <img
        src="/icon.svg"
        alt=""
        width={large ? 68 : 38}
        height={large ? 68 : 38}
      />
    </span>
  );
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
export default function MengSign() {
  const [ready, setReady] = useState(false),
    [profile, setProfile] = useState<Profile | null>(null),
    [demo, setDemo] = useState(false);
  const [tab, setTab] = useState<Tab>("today"),
    [data, setData] = useState<CourseResult | null>(null),
    [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false),
    [signing, setSigning] = useState(""),
    [notice, setNotice] = useState(""),
    [success, setSuccess] = useState(false);
  const [online, setOnline] = useState(true),
    [now, setNow] = useState(Date.now()),
    [theme, setTheme] = useState<Theme>("system");
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [installHelp, setInstallHelp] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  const refreshing = useRef(false),
    signLock = useRef(false),
    touch = useRef<number | null>(null),
    [pull, setPull] = useState(0);
  const accountGeneration = useRef(0);
  const notify = useCallback((text: string, ok = false) => {
    setNotice(text);
    setSuccess(ok);
  }, []);
  const expired = useCallback(() => {
    accountGeneration.current++;
    clearPersonal();
    setProfile(null);
    setData(null);
    setDemo(false);
    setNotice("登录已失效，请重新登录");
    setSuccess(false);
  }, []);
  const refresh = useCallback(
    async (p = profile, isDemo = demo) => {
      if (!p || refreshing.current) return;
      if (isDemo) {
        setData(demoCourses());
        setCached(false);
        return;
      }
      const epoch = accountGeneration.current;
      refreshing.current = true;
      setLoading(true);
      try {
        const result = await api<CourseResult>("/api/courses");
        if (epoch !== accountGeneration.current) return;
        setData(result);
        setCached(false);
        writeCache(p.accountKey, result);
      } catch (e) {
        if (epoch !== accountGeneration.current) return;
        if (e instanceof ClientError && e.status === 401) expired();
        else {
          const saved = readCache(p.accountKey, shanghaiDay());
          if (saved) {
            setData(saved);
            setCached(true);
          }
          notify(e instanceof Error ? e.message : "课表刷新失败");
        }
      } finally {
        refreshing.current = false;
        if (epoch === accountGeneration.current) setLoading(false);
      }
    },
    [profile, demo, expired, notify],
  );
  useEffect(() => {
    let active = true;
    setOnline(navigator.onLine);
    try {
      const t = localStorage.getItem("mengsign:theme");
      if (t === "light" || t === "dark" || t === "system") setTheme(t);
    } catch {}
    async function restore() {
      try {
        const result = await api<{ profile: Profile }>("/api/auth/session");
        if (!active) return;
        setProfile(result.profile);
        store("mengsign:profile", JSON.stringify(result.profile));
        const saved = readCache(result.profile.accountKey, shanghaiDay());
        if (saved) {
          setData(saved);
          setCached(true);
        }
      } catch (e) {
        if (!active) return;
        if (e instanceof ClientError && e.status === 401) clearPersonal();
        else if (!navigator.onLine) {
          try {
            const p = JSON.parse(
              localStorage.getItem("mengsign:profile") || "null",
            );
            if (p?.accountKey && p?.label) {
              setProfile(p);
              setData(readCache(p.accountKey, shanghaiDay()));
              setCached(true);
            }
          } catch {}
        }
      } finally {
        if (active) setReady(true);
      }
    }
    void restore();
    const connectivity = () => setOnline(navigator.onLine);
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = setInterval(tick, 15000);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    window.addEventListener("beforeinstallprompt", captureInstall);
    document.addEventListener("visibilitychange", tick);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("beforeinstallprompt", captureInstall);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    store("mengsign:theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const realDay = shanghaiDay(now);
  useEffect(() => {
    if (ready && profile && online)
      void refresh(); /* Refresh at login, reconnect, and Shanghai midnight. */
  }, [ready, profile?.accountKey, online, realDay]); // eslint-disable-line react-hooks/exhaustive-deps
  const displayNow =
    demo && data ? (courseInstant(data.date, "10:35") ?? now) : now;
  const courses = todaySorted(data?.courses || [], shanghaiDay(displayNow));
  const { current, next } = currentAndNext(courses, displayNow);
  const signedCount = courses.filter((c) => c.signed).length;
  const activeCourse = current || next;
  async function sign(course: Course) {
    if (signLock.current || !online) return;
    const epoch = accountGeneration.current;
    signLock.current = true;
    setSigning(course.id);
    setNotice("");
    try {
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (epoch !== accountGeneration.current) return;
        setData((d) =>
          d
            ? {
                ...d,
                courses: d.courses.map((c) =>
                  c.id === course.id ? { ...c, signed: true } : c,
                ),
              }
            : d,
        );
        notify("演示签到完成 · 未向学校发送请求", true);
        return;
      }
      const result = await api<SignResult>("/api/attendance", {
        courseId: course.id,
        accountKey: profile?.accountKey,
      });
      if (epoch !== accountGeneration.current) return;
      if (result.outcome === "signed")
        setData((d) =>
          d
            ? {
                ...d,
                courses: d.courses.map((c) =>
                  c.id === course.id ? { ...c, signed: true } : c,
                ),
              }
            : d,
        );
      notify(result.message, result.outcome === "signed");
      await refresh();
    } catch (e) {
      if (epoch !== accountGeneration.current) return;
      if (e instanceof ClientError && e.status === 401) expired();
      else {
        notify("未能确认签到结果，请刷新课表核对后再试");
        await refresh();
      }
    } finally {
      signLock.current = false;
      setSigning("");
    }
  }
  async function logout() {
    try {
      if (!demo) await api("/api/auth/logout", {});
      accountGeneration.current++;
      clearPersonal();
      setProfile(null);
      setData(null);
      setDemo(false);
      setTab("today");
      setNotice("");
      setConfirmClear(false);
    } catch {
      notify("退出失败，请恢复网络后重试");
    }
  }
  async function installApp() {
    if (install) {
      await install.prompt();
      await install.userChoice;
      setInstall(null);
    } else setInstallHelp(true);
  }
  function enterDemo() {
    accountGeneration.current++;
    setDemo(true);
    setProfile({ accountKey: "demo", label: "体验账号" });
    setData(demoCourses());
    setTab("today");
    setNotice("");
    setCached(false);
  }
  const dateTitle = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MengSign 首页">
          <Logo />
          <span>
            MengSign<span className="brand-note">让每次到场，都被记录。</span>
          </span>
        </a>
        <div className="top-actions">
          <span className="campus-label">
            <GraduationCap size={16} />
            中国科学院大学
          </span>
          <button
            className="icon-button theme-button"
            aria-label="切换深浅主题"
            onClick={() =>
              setTheme(
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark",
              )
            }
          >
            <Sun size={19} />
          </button>
          {profile && (
            <button
              className="avatar"
              aria-label="打开账号设置"
              onClick={() => setTab("settings")}
            >
              {demo ? "M" : profile.label.slice(-2)}
            </button>
          )}
        </div>
      </header>
      {!ready ? (
        <main className="boot" aria-busy="true">
          <Logo large />
          <LoaderCircle className="spin" size={22} />
          <p>正在准备你的课表</p>
        </main>
      ) : !profile ? (
        <Login
          onLogin={(p) => {
            accountGeneration.current++;
            clearPersonal();
            setProfile(p);
            store("mengsign:profile", JSON.stringify(p));
            setDemo(false);
            setNotice("");
          }}
          onDemo={enterDemo}
          notice={notice}
          online={online}
        />
      ) : (
        <>
          {demo && (
            <div className="demo-banner">
              <Sparkles size={14} />
              <span>演示模式 · 示例课程与签到，不连接学校</span>
              <button onClick={() => void logout()}>
                登录真实账号
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <main
            className="workspace"
            onTouchStart={(e) => {
              touch.current =
                window.scrollY === 0 ? e.touches[0].clientY : null;
            }}
            onTouchMove={(e) => {
              if (touch.current !== null && tab === "today")
                setPull(
                  Math.min(
                    85,
                    Math.max(0, e.touches[0].clientY - touch.current),
                  ),
                );
            }}
            onTouchEnd={() => {
              if (pull > 65 && tab === "today" && online) void refresh();
              touch.current = null;
              setPull(0);
            }}
          >
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {tab === "today"
                    ? dateTitle
                    : tab === "qr"
                      ? "随时打开，即刻同步"
                      : "按你的习惯来"}
                </div>
                <h1>
                  {tab === "today" ? (
                    <>
                      今天，也从容一点<span className="heading-dot">.</span>
                    </>
                  ) : tab === "qr" ? (
                    "我的签到码"
                  ) : (
                    "我的设置"
                  )}
                </h1>
              </div>
              <div
                className="desktop-tabs"
                role="navigation"
                aria-label="主导航"
              >
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    aria-current={tab === t.id ? "page" : undefined}
                    onClick={() => setTab(t.id)}
                  >
                    <t.icon size={17} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            {!online && (
              <div className="notice offline">
                <WifiOff size={17} />
                当前离线，仅展示本机缓存；签到和二维码暂不可用。
              </div>
            )}
            {notice && (
              <div
                className={`notice ${success ? "success" : "error"}`}
                role="status"
              >
                <span>
                  {success && <CircleCheck size={17} />}
                  {notice}
                </span>
                <button aria-label="关闭提示" onClick={() => setNotice("")}>
                  <X size={17} />
                </button>
              </div>
            )}
            {pull > 20 && (
              <div className="pull-label">
                <RefreshCw size={15} />
                {pull > 65 ? "松开刷新" : "下拉刷新课表"}
              </div>
            )}
            {tab === "today" && (
              <div className="today-grid">
                <div className="stack main-column">
                  <section
                    className={`current-card ${activeCourse?.signed ? "completed" : ""}`}
                  >
                    <div className="current-top">
                      <span className="current-tag">
                        <span className="status-dot" />
                        {current ? "正在进行" : next ? "即将开始" : "今日状态"}
                      </span>
                      <span className="small">
                        {demo ? "演示时间 10:35" : "TODAY, AT A GLANCE"}
                      </span>
                    </div>
                    {loading && !data ? (
                      <div className="hero-skeleton">
                        <div />
                        <div />
                      </div>
                    ) : (
                      <>
                        <div className="hero-course">
                          <div>
                            <p className="course-kicker">
                              {activeCourse
                                ? activeCourse.signed
                                  ? "这一节，已经签到"
                                  : current
                                    ? "把签到交给轻松，把时间留给课堂"
                                    : "下一段学习，即将开始"
                                : courses.length
                                  ? "今天的课程已结束"
                                  : "留一点时间，给自己"}
                            </p>
                            <h2>
                              {activeCourse?.name ||
                                (courses.length
                                  ? "今天也辛苦了"
                                  : "今日暂无课程")}
                            </h2>
                            <div className="hero-meta">
                              {activeCourse ? (
                                <>
                                  <Clock3 size={16} />
                                  {timeLabel(activeCourse)} —{" "}
                                  {timeLabel(activeCourse, true)}
                                  <span className="meta-divider" />
                                  {activeCourse.teacher || "教师信息待更新"}
                                </>
                              ) : (
                                <>
                                  <BookOpen size={17} />
                                  {data
                                    ? "休息一下，明天继续"
                                    : "刷新课表，查看今天的安排"}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="hero-symbol">
                            {activeCourse?.signed ? (
                              <CheckCheck size={50} strokeWidth={1.25} />
                            ) : (
                              <BookOpen size={50} strokeWidth={1.2} />
                            )}
                          </div>
                        </div>
                        <div className="hero-bottom">
                          <button
                            className="button hero-button"
                            disabled={
                              !activeCourse ||
                              activeCourse.signed ||
                              !!signing ||
                              !online ||
                              cached ||
                              loading
                            }
                            onClick={() =>
                              activeCourse && void sign(activeCourse)
                            }
                          >
                            {signing ? (
                              <LoaderCircle size={19} className="spin" />
                            ) : activeCourse?.signed ? (
                              <CircleCheck size={19} />
                            ) : (
                              <Check size={19} />
                            )}
                            {signing
                              ? "正在确认签到…"
                              : activeCourse?.signed
                                ? "已签到"
                                : "一键签到"}
                            {!activeCourse?.signed && !signing && (
                              <ArrowRight size={17} />
                            )}
                          </button>
                          <button
                            className="hero-link"
                            onClick={() => setTab("qr")}
                          >
                            出示签到码
                            <QrCode size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                  <section className="panel schedule-panel">
                    <div className="section-heading">
                      <h2>
                        今日课程
                        <span className="count-badge">{courses.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        disabled={loading || !online}
                        onClick={() => void refresh()}
                      >
                        <RefreshCw
                          size={15}
                          className={loading ? "spin" : ""}
                        />
                        {loading ? "同步中" : "刷新"}
                      </button>
                    </div>
                    {loading && !data ? (
                      <div className="skeleton-list" aria-label="正在加载课表">
                        {[1, 2, 3].map((n) => (
                          <div key={n} />
                        ))}
                      </div>
                    ) : courses.length ? (
                      <div className="course-list">
                        {courses.map((c) => {
                          const isCurrent = c.id === current?.id;
                          const ended =
                            (courseInstant(c.day, c.endTime) ?? Infinity) <
                            displayNow;
                          return (
                            <div
                              className={`course-row ${isCurrent ? "is-current" : ""}`}
                              key={c.id || c.uuid}
                            >
                              <div className="time-column">
                                <strong>{timeLabel(c)}</strong>
                                <span>{timeLabel(c, true)}</span>
                              </div>
                              <div className="timeline">
                                <i />
                              </div>
                              <div className="course-detail">
                                <h3>{c.name}</h3>
                                <p>
                                  {c.teacher || "教师待更新"}
                                  {isCurrent && <span>· 当前课程</span>}
                                </p>
                              </div>
                              {c.signed ? (
                                <span className="course-status signed">
                                  <Check size={14} />
                                  已签到
                                </span>
                              ) : isCurrent ? (
                                <button
                                  className="course-status sign-action"
                                  disabled={
                                    !!signing || !online || cached || loading
                                  }
                                  onClick={() => void sign(c)}
                                >
                                  签到
                                  <ChevronRight size={13} />
                                </button>
                              ) : (
                                <span className="course-status">
                                  {ended ? "已结束" : "未开始"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <CalendarDays size={38} strokeWidth={1.3} />
                        <h3>
                          {data ? "今天没有课程安排" : "还没有获取到课表"}
                        </h3>
                        <p>
                          {data
                            ? "可以看看本周其他课程，或稍后刷新。"
                            : "检查网络连接，然后重新刷新。"}
                        </p>
                      </div>
                    )}
                    <div className="sync-line">
                      <span className={`status-dot ${cached ? "amber" : ""}`} />
                      {data
                        ? `${cached ? "本机缓存 · " : demo ? "示例数据 · " : "最近同步 "}${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(data.updatedAt)}`
                        : "等待同步学校课表"}
                      <span>以学校返回状态为准</span>
                    </div>
                  </section>
                  {!!data?.weeklyCourses.length && !courses.length && (
                    <section className="panel">
                      <h2>本周其他课程</h2>
                      <div className="weekly-list">
                        {data.weeklyCourses.map((c, i) => (
                          <div key={`${c.id}-${i}`}>
                            <span>
                              {c.day.slice(4, 6)}/{c.day.slice(6, 8)} ·{" "}
                              {timeLabel(c)}
                            </span>
                            <strong>{c.name}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
                <aside className="stack side-column">
                  <section className="panel progress-panel">
                    <div className="section-heading">
                      <h2>今日进度</h2>
                      <span className="icon-tile">
                        <CheckCheck size={18} />
                      </span>
                    </div>
                    <div className="progress-content">
                      <div
                        className="progress-ring"
                        style={
                          {
                            "--progress": `${courses.length ? (signedCount / courses.length) * 360 : 0}deg`,
                          } as React.CSSProperties
                        }
                      >
                        <div>
                          <strong>
                            {signedCount}
                            <span> / {courses.length}</span>
                          </strong>
                          <small>已签到</small>
                        </div>
                      </div>
                      <div className="progress-copy">
                        <h3>
                          {courses.length && signedCount === courses.length
                            ? "今日签到已完成"
                            : "每一份专注，都算数"}
                        </h3>
                        <p>
                          {courses.length
                            ? `还有 ${courses.length - signedCount} 节课程未签到`
                            : "今天，按自己的节奏来"}
                        </p>
                      </div>
                    </div>
                  </section>
                  <section className="panel next-panel">
                    <div className="section-heading">
                      <h2>下一节</h2>
                      <span className="small muted">UP NEXT</span>
                    </div>
                    {next ? (
                      <>
                        <div className="next-time">
                          <span>{timeLabel(next)}</span>
                          <span className="pill">
                            {current ? "稍后见" : "即将开始"}
                          </span>
                        </div>
                        <h3>{next.name}</h3>
                        <p className="muted">
                          {next.teacher} · {timeLabel(next)} —{" "}
                          {timeLabel(next, true)}
                        </p>
                      </>
                    ) : (
                      <div className="next-empty">
                        <Sun size={27} />
                        <h3>接下来，自由安排</h3>
                        <p>今天没有更多课程了</p>
                      </div>
                    )}
                  </section>
                  <button
                    className="install-card"
                    onClick={() => void installApp()}
                  >
                    <span className="install-icon">
                      <Smartphone size={25} />
                    </span>
                    <span>
                      <strong>把 MengSign 放进口袋</strong>
                      <small>添加到主屏幕，像 App 一样打开</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                  <div className="quiet-note">
                    <ShieldCheck size={16} />
                    <span>密码仅用于登录，不会被保存</span>
                  </div>
                </aside>
              </div>
            )}
            {tab === "qr" && (
              <QrPanel
                courses={courses}
                selected={current?.id || next?.id || ""}
                online={online}
                demo={demo}
              />
            )}
            {tab === "settings" && (
              <div className="settings-grid">
                <div className="stack">
                  <section className="panel account-panel">
                    <div className="account-avatar">
                      <GraduationCap size={29} />
                    </div>
                    <div>
                      <h2>{demo ? "欢迎体验 MengSign" : "我的学校账号"}</h2>
                      <p className="muted">
                        {profile.label}
                        {demo ? " · 示例数据" : " · 当前设备已登录"}
                      </p>
                    </div>
                    <span className="pill">{demo ? "演示" : "已连接"}</span>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>外观</h2>
                      <Sun size={18} />
                    </div>
                    <p className="muted">选择看起来最舒服的方式</p>
                    <div className="theme-picker">
                      {(
                        [
                          { value: "light", label: "浅色", Icon: Sun },
                          { value: "dark", label: "深色", Icon: Moon },
                          { value: "system", label: "跟随系统", Icon: Laptop },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.value}
                          className={theme === t.value ? "selected" : ""}
                          aria-pressed={theme === t.value}
                          onClick={() => setTheme(t.value)}
                        >
                          <t.Icon size={22} />
                          <span>{t.label}</span>
                          {theme === t.value && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel settings-list">
                    <button onClick={() => void installApp()}>
                      <ArrowDownToLine size={20} />
                      <span>
                        添加到主屏幕<small>独立窗口，快速打开</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                    <button onClick={() => setConfirmClear(true)}>
                      <Trash2 size={20} />
                      <span>
                        清除本机数据<small>删除课表缓存并退出账号</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                    <button
                      className="danger"
                      disabled={!!signing}
                      onClick={() => void logout()}
                    >
                      <LogOut size={20} />
                      <span>{demo ? "退出演示模式" : "退出登录"}</span>
                      <ChevronRight size={18} />
                    </button>
                  </section>
                </div>
                <aside className="stack">
                  <section className="panel about-panel">
                    <Logo large />
                    <h2>MengSign</h2>
                    <p>轻松签到，专注当下。</p>
                    <span className="version">VERSION 1.0.0</span>
                    <hr />
                    <a
                      href="https://github.com/576690/MengSign"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Github size={17} />
                      查看项目源码
                      <ArrowRight size={16} />
                    </a>
                    <a
                      href="https://github.com/zhan-nine/UCAS-Sign-in"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <BookOpen size={17} />
                      原项目与致谢
                      <ArrowRight size={16} />
                    </a>
                    <a
                      href="/licenses/AGPL-3.0.txt"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ShieldCheck size={17} />
                      AGPL-3.0 开源许可
                      <ArrowRight size={16} />
                    </a>
                  </section>
                  <div className="info-card">
                    <ShieldCheck size={22} />
                    <h3>你的账号，由你掌握</h3>
                    <p>
                      密码仅通过服务端转交学校验证，不会被保存。课表缓存在当前设备，退出后清除。学校会话失效后需要重新登录。
                    </p>
                    <p className="small">
                      非学校官方应用。签到结果以学校系统为准。
                    </p>
                  </div>
                </aside>
              </div>
            )}
            <footer className="page-footer">
              <span>
                MengSign <span className="footer-dot">·</span>{" "}
                为每一天的学习，留一点从容
              </span>
              <span>MADE FOR UCAS</span>
            </footer>
          </main>
          <nav className="bottom-nav" aria-label="手机导航">
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => {
                  setTab(t.id);
                  window.scrollTo({ top: 0 });
                }}
              >
                <t.icon size={21} strokeWidth={tab === t.id ? 2 : 1.6} />
                <span>{t.name}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      {(installHelp || confirmClear) && (
        <Modal
          title={confirmClear ? "清除本机数据？" : "添加到主屏幕"}
          onClose={() => {
            setInstallHelp(false);
            setConfirmClear(false);
          }}
        >
          {confirmClear ? (
            <>
              <p>
                这会删除当前设备的课表缓存并退出登录，学校中的签到记录不会改变。
              </p>
              <button
                className="button primary"
                disabled={!online && !demo}
                onClick={() => void logout()}
              >
                清除并退出
              </button>
            </>
          ) : (
            <>
              <div className="install-step">
                <span>1</span>
                <p>
                  <strong>iPhone / iPad</strong>在 Safari
                  中打开，点击分享按钮，选择「添加到主屏幕」。
                </p>
              </div>
              <div className="install-step">
                <span>2</span>
                <p>
                  <strong>Android / 电脑</strong>
                  打开浏览器菜单，选择「安装应用」或「添加到主屏幕」。
                </p>
              </div>
              <p className="help">
                安装选项由浏览器提供；如果未出现，请使用新版 Safari、Chrome 或
                Edge。
              </p>
              <button
                className="button primary"
                onClick={() => setInstallHelp(false)}
              >
                知道了
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Login({
  onLogin,
  onDemo,
  notice,
  online,
}: {
  onLogin(p: Profile): void;
  onDemo(): void;
  notice: string;
  online: boolean;
}) {
  const [account, setAccount] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ profile: Profile }>("/api/auth/login", {
        account,
        password,
      });
      setPassword("");
      onLogin(result.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-intro">
        <span className="intro-badge">
          <span className="status-dot" />
          为国科大的每一天
        </span>
        <h1>
          少一点繁琐，
          <br />
          多一点<span>从容。</span>
        </h1>
        <p className="intro-description">
          课程、签到、下一段安排。
          <br />
          打开 MengSign，让今天清晰一点。
        </p>
        <div className="intro-preview">
          <div className="preview-icon">
            <CheckCheck size={26} />
          </div>
          <div>
            <strong>签到完成，专注此刻。</strong>
            <p>每一次到场，都值得被记录</p>
          </div>
          <span className="preview-check">
            <Check size={16} />
          </span>
        </div>
        <div className="intro-features">
          <span>
            <CalendarDays size={17} />
            今日课表
          </span>
          <span>
            <CheckCheck size={17} />
            轻松签到
          </span>
          <span>
            <QrCode size={17} />
            动态签到码
          </span>
        </div>
        <div className="intro-footnote">A LITTLE SIMPLER. A LITTLE CALMER.</div>
      </section>
      <section className="login-panel panel">
        <Logo large />
        <div className="login-title">
          <h2>欢迎来到 MengSign</h2>
          <p>登录学校账号，开启轻松的一天</p>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="account">
            学号 / SEP 邮箱
          </label>
          <input
            id="account"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="输入学号或 SEP 邮箱"
            maxLength={160}
            required
            disabled={busy}
          />
          <label className="field-label" htmlFor="password">
            密码
          </label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入对应的学校密码"
              maxLength={80}
              required
              disabled={busy}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={show ? "隐藏密码" : "显示密码"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          <p className="login-hint">支持 SEP 账号或轻新课堂账号</p>
          {(error || notice || !online) && (
            <div className="notice error" role="alert">
              {!online ? "当前离线，联网后即可登录" : error || notice}
            </div>
          )}
          <button
            className="button primary login-submit"
            disabled={busy || !online}
          >
            {busy ? (
              <>
                <LoaderCircle size={18} className="spin" />
                正在登录学校…
              </>
            ) : (
              <>
                登录
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <div className="login-privacy">
          <ShieldCheck size={15} />
          <span>密码仅用于学校验证，不会被保存</span>
        </div>
        <div className="login-divider">
          <span>先认识一下</span>
        </div>
        <button className="button demo-button" onClick={onDemo} disabled={busy}>
          体验演示模式
          <ArrowRight size={16} />
        </button>
        <p className="login-legal">
          非学校官方应用 ·{" "}
          <a
            href="https://github.com/576690/MengSign"
            target="_blank"
            rel="noreferrer"
          >
            开源项目
          </a>
        </p>
      </section>
      <footer className="login-footer">
        MengSign<span>轻松签到，专注当下。</span>
      </footer>
    </main>
  );
}
