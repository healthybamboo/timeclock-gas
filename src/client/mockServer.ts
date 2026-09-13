// ローカル開発 (vite dev) 用のインメモリ + localStorage モック。サーバーと同じ検証ロジックを簡易再現
import type { AttendanceRecord, PunchLog, RecordInput, ServerApi } from "../shared/types";
import { calcWorkMinutes, pad2, summarizeByMonth } from "../shared/time";

const KEY = "timeclock-mock";
const EMAIL = "dev@example.com";

interface Store {
  records: AttendanceRecord[];
  logs: PunchLog[];
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

export function createMockServer(): ServerApi {
  return {
    getStatus() {
      const s = load();
      const ts = now();
      const date = ts.slice(0, 10);
      return { email: EMAIL, now: ts, today: date, record: s.records.find((r) => r.date === date) ?? null };
    },
    clockIn() {
      const s = load();
      const ts = now();
      const date = ts.slice(0, 10);
      const existing = s.records.find((r) => r.date === date);
      if (existing?.clockIn) throw new Error(`本日は既に出勤済みです (${existing.clockIn.slice(11)})`);
      let record: AttendanceRecord;
      if (existing) {
        existing.clockIn = ts;
        existing.updatedAt = ts;
        record = existing;
      } else {
        record = { id: uuid(), date, email: EMAIL, clockIn: ts, clockOut: null, breakMinutes: 0, note: "", workMinutes: null, updatedAt: ts };
        s.records.push(record);
      }
      s.logs.push({ timestamp: ts, email: EMAIL, type: "IN", detail: date });
      save(s);
      return record;
    },
    clockOut() {
      const s = load();
      const ts = now();
      const date = ts.slice(0, 10);
      let record = s.records.find((r) => r.date === date);
      if (!record?.clockIn) {
        const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
        const p = s.records.find((r) => r.date === prev);
        if (p?.clockIn && !p.clockOut) record = p;
      }
      if (!record?.clockIn) throw new Error("出勤の記録がありません。先に出勤してください");
      if (record.clockOut) throw new Error(`既に退勤済みです (${record.clockOut.slice(11)})`);
      record.clockOut = ts;
      record.workMinutes = calcWorkMinutes(record.clockIn, ts, record.breakMinutes);
      record.updatedAt = ts;
      s.logs.push({ timestamp: ts, email: EMAIL, type: "OUT", detail: record.date });
      save(s);
      return record;
    },
    listRecords(month) {
      return load()
        .records.filter((r) => r.date.startsWith(month))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    saveRecord(input: RecordInput) {
      if (input.clockIn && input.clockOut && input.clockOut < input.clockIn) throw new Error("退勤時刻は出勤時刻より後にしてください");
      if (input.clockOut && !input.clockIn) throw new Error("退勤のみの記録はできません");
      const s = load();
      const ts = now();
      const dup = s.records.find((r) => r.date === input.date && r.id !== input.id);
      if (dup) throw new Error(`${input.date} の記録は既に存在します`);
      const record: AttendanceRecord = {
        id: input.id ?? uuid(),
        date: input.date,
        email: EMAIL,
        clockIn: input.clockIn,
        clockOut: input.clockOut,
        breakMinutes: input.breakMinutes,
        note: input.note,
        workMinutes: calcWorkMinutes(input.clockIn, input.clockOut, input.breakMinutes),
        updatedAt: ts,
      };
      const idx = s.records.findIndex((r) => r.id === record.id);
      if (idx >= 0) s.records[idx] = record;
      else s.records.push(record);
      s.logs.push({ timestamp: ts, email: EMAIL, type: "EDIT", detail: `${record.date} ${record.clockIn ?? "-"}〜${record.clockOut ?? "-"}` });
      save(s);
      return record;
    },
    deleteRecord(id) {
      const s = load();
      const r = s.records.find((x) => x.id === id);
      s.records = s.records.filter((x) => x.id !== id);
      if (r) s.logs.push({ timestamp: now(), email: EMAIL, type: "DELETE", detail: r.date });
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
  };
}
