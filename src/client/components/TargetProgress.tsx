import { calcTargetPace, formatMinutes, formatSignedMinutes } from "../../shared/time";

interface Props {
  month: string;
  today: string;
  actualMinutes: number;
  targetMinutes: number;
  holidayDates: string[];
  onOpenSettings: () => void;
}

export function TargetProgress({ month, today, actualMinutes, targetMinutes, holidayDates, onOpenSettings }: Props) {
  if (targetMinutes <= 0) {
    return (
      <div className="target">
        <span className="hint">
          目標労働時間が未設定です。
          <button className="btn-link" onClick={onOpenSettings}>
            設定する
          </button>
        </span>
      </div>
    );
  }

  const pace = calcTargetPace(month, today, actualMinutes, targetMinutes, holidayDates);
  const ratio = Math.min(1, actualMinutes / targetMinutes);
  const expectedRatio = Math.min(1, pace.expectedMinutes / targetMinutes);
  const achieved = actualMinutes >= targetMinutes;
  const todayMonth = today.slice(0, 7);
  const isFuture = month > todayMonth;
  const isPast = month < todayMonth;
  const isCurrent = !isFuture && !isPast;
  const onTrack = pace.diffMinutes >= 0;

  let verdict: { cls: string; icon: string; text: string };
  if (achieved) verdict = { cls: "good", icon: "✓", text: "目標達成" };
  else if (isFuture) verdict = { cls: "neutral", icon: "·", text: "未開始" };
  else if (isPast) verdict = { cls: "bad", icon: "✕", text: `未達 (残り ${formatMinutes(pace.remainingMinutes)})` };
  else if (onTrack) verdict = { cls: "good", icon: "✓", text: `順調 (目安より ${formatSignedMinutes(pace.diffMinutes)})` };
  else verdict = { cls: "warn", icon: "!", text: `遅れ (目安より ${formatSignedMinutes(pace.diffMinutes)})` };

  return (
    <div className="target">
      <div className="target-head">
        <span className="target-title">
          月の目標 <strong>{formatMinutes(targetMinutes)}</strong>
          <button className="btn-link" onClick={onOpenSettings} aria-label="目標を変更">
            変更
          </button>
        </span>
        <span className={`verdict verdict-${verdict.cls}`}>
          <span className="verdict-icon">{verdict.icon}</span>
          {verdict.text}
        </span>
      </div>
      <div className="target-bar" role="progressbar" aria-valuemin={0} aria-valuemax={targetMinutes} aria-valuenow={actualMinutes}>
        <div className={`target-fill ${achieved ? "good" : onTrack || isFuture ? "" : "warn"}`} style={{ width: `${ratio * 100}%` }} />
        {isCurrent && !achieved && <div className="target-marker" style={{ left: `${expectedRatio * 100}%` }} title="今日時点の目安" />}
      </div>
      <div className="target-meta">
        <span>
          実績 <strong>{formatMinutes(actualMinutes)}</strong>
        </span>
        {isCurrent && (
          <span>
            今日時点の目安 <strong>{formatMinutes(pace.expectedMinutes)}</strong>
            <span className="muted">
              {" "}
              (稼働 {pace.elapsedWorkDays}/{pace.workDays} 日)
            </span>
          </span>
        )}
        <span>
          残り <strong>{formatMinutes(pace.remainingMinutes)}</strong>
          {isCurrent && !achieved && pace.perDayNeededMinutes != null && (
            <span className="muted">
              {" "}
              (残り稼働 {pace.remainingWorkDays} 日 → 1 日 {formatMinutes(pace.perDayNeededMinutes)})
            </span>
          )}
        </span>
        <span>
          休日 <strong>{pace.holidayCount}</strong> 日
          <span className="muted"> (稼働日 {pace.workDays} 日)</span>
        </span>
      </div>
    </div>
  );
}
