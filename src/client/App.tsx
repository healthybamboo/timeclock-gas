import { useCallback, useEffect, useState } from "react";
import type { AttendanceRecord, RecordInput, StatusResponse } from "../shared/types";
import { api, isMock } from "./api";
import { ClockPanel } from "./components/ClockPanel";
import { EditModal } from "./components/EditModal";
import { LogList } from "./components/LogList";
import { MonthlyTable } from "./components/MonthlyTable";
import { SummaryView } from "./components/SummaryView";
import { Toast, useToast } from "./components/Toast";

type Tab = "records" | "logs" | "summary";

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [month, setMonth] = useState<string>(() => localNow().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ date: string; record: AttendanceRecord | null } | null>(null);
  const [tab, setTab] = useState<Tab>("records");
  const [year, setYear] = useState<string>(() => localNow().slice(0, 4));
  const { toast, showToast } = useToast();

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api.getStatus());
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  }, [showToast]);

  const refreshRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      setRecords(await api.listRecords(month));
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      setLoadingRecords(false);
    }
  }, [month, showToast]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);
  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  async function punch(kind: "in" | "out") {
    setBusy(true);
    try {
      const rec = kind === "in" ? await api.clockIn() : await api.clockOut();
      showToast(kind === "in" ? `出勤しました (${rec.clockIn?.slice(11)})` : `退勤しました (${rec.clockOut?.slice(11)})`, "success");
      await Promise.all([refreshStatus(), refreshRecords()]);
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(input: RecordInput) {
    const saved = await api.saveRecord(input);
    showToast(`${saved.date} を保存しました`, "success");
    setEditing(null);
    await Promise.all([refreshStatus(), refreshRecords()]);
  }

  async function handleDelete(id: string) {
    await api.deleteRecord(id);
    showToast("削除しました", "success");
    setEditing(null);
    await Promise.all([refreshStatus(), refreshRecords()]);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">⏱</span>
          <span>打刻システム</span>
        </div>
        <div className="header-user">
          {isMock && <span className="badge badge-warn">ローカルモック</span>}
          <span>{status?.email ?? "…"}</span>
        </div>
      </header>

      <main className="main">
        <ClockPanel status={status} busy={busy} onClockIn={() => punch("in")} onClockOut={() => punch("out")} />

        <section className="card">
          <div className="tabs">
            <button className={tab === "records" ? "tab active" : "tab"} onClick={() => setTab("records")}>
              勤務表
            </button>
            <button className={tab === "logs" ? "tab active" : "tab"} onClick={() => setTab("logs")}>
              打刻履歴
            </button>
            <button className={tab === "summary" ? "tab active" : "tab"} onClick={() => setTab("summary")}>
              集計
            </button>
          </div>
          {tab === "records" ? (
            <MonthlyTable
              month={month}
              records={records}
              loading={loadingRecords}
              today={status?.today}
              onChangeMonth={setMonth}
              onEdit={(date, record) => setEditing({ date, record })}
            />
          ) : tab === "logs" ? (
            <LogList month={month} onChangeMonth={setMonth} />
          ) : (
            <SummaryView
              year={year}
              onChangeYear={setYear}
              onSelectMonth={(m) => {
                setMonth(m);
                setTab("records");
              }}
            />
          )}
        </section>
      </main>

      {editing && (
        <EditModal
          date={editing.date}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.replace(/^Error:\s*/, "");
  return String(e);
}
