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

  const record = status?.record ?? null;
  const state: "before" | "working" | "done" = !record?.clockIn ? "before" : record.clockOut ? "done" : "working";
  const p = (n: number) => String(n).padStart(2, "0");

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
        {state === "working" && `勤務中 ・ ${formatTime(record!.clockIn)} 出勤`}
        {state === "done" && `退勤済み ・ ${formatMinutes(record!.workMinutes)} 勤務`}
      </div>

      <div className="punch-buttons">
        <button className="punch punch-in" disabled={busy || !status || state !== "before"} onClick={onClockIn}>
          <span className="punch-label">出勤</span>
          <span className="punch-sub">{record?.clockIn ? formatTime(record.clockIn) : "—"}</span>
        </button>
        <button className="punch punch-out" disabled={busy || !status || state !== "working"} onClick={onClockOut}>
          <span className="punch-label">退勤</span>
          <span className="punch-sub">{record?.clockOut ? formatTime(record.clockOut, record.date) : "—"}</span>
        </button>
      </div>
      {state === "done" && <p className="hint">打刻を修正する場合は下の勤務表から編集してください。</p>}
    </section>
  );
}
