/** "YYYY-MM-DDTHH:mm" (ローカル時刻、秒なし) */
export type LocalDateTime = string;
/** "YYYY-MM-DD" */
export type LocalDate = string;

export interface AttendanceRecord {
  id: string;
  /** 勤務日 */
  date: LocalDate;
  email: string;
  clockIn: LocalDateTime | null;
  clockOut: LocalDateTime | null;
  /** 休憩(分) */
  breakMinutes: number;
  note: string;
  /** 実労働(分)。退勤が未入力なら null */
  workMinutes: number | null;
  updatedAt: string;
}

/** 編集・新規作成の入力 */
export interface RecordInput {
  /** 既存レコードの更新時のみ指定 */
  id?: string;
  date: LocalDate;
  clockIn: LocalDateTime | null;
  clockOut: LocalDateTime | null;
  breakMinutes: number;
  note: string;
}

export interface StatusResponse {
  email: string;
  /** サーバー時刻 (LocalDateTime) */
  now: LocalDateTime;
  today: LocalDate;
  record: AttendanceRecord | null;
}

export interface PunchLog {
  timestamp: LocalDateTime;
  email: string;
  type: "IN" | "OUT" | "EDIT" | "DELETE";
  detail: string;
}

/** サーバー関数のシグネチャ。クライアントの型付き呼び出しとモックで共有 */
export interface ServerApi {
  getStatus(): StatusResponse;
  clockIn(): AttendanceRecord;
  clockOut(): AttendanceRecord;
  /** month: "YYYY-MM" */
  listRecords(month: string): AttendanceRecord[];
  saveRecord(input: RecordInput): AttendanceRecord;
  deleteRecord(id: string): void;
  listLogs(month: string): PunchLog[];
}
