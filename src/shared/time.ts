// タイムゾーンに依存しない日時文字列ユーティリティ (サーバー/クライアント共通)

const DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isLocalDateTime(s: unknown): s is string {
  return typeof s === "string" && DT_RE.test(s);
}

/** "YYYY-MM-DDTHH:mm" → エポックからの分数 (UTC として解釈、差分計算専用) */
export function toMinutes(s: string): number {
  const m = DT_RE.exec(s);
  if (!m) throw new Error(`日時の形式が不正です: ${s}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d, h, mi) / 60000);
}

/** 実労働時間(分)。退勤が無ければ null、負なら 0 */
export function calcWorkMinutes(
  clockIn: string | null,
  clockOut: string | null,
  breakMinutes: number,
): number | null {
  if (!clockIn || !clockOut) return null;
  const diff = toMinutes(clockOut) - toMinutes(clockIn);
  return Math.max(0, diff - (breakMinutes || 0));
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 分 → "H:MM" */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${pad2(m)}`;
}

/** "YYYY-MM-DDTHH:mm" → "HH:mm" (日付が勤務日と異なる場合は "翌 HH:mm" など) */
export function formatTime(dt: string | null, baseDate?: string): string {
  if (!dt) return "-";
  const [date, time] = dt.split("T");
  if (baseDate && date !== baseDate) {
    const diff = Math.round((toMinutes(`${date}T00:00`) - toMinutes(`${baseDate}T00:00`)) / 1440);
    if (diff === 1) return `翌 ${time}`;
    if (diff === -1) return `前 ${time}`;
    return `${date.slice(5)} ${time}`;
  }
  return time;
}

/** "YYYY-MM" の日数 */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "YYYY-MM-DD" の曜日 (0=日) */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}
