import type { AttendanceRecord, Holiday } from "../../shared/types";
import { dayOfWeek, daysInMonth, formatMinutes, formatTime, pad2 } from "../../shared/time";
import { MonthNav } from "./MonthNav";
import { TargetProgress } from "./TargetProgress";

interface Props {
  month: string;
  records: AttendanceRecord[];
  holidays: Holiday[];
  loading: boolean;
  today?: string;
  targetMinutes?: number;
  onOpenSettings: () => void;
  onChangeMonth: (m: string) => void;
  onEdit: (date: string, record: AttendanceRecord | null) => void;
  onEditHoliday: (date: string, holiday: Holiday | null) => void;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function MonthlyTable({
  month,
  records,
  holidays,
  loading,
  today,
  targetMinutes,
  onOpenSettings,
  onChangeMonth,
  onEdit,
  onEditHoliday,
}: Props) {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad2(i + 1)}`);
  const totalMinutes = records.reduce((s, r) => s + (r.workMinutes ?? 0), 0);
  const workDays = records.filter((r) => r.clockIn).length;

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
              const r = byDate.get(date) ?? null;
              const h = holidayByDate.get(date) ?? null;
              const dow = dayOfWeek(date);
              const cls = [
                dow === 0 ? "sun" : dow === 6 ? "sat" : "",
                date === today ? "today" : "",
                r ? "" : "empty",
                h ? "holiday" : "",
              ]
                .filter(Boolean)
                .join(" ");
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
                  </td>
                  <td>{formatTime(r?.clockIn ?? null, date)}</td>
                  <td>{formatTime(r?.clockOut ?? null, date)}</td>
                  <td>{r ? formatMinutes(r.breakMinutes) : "-"}</td>
                  <td className="col-work">{r ? formatMinutes(r.workMinutes) : "-"}</td>
                  <td className="col-note">
                    {r?.note}
                    {h?.note && <span className="holiday-note">{r?.note ? " / " : ""}休: {h.note}</span>}
                  </td>
                  <td className="col-action">
                    <button className="btn btn-sm" onClick={() => onEdit(date, r)}>
                      {r ? "編集" : "追加"}
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
