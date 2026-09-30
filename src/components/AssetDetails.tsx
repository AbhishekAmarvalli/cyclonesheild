import type { Asset } from "../types";
import type { AnalysisRun, AssetRow } from "../lib/analysis";
import { ASSET_LABEL } from "../data/assets";
import { fmtUTC } from "../lib/format";
import { WarnIcon } from "./icons";

interface Props {
  run: AnalysisRun;
  selectedId: string | null;
}

const statusColor: Record<string, string> = {
  recorded: "chip--green",
  derived: "chip--blue",
  simulated: "chip--yellow",
  synthetic: "chip--red",
  sample: "chip--blue",
};

export default function AssetDetails({ run, selectedId }: Props) {
  const row: AssetRow | null = run.rows.find((r) => r.asset.id === selectedId) ?? null;
  const unexposedAsset = run.unexposed.find((a) => a.id === selectedId) ?? null;
  const selected = row ?? unexposedAsset;

  if (!selected) {
    return (
      <section className="card card--blue">
        <div className="card-head">
          <h2>Asset details</h2>
        </div>
        <div className="empty">
          Click a marker on the map or an entry in the priority list to inspect the hazard it
          intersects, the sources behind it, what is known about the structure, and — just as
          importantly — what is <b>unknown</b>.
        </div>
      </section>
    );
  }

  if (!row) return <UnexposedDetails asset={unexposedAsset!} run={run} />;

  return (
    <section className="card card--blue">
      <div className="card-head">
        <h2>Asset details</h2>
        <span className="sub">
          {row.hits.length} hazard hit{row.hits.length === 1 ? "" : "s"} · confidence{" "}
          {row.confidence}
        </span>
      </div>

      <div className="detail-scroll">
        <div className="detail-title">
          <div>
            <h3>{row.asset.name}</h3>
            <div className="prio-meta" style={{ marginTop: 6 }}>
              <span className={`prio prio-${row.band}`}>
                {row.band} · {BAND_TEXT[row.band]}
              </span>
              <span className="chip">{ASSET_LABEL[row.asset.kind]}</span>
              <span className="chip">importance {row.asset.importance}/5</span>
            </div>
          </div>
        </div>

        {/* score */}
        <div className="section-label">Priority score — {row.score}/100</div>
        <div className="meter" style={{ ["--accent" as string]: accentFor(row.band) }}>
          <i style={{ width: `${row.score}%`, background: accentFor(row.band) }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <Factor
            label="Hazard × 0.45"
            value={row.hazardScore}
            color="var(--g-red)"
            display={`${row.severity} · ${row.hits.length} zone(s)`}
          />
          <Factor
            label="Vulnerability × 0.30"
            value={row.vulnerabilityScore}
            color="var(--g-yellow)"
            display={
              row.vulnerabilityScore === null
                ? "unknown → weight redistributed"
                : `${row.vulnerability} (${row.vulnerabilityScore.toFixed(2)})`
            }
          />
          <Factor
            label="Importance × 0.25"
            value={row.importanceScore}
            color="var(--g-blue)"
            display={`${row.asset.importance}/5`}
          />
        </div>

        {/* hazard intersection */}
        <div className="section-label">Hazard intersection</div>
        {row.hits.map((h) => (
          <div className="evidence" key={h.zoneId} style={{ borderColor: "var(--g-red)" }}>
            <b>
              {h.label} <span style={{ opacity: 0.7 }}>({h.severity})</span>
            </b>
            <div>{h.detail}</div>
            <span className="src">
              {run.scenario.bulletin.source} · status:{" "}
              {run.scenario.kind === "synthetic" ? "synthetic" : run.scenario.bulletin.status} ·
              observed {run.scenario.bulletin.observedAt ?? "n/a"} · loaded{" "}
              {run.scenario.bulletin.retrievedAt.slice(0, 10)}
            </span>
          </div>
        ))}

        {/* why */}
        <div className="section-label">Why this priority</div>
        <ul className="bullets">
          {row.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        {/* vulnerability */}
        <div className="section-label">Known vulnerability</div>
        <div
          className="note"
          style={{
            borderColor:
              row.vulnerability === "unknown" ? "var(--g-red)" : "var(--g-green)",
            background:
              row.vulnerability === "unknown" ? "var(--g-red-tint)" : "var(--g-green-tint)",
            color: "var(--ink)",
          }}
        >
          {row.vulnerability === "unknown" ? (
            <>
              <b>STRUCTURE: UNKNOWN.</b> {row.asset.structure.basis} The score therefore excludes
              the vulnerability factor entirely rather than assuming a value.
            </>
          ) : (
            <>
              <b>STRUCTURE: {row.vulnerability.toUpperCase()}.</b> {row.asset.structure.basis}
              {row.asset.structure.inspectedAt && (
                <>
                  {" "}
                  Last inspected <b>{row.asset.structure.inspectedAt}</b>.
                </>
              )}
            </>
          )}
        </div>

        {/* attributes */}
        <div className="section-label">Attributes</div>
        <dl className="kv" style={{ gridTemplateColumns: "1fr auto" }}>
          {Object.entries(row.asset.attributes).map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>
                {v === null || v === "Unknown" ? (
                  <span className="chip chip--unknown">unknown</span>
                ) : typeof v === "boolean" ? (
                  <span className="chip chip--green">{v ? "yes" : "no"}</span>
                ) : (
                  String(v)
                )}
              </dd>
            </div>
          ))}
          <dt>Ground elevation</dt>
          <dd>
            {row.asset.elevationM === null ? (
              <span className="chip chip--unknown">unknown</span>
            ) : (
              `${row.asset.elevationM} m AMSL (SRTM 30 m)`
            )}
          </dd>
        </dl>

        {/* evidence */}
        <div className="section-label">Evidence &amp; timestamps</div>
        {row.evidence.map((e, i) => (
          <div className="evidence" key={i}>
            {e.text}
            <span className="src">
              {e.source} · <span className={`chip ${statusColor[e.status]}`}>{e.status}</span>
              {e.observedAt ? ` · observed ${e.observedAt}` : ""} · asset record compiled{" "}
              {fmtUTC(row.asset.provenance.retrievedAt)}
            </span>
          </div>
        ))}

        {/* gaps */}
        <div className="section-label">Missing information</div>
        {row.dataGaps.length === 0 ? (
          <div className="note">No missing attributes recorded for this asset.</div>
        ) : (
          <div className="gap-list">
            {row.dataGaps.map((g, i) => (
              <div className="gap" key={i}>
                <WarnIcon size={14} />
                <span>{g}</span>
              </div>
            ))}
          </div>
        )}

        <div className="section-label">Data source</div>
        <div className="note">
          {row.asset.provenance.source}
          <br />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
            status: {row.asset.provenance.status} · compiled{" "}
            {fmtUTC(row.asset.provenance.retrievedAt)} · {row.asset.provenance.note}
          </span>
        </div>
      </div>
    </section>
  );
}

