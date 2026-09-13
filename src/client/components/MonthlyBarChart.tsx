import { useState } from "react";
import type { MonthlySummary } from "../../shared/types";
import { formatMinutes } from "../../shared/time";

interface Props {
  data: MonthlySummary[];
  onSelectMonth?: (month: string) => void;
  /** 月の目標(分)。0 以下なら非表示 */
  targetMinutes?: number;
}

const W = 720;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 40 };

/** 見やすい目盛り間隔 (時間単位) を選ぶ */
function niceStep(maxHours: number): number {
  const candidates = [5, 10, 20, 25, 50, 100, 200];
  for (const c of candidates) if (maxHours / c <= 5) return c;
  return 500;
}

export function MonthlyBarChart({ data, onSelectMonth, targetMinutes = 0 }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const hours = data.map((d) => d.totalMinutes / 60);
  const targetHours = targetMinutes > 0 ? targetMinutes / 60 : 0;
  const rawMax = Math.max(...hours, targetHours, 1);
  const headroom = rawMax * 1.12;
  const step = niceStep(headroom);
  const yMax = Math.ceil(headroom / step) * step || step;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / 12;
  const barW = Math.min(36, slot * 0.6);
  const y = (h: number) => PAD.top + plotH - (h / yMax) * plotH;

  const hovered = hover != null ? data[hover] : null;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="月別労働時間の棒グラフ" className="chart-svg">
        {/* グリッドと目盛り */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
              {t}h
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="chart-axis" />

        {/* 目標ライン */}
        {targetHours > 0 && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(targetHours)} y2={y(targetHours)} className="chart-target" />
            <text x={W - PAD.right} y={y(targetHours) - 5} className="chart-target-label" textAnchor="end">
              目標 {formatMinutes(targetMinutes)}
            </text>
          </g>
        )}

        {/* 棒 */}
        {data.map((d, i) => {
          const h = d.totalMinutes / 60;
          const cx = PAD.left + slot * i + slot / 2;
          const top = y(h);
          const barH = Math.max(0, y(0) - top);
          const isHover = hover === i;
          return (
            <g
              key={d.month}
              className={isHover ? "chart-bar hover" : "chart-bar"}
              onMouseEnter={() => setHover(i)}
              onClick={() => onSelectMonth?.(d.month)}
              style={{ cursor: onSelectMonth ? "pointer" : "default" }}
            >
              {/* ヒット領域はバーより広く */}
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {barH > 0 && (
                <path
                  d={roundedTopBar(cx - barW / 2, top, barW, barH, Math.min(4, barH))}
                  className="chart-bar-fill"
                />
              )}
              {h > 0 && (
                <text x={cx} y={top - 6} className="chart-value" textAnchor="middle">
                  {Math.round(h)}
                </text>
              )}
              <text x={cx} y={H - 8} className="chart-tick" textAnchor="middle">
                {Number(d.month.slice(5))}月
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="chart-tooltip" style={{ left: `${((PAD.left + slot * hover! + slot / 2) / W) * 100}%` }}>
          <div className="chart-tooltip-title">
            {hovered.month.slice(0, 4)}年{Number(hovered.month.slice(5))}月
          </div>
          <div>労働時間 {formatMinutes(hovered.totalMinutes)}</div>
          <div>出勤 {hovered.workDays} 日</div>
        </div>
      )}
    </div>
  );
}

/** 上端だけ角丸の棒 (ベースラインは直角) */
function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}
