import { addMonths } from "../../shared/time";

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [y, m] = month.split("-");
  return (
    <div className="month-nav">
      <button className="btn btn-icon" aria-label="前月" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <span className="month-label">
        {y}年{Number(m)}月
      </span>
      <button className="btn btn-icon" aria-label="翌月" onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  );
}