const BAND_TEXT: Record<string, string> = {
  P1: "Immediate action",
  P2: "Prepare today",
  P3: "Monitor & verify",
  P4: "Awareness",
};

const accentFor = (band: string) =>
  band === "P1"
    ? "var(--g-red)"
    : band === "P2"
      ? "var(--g-yellow)"
      : band === "P3"
        ? "var(--g-blue)"
        : "var(--g-green)";

function Factor({
  label,
  value,
  color,
  display,
}: {
  label: string;
  value: number | null;
  color: string;
  display: string;
}) {
  return (
    <div className="factor-row">
      <span>{label}</span>
      <span className="bar">
        <i style={{ width: `${(value ?? 0) * 100}%`, background: color }} />
      </span>
      <span className="val">{value === null ? "—" : value.toFixed(2)}</span>
      <span style={{ gridColumn: "1 / -1", color: "var(--muted)", fontSize: 10.5 }}>
        {display}
      </span>
    </div>
  );
}

function UnexposedDetails({ asset, run }: { asset: Asset; run: AnalysisRun }) {
  return (
    <section className="card card--green">
      <div className="card-head">
        <h2>Asset details</h2>
        <span className="sub">outside footprint</span>
      </div>
      <div className="detail-scroll">
        <div className="detail-title">
          <div>
            <h3>{asset.name}</h3>
            <div className="prio-meta" style={{ marginTop: 6 }}>
              <span className="chip chip--green">not exposed at this step</span>
              <span className="chip">{ASSET_LABEL[asset.kind]}</span>
              <span className="chip">importance {asset.importance}/5</span>
            </div>
          </div>
        </div>

        <div className="section-label">Assessment</div>
        <ul className="bullets">
          <li>
            Outside every mapped hazard footprint for {run.scenario.name} at valid time{" "}
            {run.storm.time.replace("T", " ")}Z.
          </li>
          <li>{asset.importanceRationale}</li>
          <li>
            Structure:{" "}
            {asset.structure.value === "unknown" ? "UNKNOWN" : asset.structure.value.toUpperCase()}{" "}
            — {asset.structure.basis}
          </li>
          <li>
            Re-check at the next forecast step: footprints move with the storm centre, so
            "not exposed" is only true for this valid time.
          </li>
        </ul>

        <div className="section-label">Missing information</div>
        <div className="gap-list">
          {Object.entries(asset.attributes)
            .filter(([, v]) => v === null || v === "Unknown")
            .map(([k]) => (
              <div className="gap" key={k}>
                <WarnIcon size={14} />
                <span>Attribute unknown: {k}.</span>
              </div>
            ))}
          {asset.structure.value === "unknown" && (
            <div className="gap">
              <WarnIcon size={14} />
              <span>Structural vulnerability UNKNOWN.</span>
            </div>
          )}
        </div>

        <div className="section-label">Data source</div>
        <div className="note">
          {asset.provenance.source}
          <br />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
            status: {asset.provenance.status} · compiled {fmtUTC(asset.provenance.retrievedAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
