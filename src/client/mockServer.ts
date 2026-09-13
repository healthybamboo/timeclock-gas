// ローカル開発 (vite dev) 用のインメモリ + localStorage モック。サーバーと同じ共有ロジックを使う
import type { Holiday, PunchLog, ServerApi, SessionInput, UserSettings, WorkSession } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { calcWorkMinutes, pad2, summarizeByMonth } from "../shared/time";
import {
  buildSession,
  describeSession,
  findOpenSession,
  findOverlap,
  prevDate,
  sortSessions,
  validateSessionInput,
} from "../shared/logic";

const KEY = "timeclock-mock";
const EMAIL = "dev@example.com";

interface Store {
  records: WorkSession[];
  logs: PunchLog[];
  settings?: UserSettings;
  holidays?: Holiday[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { records: [], logs: [] };
}
function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
function now(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function aroundToday(s: Store, date: string): WorkSession[] {
  const prev = prevDate(date);
  return sortSessions(s.records.filter((r) => r.date === date || r.date === prev));
}

export function createMockServer(): ServerApi {
  return {
    getStatus() {
      const s = load();
      const ts = now();
      const date = ts.slice(0, 10);
      const sessions = aroundToday(s, date);
      return {
        email: EMAIL,
        now: ts,
        today: date,
        todaySessions: sessions.filter((x) => x.date === date),
        openSession: findOpenSession(sessions),
        settings: s.settings ?? { ...DEFAULT_SETTINGS },
      };
    },
    clockIn() {
      const s = load();
      const ts = now();
      const date = ts.slice(0, 10);
      const open = findOpenSession(aroundToday(s, date));
      if (open) throw new Error(`退勤していない勤務があります (${open.clockIn?.slice(11)} 出勤)`);
      const session: WorkSession = { id: uuid(), date, email: EMAIL, clockIn: ts, clockOut: null, breakMinutes: 0, note: "", workMinutes: null, updatedAt: ts };
      s.records.push(session);
      s.logs.push({ timestamp: ts, email: EMAIL, type: "IN", detail: date });
      save(s);
      return session;
    },
    clockOut() {
      const s = load();
      const ts = now();
      const date = ts.slice(0, 10);
      const open = findOpenSession(aroundToday(s, date));
      if (!open) throw new Error("出勤中の勤務がありません。先に出勤してください");
      const target = s.records.find((r) => r.id === open.id)!;
      target.clockOut = ts;
      target.workMinutes = calcWorkMinutes(target.clockIn, ts, target.breakMinutes);
      target.updatedAt = ts;
      s.logs.push({ timestamp: ts, email: EMAIL, type: "OUT", detail: target.date });
      save(s);
      return target;
    },
    listSessions(month) {
      return sortSessions(load().records.filter((r) => r.date.startsWith(month)));
    },
    saveSession(input: SessionInput) {
      validateSessionInput(input);
      const s = load();
      const ts = now();
      const overlap = findOverlap(input, aroundToday(s, input.date));
      if (overlap) throw new Error(`他の勤務時間と重なっています (${overlap.clockIn?.slice(11)}〜${overlap.clockOut?.slice(11) ?? "勤務中"})`);
      const session = buildSession(input, { id: input.id ?? uuid(), email: EMAIL, updatedAt: ts });
      const idx = s.records.findIndex((r) => r.id === session.id);
      if (idx >= 0) s.records[idx] = session;
      else s.records.push(session);
      s.logs.push({ timestamp: ts, email: EMAIL, type: "EDIT", detail: describeSession(session) });
      save(s);
      return session;
    },
    deleteSession(id) {
      const s = load();
      const r = s.records.find((x) => x.id === id);
      s.records = s.records.filter((x) => x.id !== id);
      if (r) s.logs.push({ timestamp: now(), email: EMAIL, type: "DELETE", detail: describeSession(r) });
      save(s);
    },
    listLogs(month) {
      return load()
        .logs.filter((l) => l.timestamp.startsWith(month))
        .reverse();
    },
    getYearlySummary(year) {
      return summarizeByMonth(year, load().records.filter((r) => r.date.startsWith(`${year}-`)));
    },
    saveSettings(settings) {
      const s = load();
      s.settings = { monthlyTargetMinutes: Math.round(settings.monthlyTargetMinutes) };
      save(s);
      return s.settings;
    },
    listHolidays(month) {
      return (load().holidays ?? []).filter((h) => h.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
    },
    saveHoliday(input) {
      const s = load();
      const holiday: Holiday = { date: input.date, email: EMAIL, note: input.note ?? "", updatedAt: now() };
      s.holidays = [...(s.holidays ?? []).filter((h) => h.date !== input.date), holiday];
      save(s);
      return holiday;
    },
    deleteHoliday(date) {
      const s = load();
      s.holidays = (s.holidays ?? []).filter((h) => h.date !== date);
      save(s);
    },
  };
}
