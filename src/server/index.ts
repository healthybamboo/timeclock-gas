// GAS のエントリポイント。ここで export した関数が google.script.run から呼べる (scripts/build-server.mjs 参照)
import type {
  Holiday,
  HolidayInput,
  MonthlySummary,
  PunchLog,
  ServerApi,
  SessionInput,
  StatusResponse,
  UserSettings,
  WorkSession,
} from "../shared/types";
import { calcWorkMinutes, summarizeByMonth } from "../shared/time";
import {
  buildSession,
  describeSession,
  findOpenSession,
  findOverlap,
  prevDate,
  sortSessions,
  validateSessionInput,
} from "../shared/logic";
import { currentUserEmail, now, today } from "./clock";
import * as sheet from "./sheet";

// --- Web アプリ -------------------------------------------------------------

export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("打刻システム")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- ユーティリティ ----------------------------------------------------------

function withLock<T>(fn: () => T): T {
  const lock = LockService.getScriptLock();
  lock.waitLock(10_000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function newId(): string {
  return Utilities.getUuid();
}

/** 今日と前日のセッションから未退勤のものを探す (日跨ぎ対応) */
function findOpenForToday(email: string, date: string): WorkSession | null {
  return findOpenSession(sortSessions(sheet.listByDates(email, [prevDate(date), date])));
}

// --- API (google.script.run から呼ばれる) -------------------------------------

export function getStatus(): StatusResponse {
  const email = currentUserEmail();
  const date = today();
  const sessions = sortSessions(sheet.listByDates(email, [prevDate(date), date]));
  return {
    email,
    now: now(),
    today: date,
    todaySessions: sessions.filter((s) => s.date === date),
    openSession: findOpenSession(sessions),
    settings: sheet.getSettings(email),
  };
}

export function clockIn(): WorkSession {
  return withLock(() => {
    const email = currentUserEmail();
    const ts = now();
    const date = ts.slice(0, 10);
    const open = findOpenForToday(email, date);
    if (open) throw new Error(`退勤していない勤務があります (${open.clockIn?.slice(11)} 出勤)`);

    const session: WorkSession = {
      id: newId(),
      date,
      email,
      clockIn: ts,
      clockOut: null,
      breakMinutes: 0,
      note: "",
      workMinutes: null,
      updatedAt: ts,
    };
    sheet.insertRecord(session);
    sheet.appendLog({ timestamp: ts, email, type: "IN", detail: date });
    return session;
  });
}

export function clockOut(): WorkSession {
  return withLock(() => {
    const email = currentUserEmail();
    const ts = now();
    const date = ts.slice(0, 10);
    const open = findOpenForToday(email, date);
    if (!open) throw new Error("出勤中の勤務がありません。先に出勤してください");
    const located = sheet.findById(open.id);
    if (!located) throw new Error("勤務レコードが見つかりません");

    const session: WorkSession = {
      ...open,
      clockOut: ts,
      workMinutes: calcWorkMinutes(open.clockIn, ts, open.breakMinutes),
      updatedAt: ts,
    };
    sheet.updateRecord(located.rowNumber, session);
    sheet.appendLog({ timestamp: ts, email, type: "OUT", detail: session.date });
    return session;
  });
}

export function listSessions(month: string): WorkSession[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月の形式が不正です");
  return sortSessions(sheet.listByMonth(currentUserEmail(), month));
}

/** 新規作成 (id なし) または更新 (id あり) */
export function saveSession(input: SessionInput): WorkSession {
  validateSessionInput(input);
  return withLock(() => {
    const email = currentUserEmail();
    const ts = now();
    const sameDay = sheet.listByDates(email, [prevDate(input.date), input.date]);
    const overlap = findOverlap(input, sameDay);
    if (overlap) throw new Error(`他の勤務時間と重なっています (${overlap.clockIn?.slice(11)}〜${overlap.clockOut?.slice(11) ?? "勤務中"})`);

    if (input.id) {
      const located = sheet.findById(input.id);
      if (!located) throw new Error("勤務レコードが見つかりません");
      if (located.record.email !== email) throw new Error("他のユーザーの記録は編集できません");
      const session = buildSession(input, { id: input.id, email, updatedAt: ts });
      sheet.updateRecord(located.rowNumber, session);
      sheet.appendLog({ timestamp: ts, email, type: "EDIT", detail: describeSession(session) });
      return session;
    }

    const session = buildSession(input, { id: newId(), email, updatedAt: ts });
    sheet.insertRecord(session);
    sheet.appendLog({ timestamp: ts, email, type: "EDIT", detail: `新規 ${describeSession(session)}` });
    return session;
  });
}

export function deleteSession(id: string): void {
  withLock(() => {
    const email = currentUserEmail();
    const located = sheet.findById(id);
    if (!located) return;
    if (located.record.email !== email) throw new Error("他のユーザーの記録は削除できません");
    sheet.deleteRow(located.rowNumber);
    sheet.appendLog({ timestamp: now(), email, type: "DELETE", detail: describeSession(located.record) });
  });
}

export function listLogs(month: string): PunchLog[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月の形式が不正です");
  return sheet.listLogsByMonth(currentUserEmail(), month);
}

export function getYearlySummary(year: string): MonthlySummary[] {
  if (!/^\d{4}$/.test(year)) throw new Error("年の形式が不正です");
  return summarizeByMonth(year, sheet.listByYear(currentUserEmail(), year));
}

export function saveSettings(settings: UserSettings): UserSettings {
  const target = Number(settings?.monthlyTargetMinutes);
  if (!Number.isFinite(target) || target < 0 || target > 24 * 60 * 31) {
    throw new Error("目標労働時間は 0 以上の分数で入力してください");
  }
  return withLock(() => {
    const email = currentUserEmail();
    const normalized: UserSettings = { monthlyTargetMinutes: Math.round(target) };
    sheet.saveSettings(email, normalized, now());
    return normalized;
  });
}

export function listHolidays(month: string): Holiday[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月の形式が不正です");
  return sheet.listHolidaysByMonth(currentUserEmail(), month);
}

export function saveHoliday(input: HolidayInput): Holiday {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? "")) throw new Error("日付の形式が不正です");
  return withLock(() => {
    const email = currentUserEmail();
    const holiday: Holiday = { date: input.date, email, note: input.note ?? "", updatedAt: now() };
    sheet.upsertHoliday(holiday);
    return holiday;
  });
}

export function deleteHoliday(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日付の形式が不正です");
  withLock(() => {
    sheet.deleteHoliday(currentUserEmail(), date);
  });
}

// 型チェック用: index.ts の API が ServerApi と一致することを保証
const _check: ServerApi = {
  getStatus,
  clockIn,
  clockOut,
  listSessions,
  saveSession,
  deleteSession,
  listLogs,
  getYearlySummary,
  saveSettings,
  listHolidays,
  saveHoliday,
  deleteHoliday,
};
void _check;
