// スプレッドシートへの読み書き
import type { AttendanceRecord, Holiday, PunchLog, UserSettings } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { calcWorkMinutes } from "../shared/time";
import { formatDateTime } from "./clock";

const RECORDS_SHEET = "Records";
const LOGS_SHEET = "Logs";

const RECORD_HEADERS = [
  "id",
  "date",
  "email",
  "clockIn",
  "clockOut",
  "breakMinutes",
  "note",
  "workMinutes",
  "updatedAt",
] as const;
const LOG_HEADERS = ["timestamp", "email", "type", "detail"] as const;

function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  // スタンドアロンスクリプトの場合はスクリプトプロパティの SPREADSHEET_ID を使う
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) {
    throw new Error(
      "スプレッドシートが見つかりません。コンテナバインド型にするか、スクリプトプロパティ SPREADSHEET_ID を設定してください。",
    );
  }
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet(
  name: string,
  headers: readonly string[],
): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([[...headers]]).setFontWeight("bold");
    // 日付/時刻文字列が Date に自動変換されないよう、データ列は書式なしテキストにする
    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat("@");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

export function recordsSheet() {
  return getOrCreateSheet(RECORDS_SHEET, RECORD_HEADERS);
}
export function logsSheet() {
  return getOrCreateSheet(LOGS_SHEET, LOG_HEADERS);
}

// --- セル値の正規化 -------------------------------------------------------

function cellToDateTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return formatDateTime(v);
  return String(v);
}
function cellToDate(v: unknown): string {
  if (v instanceof Date) return formatDateTime(v).slice(0, 10);
  return String(v);
}
function cellToInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function rowToRecord(row: unknown[]): AttendanceRecord {
  const clockIn = cellToDateTime(row[3]);
  const clockOut = cellToDateTime(row[4]);
  const breakMinutes = cellToInt(row[5]) ?? 0;
  return {
    id: String(row[0]),
    date: cellToDate(row[1]),
    email: String(row[2]),
    clockIn,
    clockOut,
    breakMinutes,
    note: row[6] == null ? "" : String(row[6]),
    workMinutes: calcWorkMinutes(clockIn, clockOut, breakMinutes),
    updatedAt: cellToDateTime(row[8]) ?? "",
  };
}

function recordToRow(r: AttendanceRecord): (string | number)[] {
  return [
    r.id,
    r.date,
    r.email,
    r.clockIn ?? "",
    r.clockOut ?? "",
    r.breakMinutes,
    r.note,
    r.workMinutes ?? "",
    r.updatedAt,
  ];
}

// --- Records --------------------------------------------------------------

interface Located {
  record: AttendanceRecord;
  /** シート上の行番号 (1 始まり) */
  rowNumber: number;
}

function readAll(): Located[] {
  const sheet = recordsSheet();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, RECORD_HEADERS.length).getValues();
  const out: Located[] = [];
  values.forEach((row, i) => {
    if (row[0] === "" || row[0] == null) return;
    out.push({ record: rowToRecord(row), rowNumber: i + 2 });
  });
  return out;
}

export function findById(id: string): Located | null {
  return readAll().find((l) => l.record.id === id) ?? null;
}

export function findByDate(email: string, date: string): Located | null {
  return readAll().find((l) => l.record.email === email && l.record.date === date) ?? null;
}

