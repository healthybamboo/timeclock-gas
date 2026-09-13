import { useEffect, useState } from "react";
import type { SessionInput, WorkSession } from "../../shared/types";
import { formatMinutes, formatTime } from "../../shared/time";
import { sortSessions } from "../../shared/logic";
import { errMsg } from "../App";
import { SessionForm } from "./SessionForm";

interface Props {
  date: string;
  sessions: WorkSession[];
  onClose: () => void;
  onSave: (input: SessionInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Mode = { kind: "list" } | { kind: "edit"; session: WorkSession } | { kind: "new" };

export function DayModal({ date, sessions, onClose, onSave, onDelete }: Props) {
  const sorted = sortSessions(sessions);
  const [mode, setMode] = useState<Mode>(() => (sessions.length === 0 ? { kind: "new" } : { kind: "list" }));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = sorted.reduce((s, x) => s + (x.workMinutes ?? 0), 0);
  const last = sorted[sorted.length - 1];
  const defaultClockIn = last?.clockOut ?? undefined;

  async function save(input: SessionInput) {
    await onSave(input);
    setMode({ kind: "list" });
  }

  async function remove(id: string) {
    setError(null);
    setBusy(true);
    try {
      await onDelete(id);
      setConfirmId(null);
      if (sorted.length <= 1) onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-day" role="dialog" aria-modal="true">
        <h2>
          {date} の勤務
          {mode.kind === "edit" && <span className="modal-sub"> ・ 編集</span>}
          {mode.kind === "new" && <span className="modal-sub"> ・ 追加</span>}
        </h2>

        {mode.kind === "list" && (
          <>
            <ul className="session-list">
              {sorted.map((s, i) => (
                <li key={s.id} className="session-item">
                  <span className="session-idx">{i + 1}</span>
                  <div className="session-body">
                    <div className="session-range">
                      {formatTime(s.clockIn, date)} – {s.clockOut ? formatTime(s.clockOut, date) : <em>勤務中</em>}
                      <span className="muted"> ・ 休憩 {s.breakMinutes} 分</span>
                    </div>
                    {s.note && <div className="session-note">{s.note}</div>}
                  </div>
                  <span className="session-work">{s.workMinutes != null ? formatMinutes(s.workMinutes) : "-"}</span>
                  <span className="session-actions">
                    {confirmId === s.id ? (
                      <>
                        <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(s.id)}>
                          削除する
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setConfirmId(null)}>
                          やめる
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-sm" onClick={() => setMode({ kind: "edit", session: s })}>
                          編集
                        </button>
                        <button type="button" className="btn btn-sm btn-link-danger" onClick={() => setConfirmId(s.id)}>
                          削除
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="preview">
              合計労働時間: <strong>{formatMinutes(total)}</strong>
              <span className="muted"> ({sorted.length} 回の勤務)</span>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setMode({ kind: "new" })}>
                ＋ 勤務を追加
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn-primary" onClick={onClose}>
                閉じる
              </button>
            </div>
          </>
        )}

        {mode.kind === "edit" && (
          <SessionForm date={date} session={mode.session} onSave={save} onCancel={() => setMode({ kind: "list" })} />
        )}
        {mode.kind === "new" && (
          <SessionForm
            date={date}
            session={null}
            defaultClockIn={defaultClockIn}
            onSave={save}
            onCancel={() => (sorted.length === 0 ? onClose() : setMode({ kind: "list" }))}
          />
        )}
      </div>
    </div>
  );
}
