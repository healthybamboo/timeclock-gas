// GAS のエントリポイント。ここで export した関数が google.script.run から呼べる (scripts/build-server.mjs 参照)
import type { AttendanceRecord, MonthlySummary, PunchLog, RecordInput, ServerApi, StatusResponse } from "../shared/types";
import { calcWorkMinutes, isLocalDateTime, summarizeByMonth } from "../shared/time";
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

function validateInput(input: RecordInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("日付の形式が不正です");
  if (input.clockIn != null && !isLocalDateTime(input.clockIn)) throw new Error("出勤時刻の形式が不正です");
  if (input.clockOut != null && !isLocalDateTime(input.clockOut)) throw new Error("退勤時刻の形式が不正です");
  if (input.clockIn && input.clockOut && input.clockOut < input.clockIn) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }
  if (!Number.isFinite(input.breakMinutes) || input.breakMinutes < 0) {
    throw new Error("休憩時間は 0 以上の分数で入力してください");
  }
  if (input.clockOut && !input.clockIn) throw new Error("退勤のみの記録はできません");
}

// --- API (google.script.run から呼ばれる) -------------------------------------

export function getStatus(): StatusResponse {
  const email = currentUserEmail();
  const date = today();
  const located = sheet.findByDate(email, date);
  return { email, now: now(), today: date, record: located?.record ?? null };
}

export function clockIn(): AttendanceRecord {
  return withLock(() => {
    const email = currentUserEmail();
    const ts = now();
    const date = ts.slice(0, 10);
    const existing = sheet.findByDate(email, date);
    if (existing?.record.clockIn) throw new Error(`本日は既に出勤済みです (${existing.record.clockIn.slice(11)})`);

    const record: AttendanceRecord = existing
      ? { ...existing.record, clockIn: ts, workMinutes: null, updatedAt: ts }
      : {
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
    if (existing) sheet.updateRecord(existing.rowNumber, record);
    else sheet.insertRecord(record);
    sheet.appendLog({ timestamp: ts, email, type: "IN", detail: date });
    return record;
  });
}

export function clockOut(): AttendanceRecord {
  return withLock(() => {
    const email = currentUserEmail();
    const ts = now();
    const date = ts.slice(0, 10);
    // 日跨ぎ勤務: 当日の記録がなければ前日の未退勤レコードを探す
    let located = sheet.findByDate(email, date);
    if (!located?.record.clockIn) {
      const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
      const prevLocated = sheet.findByDate(email, prev);
      if (prevLocated?.record.clockIn && !prevLocated.record.clockOut) located = prevLocated;
    }
    if (!located?.record.clockIn) throw new Error("出勤の記録がありません。先に出勤してください");
    if (located.record.clockOut) throw new Error(`既に退勤済みです (${located.record.clockOut.slice(11)})`);

    const record: AttendanceRecord = {
      ...located.record,
      clockOut: ts,
      workMinutes: calcWorkMinutes(located.record.clockIn, ts, located.record.breakMinutes),
      updatedAt: ts,
    };
    sheet.updateRecord(located.rowNumber, record);
    sheet.appendLog({ timestamp: ts, email, type: "OUT", detail: record.date });
    return record;
  });
}

export function listRecords(month: string): AttendanceRecord[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月の形式が不正です");
  return sheet.listByMonth(currentUserEmail(), month);
}

/** 新規作成 (id なし) または更新 (id あり) */
export function saveRecord(input: RecordInput): AttendanceRecord {
  validateInput(input);
  return withLock(() => {
    const email = currentUserEmail();
    const ts = now();
    const base = {
      date: input.date,
      email,
      clockIn: input.clockIn,
      clockOut: input.clockOut,
      breakMinutes: Math.round(input.breakMinutes),
      note: input.note ?? "",
      workMinutes: calcWorkMinutes(input.clockIn, input.clockOut, input.breakMinutes),
      updatedAt: ts,
    };

    if (input.id) {
      const located = sheet.findById(input.id);
      if (!located) throw new Error("レコードが見つかりません");
      if (located.record.email !== email) throw new Error("他のユーザーの記録は編集できません");
      const dup = sheet.findByDate(email, input.date);
      if (dup && dup.record.id !== input.id) throw new Error(`${input.date} の記録は既に存在します`);
      const record: AttendanceRecord = { ...base, id: input.id };
      sheet.updateRecord(located.rowNumber, record);
      sheet.appendLog({ timestamp: ts, email, type: "EDIT", detail: describe(record) });
      return record;
    }

    if (sheet.findByDate(email, input.date)) throw new Error(`${input.date} の記録は既に存在します`);
    const record: AttendanceRecord = { ...base, id: newId() };
    sheet.insertRecord(record);
    sheet.appendLog({ timestamp: ts, email, type: "EDIT", detail: `新規 ${describe(record)}` });
    return record;
  });
}

export function deleteRecord(id: string): void {
  withLock(() => {
    const email = currentUserEmail();
    const located = sheet.findById(id);
    if (!located) return;
    if (located.record.email !== email) throw new Error("他のユーザーの記録は削除できません");
    sheet.deleteRow(located.rowNumber);
    sheet.appendLog({ timestamp: now(), email, type: "DELETE", detail: describe(located.record) });
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

function describe(r: AttendanceRecord): string {
  return `${r.date} ${r.clockIn?.slice(11) ?? "-"}〜${r.clockOut?.slice(11) ?? "-"} 休憩${r.breakMinutes}分${r.note ? ` (${r.note})` : ""}`;
}

// 型チェック用: index.ts の API が ServerApi と一致することを保証
const _check: ServerApi = { getStatus, clockIn, clockOut, listRecords, saveRecord, deleteRecord, listLogs, getYearlySummary };
void _check;
