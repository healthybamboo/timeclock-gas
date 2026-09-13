import { Fragment } from "react";
import type { Holiday, WorkSession } from "../../shared/types";
import { dayOfWeek, daysInMonth, formatMinutes, formatTime, pad2 } from "../../shared/time";
import { groupByDate } from "../../shared/logic";
import { MonthNav } from "./MonthNav";
import { TargetProgress } from "./TargetProgress";

interface Props {
  month: string;
  sessions: WorkSession[];
  holidays: Holiday[];
  loading: boolean;
  today?: string;
  targetMinutes?: number;
  onOpenSettings: () => void;
  onChangeMonth: (m: string) => void;
  onEditDay: (date: string) => void;
  onEditHoliday: (date: string, holiday: Holiday | null) => void;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function MonthlyTable({
  month,
  sessions,
  holidays,
  loading,
  today,
  targetMinutes,
  onOpenSettings,
  onChangeMonth,
  onEditDay,
  onEditHoliday,
}: Props) {
  const byDate = groupByDate(sessions);
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad2(i + 1)}`);
  const totalMinutes = sessions.reduce((s, r) => s + (r.workMinutes ?? 0), 0);
  const workDays = new Set(sessions.filter((r) => r.clockIn).map((r) => r.date)).size;

  return (
    <div>
      <div className="table-toolbar">
        <MonthNav month={month} onChange={onChangeMonth} />
        <div className="summary">
          <span>
            出勤日数 <strong>{workDays}</strong> 日
          </span>
          <span>
            総労働時間 <strong>{formatMinutes(totalMinutes)}</strong>
          </span>
        </div>
      </div>

      {today && targetMinutes != null && (
        <TargetProgress
          month={month}
          today={today}
          actualMinutes={totalMinutes}
          targetMinutes={targetMinutes}
          holidayDates={holidays.map((h) => h.date)}
          onOpenSettings={onOpenSettings}
        />
      )}

      <div className={loading ? "table-wrap loading" : "table-wrap"}>
        <table className="records">
          <thead>
            <tr>
              <th>日付</th>
              <th>出勤</th>
              <th>退勤</th>
              <th>休憩</th>
              <th>労働時間</th>
              <th className="col-note">備考</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const day = byDate.get(date) ?? null;
              const h = holidayByDate.get(date) ?? null;
              const dow = dayOfWeek(date);
              const cls = [
                dow === 0 ? "sun" : dow === 6 ? "sat" : "",
                date === today ? "today" : "",
                day ? "" : "empty",
                h ? "holiday" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const list = day?.sessions ?? [];
              return (
                <tr key={date} className={cls}>
                  <td className="col-date">
                    {Number(date.slice(8))}
                    <span className="dow">({WEEK[dow]})</span>
                    {h && (
                      <span className="holiday-badge" title={h.note || "休日"}>
                        休
                      </span>
                    )}
                    {list.length > 1 && <span className="session-count">{list.length} 回</span>}
                  </td>
                  <td className="col-stack">{list.length ? list.map((s) => <div key={s.id}>{formatTime(s.clockIn, date)}</div>) : "-"}</td>
                  <td className="col-stack">
                    {list.length
                      ? list.map((s) => (
                          <div key={s.id} className={s.clockOut ? "" : "open"}>
                            {s.clockOut ? formatTime(s.clockOut, date) : "勤務中"}
                          </div>
                        ))
                      : "-"}
                  </td>
                  <td className="col-stack">{list.length ? list.map((s) => <div key={s.id}>{formatMinutes(s.breakMinutes)}</div>) : "-"}</td>
                  <td className="col-work">{day ? formatMinutes(day.workMinutes) : "-"}</td>
                  <td className="col-note">
                    {day?.notes.map((n, i) => (
                      <Fragment key={i}>
                        {i > 0 && " / "}
                        {n}
                      </Fragment>
                    ))}
                    {h?.note && <span className="holiday-note">{day?.notes.length ? " / " : ""}休: {h.note}</span>}
                  </td>
                  <td className="col-action">
                    <button className="btn btn-sm" onClick={() => onEditDay(date)}>
                      {day ? "編集" : "追加"}
                    </button>
                    <button
                      className={h ? "btn btn-sm btn-holiday active" : "btn btn-sm btn-holiday"}
                      title={h ? "休日を編集 / 解除" : "休日にする"}
                      aria-label={h ? `${date} の休日を編集` : `${date} を休日にする`}
                      onClick={() => onEditHoliday(date, h)}
                    >
                      休
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
