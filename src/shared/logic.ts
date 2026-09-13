// サーバーとローカルモックで共有する純粋なドメインロジック
import type { SessionInput, WorkSession } from "./types";
import { calcWorkMinutes, isLocalDateTime, pad2, toMinutes } from "./time";

export function isOpen(s: WorkSession): boolean {
  return !!s.clockIn && !s.clockOut;
}

export function findOpenSession(sessions: readonly WorkSession[]): WorkSession | null {
  return sessions.find(isOpen) ?? null;
}

/** date の前日 ("YYYY-MM-DD") */
export function prevDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** 日付 → 出勤時刻の順に並べる */
export function sortSessions(sessions: readonly WorkSession[]): WorkSession[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || (a.clockIn ?? "").localeCompare(b.clockIn ?? ""));
}

export function validateSessionInput(input: SessionInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("日付の形式が不正です");
  if (input.clockIn != null && !isLocalDateTime(input.clockIn)) throw new Error("出勤時刻の形式が不正です");
  if (input.clockOut != null && !isLocalDateTime(input.clockOut)) throw new Error("退勤時刻の形式が不正です");
  if (!input.clockIn) throw new Error("出勤時刻を入力してください");
  if (input.clockIn && input.clockOut && input.clockOut < input.clockIn) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }
  if (!Number.isFinite(input.breakMinutes) || input.breakMinutes < 0) {
    throw new Error("休憩時間は 0 以上の分数で入力してください");
  }
}

/** 未退勤のセッションは出勤から 24 時間続くものとして扱う */
function interval(s: { clockIn: string | null; clockOut: string | null }): [number, number] | null {
  if (!s.clockIn) return null;
  const start = toMinutes(s.clockIn);
  const end = s.clockOut ? toMinutes(s.clockOut) : start + 24 * 60;
  return [start, end];
}

/** 同じユーザーの他セッションと時間帯が重なっていればそれを返す */
export function findOverlap(
  input: { id?: string; clockIn: string | null; clockOut: string | null },
  others: readonly WorkSession[],
): WorkSession | null {
  const a = interval(input);
  if (!a) return null;
  for (const o of others) {
    if (input.id && o.id === input.id) continue;
    const b = interval(o);
    if (!b) continue;
    if (a[0] < b[1] && b[0] < a[1]) return o;
  }
  return null;
}

export interface DaySummary {
  date: string;
  sessions: WorkSession[];
  /** 全セッションの実労働(分)合計 (未退勤分は含まない) */
  workMinutes: number;
  breakMinutes: number;
  notes: string[];
  hasOpen: boolean;
}

export function summarizeDay(date: string, sessions: readonly WorkSession[]): DaySummary {
  const sorted = sortSessions(sessions);
  return {
    date,
    sessions: sorted,
    workMinutes: sorted.reduce((s, x) => s + (x.workMinutes ?? 0), 0),
    breakMinutes: sorted.reduce((s, x) => s + (x.breakMinutes || 0), 0),
    notes: sorted.map((x) => x.note).filter(Boolean),
    hasOpen: sorted.some(isOpen),
  };
}

export function groupByDate(sessions: readonly WorkSession[]): Map<string, DaySummary> {
  const buckets = new Map<string, WorkSession[]>();
  for (const s of sessions) {
    const list = buckets.get(s.date) ?? [];
    list.push(s);
    buckets.set(s.date, list);
  }
  const out = new Map<string, DaySummary>();
  for (const [date, list] of buckets) out.set(date, summarizeDay(date, list));
  return out;
}

/** 入力からセッションを組み立てる (id, email, updatedAt は呼び出し側が決める) */
export function buildSession(
  input: SessionInput,
  meta: { id: string; email: string; updatedAt: string },
): WorkSession {
  return {
    id: meta.id,
    date: input.date,
    email: meta.email,
    clockIn: input.clockIn,
    clockOut: input.clockOut,
    breakMinutes: Math.round(input.breakMinutes || 0),
    note: input.note ?? "",
    workMinutes: calcWorkMinutes(input.clockIn, input.clockOut, input.breakMinutes || 0),
    updatedAt: meta.updatedAt,
  };
}

export function describeSession(s: WorkSession): string {
  return `${s.date} ${s.clockIn?.slice(11) ?? "-"}〜${s.clockOut?.slice(11) ?? "-"} 休憩${s.breakMinutes}分${s.note ? ` (${s.note})` : ""}`;
}
