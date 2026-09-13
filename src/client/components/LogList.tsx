import { useEffect, useState } from "react";
import type { PunchLog } from "../../shared/types";
import { api } from "../api";
import { errMsg } from "../App";
import { MonthNav } from "./MonthNav";

const LABEL: Record<PunchLog["type"], string> = { IN: "出勤", OUT: "退勤", EDIT: "編集", DELETE: "削除" };

export function LogList({ month, onChangeMonth }: { month: string; onChangeMonth: (m: string) => void }) {
  const [logs, setLogs] = useState<PunchLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLogs(null);
    api
      .listLogs(month)
      .then((l) => alive && setLogs(l))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [month]);

  return (
    <div>
      <div className="table-toolbar">
        <MonthNav month={month} onChange={onChangeMonth} />
      </div>
      {error && <div className="form-error">{error}</div>}
      {logs === null ? (
        <p className="hint">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="hint">この月の打刻履歴はありません。</p>
      ) : (
        <ul className="logs">
          {logs.map((l, i) => (
            <li key={i}>
              <span className="log-time">{l.timestamp.replace("T", " ")}</span>
              <span className={`log-type log-${l.type.toLowerCase()}`}>{LABEL[l.type]}</span>
              <span className="log-detail">{l.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
