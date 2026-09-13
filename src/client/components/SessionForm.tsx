import { useState, type FormEvent } from "react";
import type { SessionInput, WorkSession } from "../../shared/types";
import { calcWorkMinutes, formatMinutes, isLocalDateTime } from "../../shared/time";
import { errMsg } from "../App";

interface Props {
  date: string;
  session: WorkSession | null;
  /** 新規作成時の出勤時刻の初期値 (前のセッションの退勤時刻など) */
  defaultClockIn?: string;
  onSave: (input: SessionInput) => Promise<void>;
  onCancel: () => void;
}

export function SessionForm({ date, session, defaultClockIn, onSave, onCancel }: Props) {
  const [clockIn, setClockIn] = useState(session?.clockIn ?? defaultClockIn ?? `${date}T09:00`);
  const [clockOut, setClockOut] = useState(session?.clockOut ?? "");
  const [breakMinutes, setBreakMinutes] = useState(String(session?.breakMinutes ?? 0));
  const [note, setNote] = useState(session?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const brk = Number(breakMinutes) || 0;
  const preview = isLocalDateTime(clockIn) && isLocalDateTime(clockOut) ? calcWorkMinutes(clockIn, clockOut, brk) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLocalDateTime(clockIn)) return setError("出勤時刻を正しく入力してください");
    if (clockOut && !isLocalDateTime(clockOut)) return setError("退勤時刻を正しく入力してください");
    if (clockOut && clockOut < clockIn) return setError("退勤時刻は出勤時刻より後にしてください");
    if (brk < 0) return setError("休憩時間は 0 以上で入力してください");
    setSaving(true);
    try {
      await onSave({ id: session?.id, date, clockIn, clockOut: clockOut || null, breakMinutes: brk, note });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="session-form" onSubmit={submit}>
      <label className="field">
        <span>出勤</span>
        <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} step={60} autoFocus />
      </label>
      <label className="field">
        <span>退勤</span>
        <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} step={60} />
      </label>
      <label className="field">
        <span>休憩 (分)</span>
        <input type="number" min={0} step={5} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
      </label>
      <label className="field">
        <span>備考</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="打刻忘れ、直行 など" />
      </label>
      <div className="preview">
        労働時間: <strong>{formatMinutes(preview)}</strong>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          戻る
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
