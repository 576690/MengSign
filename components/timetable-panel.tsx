"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  LayoutGrid,
  List,
  RefreshCw,
  X,
} from "lucide-react";
import { api, ClientError, demoCourses } from "@/lib/client";
import { shanghaiDay, timeLabel, todaySorted } from "@/lib/course";
import { dateLabel, isOngoing, weekDays } from "@/lib/timetable";
import { readTimetable, writeTimetable } from "@/lib/timetable-cache";
import type { Course, Profile, TimetableResult } from "@/lib/types";

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export default function TimetablePanel({
  profile,
  demo,
  online,
  now,
  onExpired,
  demoToday,
}: {
  profile: Profile;
  demo: boolean;
  online: boolean;
  now: number;
  onExpired(): void;
  demoToday: Course[];
}) {
  const today = shanghaiDay(now),
    days = weekDays(today),
    start = days[0];
  const [data, setData] = useState<TimetableResult | null>(null);
  const [selectedDay, setSelectedDay] = useState(today);
  const [view, setView] = useState<"week" | "day">("week");
  const [detail, setDetail] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false),
    [cached, setCached] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0),
    busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const demoRef = useRef(demoToday);
  demoRef.current = demoToday;
  const refresh = useCallback(async () => {
    if (busy.current) return;
    const epoch = generation.current;
    if (demo) {
      const sample = demoCourses().courses;
      const courses = weekDays(start).flatMap((day, index) =>
        day === shanghaiDay(now)
          ? demoRef.current
          : index >= 5
            ? []
            : sample.slice(index % 2, (index % 2) + 2).map((c, n) => ({
                ...c,
                id: `${day}-${n}`,
                day,
                signed: false,
              })),
      );
      setData({
        weekStart: start,
        weekEnd: weekDays(start)[6],
        courses,
        updatedAt: Date.now(),
      });
      setCached(false);
      setError("");
      return;
    }
    if (!online) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await api<TimetableResult & { accountKey: string }>(
        "/api/timetable",
      );
      if (epoch !== generation.current) return;
      if (result.accountKey !== profile.accountKey) {
        onExpired();
        return;
      }
      if (result.weekStart !== start)
        throw new Error("日期已切换，请重新打开课表");
      setData(result);
      setCached(false);
      writeTimetable(profile.accountKey, result);
    } catch (e) {
      if (epoch !== generation.current) return;
      if (e instanceof ClientError && e.status === 401) {
        onExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "周课表加载失败");
      setCached(true);
    } finally {
      if (epoch === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [demo, online, profile.accountKey, start, onExpired]);
  useEffect(() => {
    generation.current++;
    busy.current = false;
    setData((previous) =>
      !online && previous?.weekStart === start
        ? previous
        : demo
          ? null
          : readTimetable(profile.accountKey, start),
    );
    setLoading(false);
    setCached(!demo);
    setError("");
    setDetail(null);
    const timer = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(timer);
      generation.current++;
      busy.current = false;
    };
  }, [refresh, demo, profile.accountKey, start]);
  useEffect(() => {
    setSelectedDay(today);
  }, [today]);
  useEffect(() => {
    if (matchMedia("(max-width:760px)").matches) setView("day");
  }, []);
  useEffect(() => {
    if (detail) dialog.current?.showModal();
  }, [detail]);
  const displayed = data?.weekStart === start ? data.courses : [];
  const dayCourses = todaySorted(displayed, selectedDay);
  function courseButton(c: Course, index: number) {
    const ongoing = c.day === today && isOngoing(c, now);
    return (
      <button
        key={`${c.day}-${c.id || c.uuid}-${index}`}
        className={`timetable-course ${ongoing ? "ongoing" : ""}`}
        onClick={() => setDetail(c)}
      >
        <span className="timetable-time">
          <Clock3 size={13} />
          {timeLabel(c)}–{timeLabel(c, true)}
        </span>
        <strong>{c.name}</strong>
        <span className="timetable-teacher">
          {c.teacher || "教师信息待更新"}
        </span>
        {ongoing ? (
          <span className="timetable-badge">正在上课</span>
        ) : c.signed ? (
          <span className="timetable-badge">
            <Check size={12} />
            已签到
          </span>
        ) : null}
      </button>
    );
  }
  return (
    <section className="timetable-panel panel" aria-label="本周课表">
      <div className="timetable-toolbar">
        <div>
          <span className="eyebrow">
            本周 · {dateLabel(start)}—{dateLabel(days[6])}
          </span>
          <h2>一周安排，心中有数</h2>
        </div>
        <div className="timetable-actions">
          <button
            className="text-button"
            disabled={loading || (!online && !demo)}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {loading ? "同步中" : "刷新课表"}
          </button>
          <div className="view-switch" aria-label="课表视图">
            <button
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              <LayoutGrid size={16} />
              周视图
            </button>
            <button
              aria-pressed={view === "day"}
              onClick={() => setView("day")}
            >
              <List size={16} />
              按日
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          {data && " · 当前显示之前保存的课表"}
        </div>
      )}
      {!online && !demo && (
        <p className="help timetable-offline">
          离线查看{data ? "本机保存的本周课表" : "暂无本周缓存，联网后请刷新"}
        </p>
      )}
      {loading && !data ? (
        <div className="skeleton-list" aria-label="正在加载本周课表">
          {[1, 2, 3].map((i) => (
            <div key={i} />
          ))}
        </div>
      ) : !data ? (
        <div className="empty-state">
          <CalendarDays size={40} />
          <h3>暂未获取到本周课表</h3>
          <p>请检查网络后点击刷新，不会将查询失败显示为无课。</p>
        </div>
      ) : (
        <>
          {view === "week" ? (
            <div
              className="timetable-scroll"
              tabIndex={0}
              aria-label="本周七天课程，可横向滚动"
            >
              <div className="week-grid">
                {days.map((day, i) => (
                  <section
                    className={`week-column ${day === today ? "is-today" : ""}`}
                    key={day}
                  >
                    <button
                      className="week-day-heading"
                      onClick={() => {
                        setSelectedDay(day);
                        setView("day");
                      }}
                    >
                      <span>
                        {weekdays[i]}
                        {day === today && <small>今天</small>}
                      </span>
                      <strong>{Number(day.slice(6, 8))}</strong>
                    </button>
                    <div className="week-day-courses">
                      {todaySorted(displayed, day).length ? (
                        todaySorted(displayed, day).map(courseButton)
                      ) : (
                        <span className="no-classes">暂无课程</span>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="day-picker" aria-label="选择日期">
                {days.map((day, i) => (
                  <button
                    key={day}
                    aria-pressed={selectedDay === day}
                    onClick={() => setSelectedDay(day)}
                  >
                    <span>{weekdays[i]}</span>
                    <strong>{Number(day.slice(6, 8))}</strong>
                    <small>
                      {day === today
                        ? "今天"
                        : todaySorted(displayed, day).length
                          ? `${todaySorted(displayed, day).length} 节`
                          : "无课"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="day-summary">
                <h3>
                  {dateLabel(selectedDay)} ·{" "}
                  {weekdays[days.indexOf(selectedDay)]}
                </h3>
                <span>{dayCourses.length} 节课程</span>
              </div>
              {dayCourses.length ? (
                <div className="day-course-list">
                  {dayCourses.map(courseButton)}
                </div>
              ) : (
                <div className="empty-state">
                  <BookOpen size={36} strokeWidth={1.4} />
                  <h3>这一天没有课程安排</h3>
                  <p>留一点时间，按自己的节奏来。</p>
                </div>
              )}
            </>
          )}
          <div className="sync-line">
            <span className="status-dot" />
            {demo ? "示例课表" : cached ? "本机缓存" : "学校课表"} ·{" "}
            {new Intl.DateTimeFormat("zh-CN", {
              timeZone: "Asia/Shanghai",
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(data.updatedAt)}
            <span>共 {displayed.length} 节</span>
          </div>
        </>
      )}
      {detail && (
        <dialog
          ref={dialog}
          className="modal course-dialog"
          onCancel={() => setDetail(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="section-heading">
            <h2>课程详情</h2>
            <button
              className="icon-button"
              aria-label="关闭课程详情"
              onClick={() => setDetail(null)}
            >
              <X size={20} />
            </button>
          </div>
          <h3>{detail.name}</h3>
          <dl>
            <div>
              <dt>日期</dt>
              <dd>
                {dateLabel(detail.day)} · {weekdays[days.indexOf(detail.day)]}
              </dd>
            </div>
            <div>
              <dt>时间</dt>
              <dd>
                {timeLabel(detail)}—{timeLabel(detail, true)}
              </dd>
            </div>
            <div>
              <dt>教师</dt>
              <dd>{detail.teacher || "学校暂未提供"}</dd>
            </div>
            <div>
              <dt>签到状态</dt>
              <dd>
                {detail.signed ? "已签到" : "未显示已签到"}
                {(cached || demo) && (demo ? "（示例）" : "（缓存）")}
              </dd>
            </div>
          </dl>
          <p className="help">
            签到状态以学校最新结果为准。需要签到时，请返回「今日」页面。
          </p>
          <button className="button primary" onClick={() => setDetail(null)}>
            知道了
          </button>
        </dialog>
      )}
    </section>
  );
}
