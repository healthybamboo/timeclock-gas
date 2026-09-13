import { useEffect, useState, type FormEvent } from "react";
import type { AttendanceRecord, RecordInput } from "../../shared/types";
import { calcWorkMinutes, formatMinutes, isLocalDateTime } from "../../shared/time";
import { errMsg } from "../App";

interface Props {
  date: string;
  record: AttendanceRecord | null;
  onClose: () => void;
  onSave: (input: RecordInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function EditModal({ date, record, onClose, onSave, onDelete }: Props) {
  const [clockIn, setClockIn] = useState(record?.clockIn ?? `${date}T09:00`);
  const [clockOut, setClockOut] = useState(record?.clockOut ?? "");
  const [breakMinutes, setBreakMinutes] = useState(String(record?.breakMinutes ?? 0));
  const [note, setNote] = useState(record?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const brk = Number(breakMinutes) || 0;
  const preview = isLocalDateTime(clockIn) && isLocalDateTime(clockOut) ? calcWorkMinutes(clockIn, clockOut, brk) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (clockIn && !isLocalDateTime(clockIn)) return setError("出勤時刻を正しく入力してください");
    if (clockOut && !isLocalDateTime(clockOut)) return setError("退勤時刻を正しく入力してください");
    if (clockIn && clockOut && clockOut < clockIn) return setError("退勤時刻は出勤時刻より後にしてください");
    if (brk < 0) return setError("休憩時間は 0 以上で入力してください");
    setSaving(true);
    try {
      await onSave({ id: record?.id, date, clockIn: clockIn || null, clockOut: clockOut || null, breakMinutes: brk, note });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!record) return;
    setSaving(true);
    try {
      await onDelete(record.id);
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>
          {date} の勤怠を{record ? "編集" : "追加"}
        </h2>

        <label className="field">
          <span>出勤</span>
          <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} step={60} />
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
          {record &&
            (confirmDelete ? (
              <span className="delete-confirm">
                本当に削除しますか?
                <button type="button" className="btn btn-danger" disabled={saving} onClick={remove}>
                  削除する
                </button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                  やめる
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-link-danger" onClick={() => setConfirmDelete(true)}>
                削除
              </button>
            ))}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
