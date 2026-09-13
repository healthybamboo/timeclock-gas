import { useEffect, useState, type FormEvent } from "react";
import type { UserSettings } from "../../shared/types";
import { formatMinutes } from "../../shared/time";
import { errMsg } from "../App";

interface Props {
  settings: UserSettings;
  onClose: () => void;
  onSave: (settings: UserSettings) => Promise<void>;
}

export function SettingsModal({ settings, onClose, onSave }: Props) {
  const [hours, setHours] = useState(String(settings.monthlyTargetMinutes / 60));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const minutes = Math.round(Number(hours) * 60);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(minutes) || minutes < 0) return setError("目標労働時間は 0 以上で入力してください");
    setSaving(true);
    try {
      await onSave({ monthlyTargetMinutes: minutes });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>設定</h2>
        <label className="field">
          <span>月の目標 (時間)</span>
          <input type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} autoFocus />
        </label>
        <div className="preview">
          月あたり <strong>{Number.isFinite(minutes) ? formatMinutes(Math.max(0, minutes)) : "-"}</strong> を目標にします。
          勤務表では暦日で按分した「今日時点の目安」と実績を比較します。
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
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