/** month: "YYYY-MM" */
export function listByMonth(email: string, month: string): AttendanceRecord[] {
  return readAll()
    .map((l) => l.record)
    .filter((r) => r.email === email && r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** year: "YYYY" */
export function listByYear(email: string, year: string): AttendanceRecord[] {
  return readAll()
    .map((l) => l.record)
    .filter((r) => r.email === email && r.date.startsWith(`${year}-`));
}

export function insertRecord(record: AttendanceRecord): void {
  const sheet = recordsSheet();
  const row = sheet.getLastRow() + 1;
  const range = sheet.getRange(row, 1, 1, RECORD_HEADERS.length);
  range.setNumberFormat("@");
  range.setValues([recordToRow(record)]);
}

export function updateRecord(rowNumber: number, record: AttendanceRecord): void {
  const range = recordsSheet().getRange(rowNumber, 1, 1, RECORD_HEADERS.length);
  range.setNumberFormat("@");
  range.setValues([recordToRow(record)]);
}

export function deleteRow(rowNumber: number): void {
  recordsSheet().deleteRow(rowNumber);
}

// --- Logs -----------------------------------------------------------------

export function appendLog(log: PunchLog): void {
  const sheet = logsSheet();
  const row = sheet.getLastRow() + 1;
  const range = sheet.getRange(row, 1, 1, LOG_HEADERS.length);
  range.setNumberFormat("@");
  range.setValues([[log.timestamp, log.email, log.type, log.detail]]);
}

export function listLogsByMonth(email: string, month: string): PunchLog[] {
  const sheet = logsSheet();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues();
  return values
    .map<PunchLog>((row) => ({
      timestamp: cellToDateTime(row[0]) ?? "",
      email: String(row[1]),
      type: String(row[2]) as PunchLog["type"],
      detail: row[3] == null ? "" : String(row[3]),
    }))
    .filter((l) => l.email === email && l.timestamp.startsWith(month))
    .reverse();
}

// --- Settings --------------------------------------------------------------

const SETTINGS_SHEET = "Settings";
const SETTINGS_HEADERS = ["email", "monthlyTargetMinutes", "updatedAt"] as const;

function settingsSheet() {
  return getOrCreateSheet(SETTINGS_SHEET, SETTINGS_HEADERS);
}

export function getSettings(email: string): UserSettings {
  const sheet = settingsSheet();
  const last = sheet.getLastRow();
  if (last < 2) return { ...DEFAULT_SETTINGS };
  const values = sheet.getRange(2, 1, last - 1, SETTINGS_HEADERS.length).getValues();
  const row = values.find((r) => String(r[0]) === email);
  if (!row) return { ...DEFAULT_SETTINGS };
  const target = cellToInt(row[1]);
  return { monthlyTargetMinutes: target == null || target < 0 ? DEFAULT_SETTINGS.monthlyTargetMinutes : target };
}

export function saveSettings(email: string, settings: UserSettings, updatedAt: string): void {
  const sheet = settingsSheet();
  const last = sheet.getLastRow();
  let rowNumber = last + 1;
  if (last >= 2) {
    const emails = sheet.getRange(2, 1, last - 1, 1).getValues();
    const idx = emails.findIndex((r) => String(r[0]) === email);
    if (idx >= 0) rowNumber = idx + 2;
  }
  const range = sheet.getRange(rowNumber, 1, 1, SETTINGS_HEADERS.length);
  range.setNumberFormat("@");
  range.setValues([[email, settings.monthlyTargetMinutes, updatedAt]]);
}

// --- Holidays --------------------------------------------------------------

const HOLIDAYS_SHEET = "Holidays";
const HOLIDAY_HEADERS = ["date", "email", "note", "updatedAt"] as const;

function holidaysSheet() {
  return getOrCreateSheet(HOLIDAYS_SHEET, HOLIDAY_HEADERS);
}

interface LocatedHoliday {
  holiday: Holiday;
  rowNumber: number;
}

function readAllHolidays(): LocatedHoliday[] {
  const sheet = holidaysSheet();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, HOLIDAY_HEADERS.length).getValues();
  const out: LocatedHoliday[] = [];
  values.forEach((row, i) => {
    if (row[0] === "" || row[0] == null) return;
    out.push({
      holiday: {
        date: cellToDate(row[0]),
        email: String(row[1]),
        note: row[2] == null ? "" : String(row[2]),
        updatedAt: cellToDateTime(row[3]) ?? "",
      },
      rowNumber: i + 2,
    });
  });
  return out;
}

export function listHolidaysByMonth(email: string, month: string): Holiday[] {
  return readAllHolidays()
    .map((l) => l.holiday)
    .filter((h) => h.email === email && h.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function upsertHoliday(holiday: Holiday): void {
  const sheet = holidaysSheet();
  const existing = readAllHolidays().find((l) => l.holiday.email === holiday.email && l.holiday.date === holiday.date);
  const rowNumber = existing ? existing.rowNumber : sheet.getLastRow() + 1;
  const range = sheet.getRange(rowNumber, 1, 1, HOLIDAY_HEADERS.length);
  range.setNumberFormat("@");
  range.setValues([[holiday.date, holiday.email, holiday.note, holiday.updatedAt]]);
}

export function deleteHoliday(email: string, date: string): boolean {
  const existing = readAllHolidays().find((l) => l.holiday.email === email && l.holiday.date === date);
  if (!existing) return false;
  holidaysSheet().deleteRow(existing.rowNumber);
  return true;
}
