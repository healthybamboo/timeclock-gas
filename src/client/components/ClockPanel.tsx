import { useEffect, useState } from "react";
import type { StatusResponse } from "../../shared/types";
import { formatMinutes, formatTime } from "../../shared/time";

interface Props {
  status: StatusResponse | null;
  busy: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function ClockPanel({ status, busy, onClockIn, onClockOut }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const sessions = status?.todaySessions ?? [];
  const open = status?.openSession ?? null;
  const closedMinutes = sessions.reduce((s, x) => s + (x.workMinutes ?? 0), 0);
  const state: "before" | "working" | "out" = open ? "working" : sessions.length === 0 ? "before" : "out";
  const p = (n: number) => String(n).padStart(2, "0");
  const lastSession = sessions[sessions.length - 1] ?? null;

  return (
    <section className="card clock-card">
      <div className="clock-date">
        {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日 ({WEEK[now.getDay()]})
      </div>
      <div className="clock-time">
        {p(now.getHours())}:{p(now.getMinutes())}
        <span className="clock-sec">:{p(now.getSeconds())}</span>
      </div>

      <div className={`status-pill status-${state}`}>
        {state === "before" && "未出勤"}
        {state === "working" &&
          `勤務中 ・ ${formatTime(open!.clockIn, status?.today)} 出勤${closedMinutes > 0 ? ` ・ 本日 ${formatMinutes(closedMinutes)} 済` : ""}`}
        {state === "out" && `退勤済み ・ 本日 ${formatMinutes(closedMinutes)} 勤務`}
      </div>

      <div className="punch-buttons">
        <button className="punch punch-in" disabled={busy || !status || state === "working"} onClick={onClockIn}>
          <span className="punch-label">{state === "out" ? "再出勤" : "出勤"}</span>
          <span className="punch-sub">{state === "working" ? formatTime(open!.clockIn, status?.today) : "—"}</span>
        </button>
        <button className="punch punch-out" disabled={busy || !status || state !== "working"} onClick={onClockOut}>
          <span className="punch-label">退勤</span>
          <span className="punch-sub">{state === "out" && lastSession ? formatTime(lastSession.clockOut, status?.today) : "—"}</span>
        </button>
      </div>

      {sessions.length > 0 && (
        <ol className="today-sessions" aria-label="本日の勤務">
          {sessions.map((s, i) => (
            <li key={s.id}>
              <span className="session-idx">{i + 1}</span>
              <span className="session-range">
                {formatTime(s.clockIn, status?.today)} – {s.clockOut ? formatTime(s.clockOut, status?.today) : <em>勤務中</em>}
              </span>
              <span className="session-work">{s.workMinutes != null ? formatMinutes(s.workMinutes) : ""}</span>
            </li>
          ))}
        </ol>
      )}
      {state === "out" && <p className="hint">中抜けから戻ったら「再出勤」を押してください。修正は下の勤務表からできます。</p>}
    </section>
  );
}
