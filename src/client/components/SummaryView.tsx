import { useEffect, useState } from "react";
import type { MonthlySummary } from "../../shared/types";
import { formatMinutes, formatSignedMinutes } from "../../shared/time";
import { api } from "../api";
import { errMsg } from "../App";
import { MonthlyBarChart } from "./MonthlyBarChart";

interface Props {
  year: string;
  onChangeYear: (y: string) => void;
  onSelectMonth: (month: string) => void;
  targetMinutes: number;
}

export function SummaryView({ year, onChangeYear, onSelectMonth, targetMinutes }: Props) {
  const [data, setData] = useState<MonthlySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api
      .getYearlySummary(year)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [year]);

  const total = data?.reduce((s, m) => s + m.totalMinutes, 0) ?? 0;
  const days = data?.reduce((s, m) => s + m.workDays, 0) ?? 0;
  const activeMonths = data?.filter((m) => m.workDays > 0).length ?? 0;

  return (
    <div>
      <div className="table-toolbar">
        <div className="month-nav">
          <button className="btn btn-icon" aria-label="前年" onClick={() => onChangeYear(String(Number(year) - 1))}>
            ‹
          </button>
          <span className="month-label">{year}年</span>
          <button className="btn btn-icon" aria-label="翌年" onClick={() => onChangeYear(String(Number(year) + 1))}>
            ›
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-label">年間労働時間</span>
          <span className="stat-value">{data ? formatMinutes(total) : "…"}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">出勤日数</span>
          <span className="stat-value">{data ? `${days} 日` : "…"}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">月平均 (稼働月)</span>
          <span className="stat-value">{data ? formatMinutes(activeMonths ? Math.round(total / activeMonths) : 0) : "…"}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">1 日平均</span>
          <span className="stat-value">{data ? formatMinutes(days ? Math.round(total / days) : 0) : "…"}</span>
        </div>
      </div>

      <h3 className="chart-title">月別労働時間</h3>
      {data ? (
        <MonthlyBarChart data={data} onSelectMonth={onSelectMonth} targetMinutes={targetMinutes} />
      ) : (
        <div className="chart-placeholder">読み込み中…</div>
      )}

      {data && (
        <div className="table-wrap">
          <table className="records summary-table">
            <thead>
              <tr>
                <th>月</th>
                <th>出勤日数</th>
                <th>労働時間</th>
                <th>1 日平均</th>
                {targetMinutes > 0 && <th>目標比</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.month} className={m.workDays === 0 ? "empty" : ""}>
                  <td className="col-date">{Number(m.month.slice(5))}月</td>
                  <td>{m.workDays}</td>
                  <td className="col-work">{formatMinutes(m.totalMinutes)}</td>
                  <td>{m.workDays ? formatMinutes(Math.round(m.totalMinutes / m.workDays)) : "-"}</td>
                  {targetMinutes > 0 && (
                    <td className={m.workDays === 0 ? "" : m.totalMinutes >= targetMinutes ? "diff-good" : "diff-bad"}>
                      {m.workDays === 0 ? "-" : formatSignedMinutes(m.totalMinutes - targetMinutes)}
                    </td>
                  )}
                  <td className="col-action">
                    <button className="btn btn-sm" onClick={() => onSelectMonth(m.month)}>
                      勤務表
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
