import type { AnalysisRun, AssetRow } from "../lib/analysis";
import type { Asset } from "../types";
import { fmtUTC } from "../lib/format";

interface Props {
  run: AnalysisRun;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const SHORT_KIND: Record<Asset["kind"], string> = {
  hospital: "Health",
  shelter: "Shelter",
  power: "Power",
  road: "Road",
  port: "Port",
  airport: "Airport",
};

export default function PriorityList({ run, selectedId, onSelect }: Props) {
  const { rows, bandCounts, unexposed, scenario, district } = run;

  return (
    <section className="card priority-panel">
      <div className="card-head">
        <h2>Assets to review</h2>
        <span className="sub">
          {rows.length} flagged · {unexposed.length} outside
        </span>
      </div>

      <div className="summary-strip">
        <div className="stat stat--red">
          <b>{bandCounts.P1}</b>
          <span>P1 urgent</span>
        </div>
        <div className="stat stat--yellow">
          <b>{bandCounts.P2}</b>
          <span>P2 prepare</span>
        </div>
        <div className="stat stat--blue">
          <b>{bandCounts.P3}</b>
          <span>P3 monitor</span>
        </div>
        <div className="stat stat--green">
          <b>{bandCounts.P4}</b>
          <span>P4 awareness</span>
        </div>
      </div>

      <div className="priority-context">
        <strong>{district.name} · {scenario.name}</strong>
        <span>Valid {fmtUTC(run.storm.time)}</span>
      </div>
      <p className="priority-method">Ranked by hazard exposure, asset vulnerability and service importance.</p>

      {rows.length === 0 ? (
        <div className="empty">
          No mapped asset intersects a hazard footprint at this valid time. Step the forecast
          slider towards landfall to see exposure appear.
        </div>
      ) : (
        <div className="prio-list">
          {rows.map((row) => (
            <Row
              key={row.asset.id}
              row={row}
              selected={selectedId === row.asset.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Row({
  row,
  selected,
  onSelect,
}: {
  row: AssetRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { asset, band, score, hits, exposedFraction, vulnerability } = row;
  const primary = hits[0];
  const hazardColor = primary
    ? primary.severity === "severe" || primary.severity === "high"
      ? "high"
      : primary.severity
    : "low";

  return (
    <button
      type="button"
      className={`prio-item${selected ? " selected" : ""}`}
      onClick={() => onSelect(asset.id)}
      aria-pressed={selected}
    >
      <span className="score-box">
        <b>{score}</b>
        <span>/100</span>
      </span>

      <span className="prio-main">
        <span className="nm">{asset.name}</span>
        <span className="why">
          {primary
            ? `${primary.severity} ${primary.kind} exposure${
                asset.line ? ` (${Math.round(exposedFraction * 100)}% of alignment)` : ""
              }`
            : "Outside every mapped footprint"}
        </span>
        <span className="prio-meta">
          <span className="priority-kind">{SHORT_KIND[asset.kind]}</span>
          {primary && (
            <>
              <span className="priority-divider" aria-hidden="true">·</span>
              <span className={`priority-hazard priority-hazard--${hazardColor}`}>
                {primary.severity} {primary.kind}
              </span>
            </>
          )}
          {vulnerability === "unknown" && (
            <>
              <span className="priority-divider" aria-hidden="true">·</span>
              <span className="priority-unknown">condition unknown</span>
            </>
          )}
        </span>
      </span>

      <span className={`prio prio-${band}`} aria-label={`Priority ${band}`}>{band}</span>
    </button>
  );
}
