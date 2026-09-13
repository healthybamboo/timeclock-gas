import { useEffect, useState, type FormEvent } from "react";
import type { Holiday } from "../../shared/types";
import { errMsg } from "../App";

interface Props {
  date: string;
  holiday: Holiday | null;
  onClose: () => void;
  onSave: (date: string, note: string) => Promise<void>;
  onRemove: (date: string) => Promise<void>;
}

export function HolidayModal({ date, holiday, onClose, onSave, onRemove }: Props) {
  const [note, setNote] = useState(holiday?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => onSave(date, note));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>
          {date} を休日に{holiday ? "設定中" : "する"}
        </h2>
        <p className="modal-desc">休日に設定した日は稼働日から外れ、目標の按分（今日時点の目安）に含まれなくなります。</p>
        <label className="field">
          <span>メモ</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="予定あり、通院 など" autoFocus />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          {holiday && (
            <button type="button" className="btn btn-link-danger" disabled={busy} onClick={() => run(() => onRemove(date))}>
              休日を解除
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "保存中…" : holiday ? "メモを保存" : "休日にする"}
          </button>
        </div>
      </form>
    </div>
  );
}
