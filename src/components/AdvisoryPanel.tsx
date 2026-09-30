import { useMemo, useState, type ReactNode } from "react";
import type { AnalysisRun } from "../lib/analysis";
import {
  buildEvidencePacket,
  draftAdvisory,
  type AdvisoryDraft,
  type EvidencePacket,
} from "../lib/gemini";
import { fmtIST } from "../lib/format";
import { CheckIcon, WarnIcon } from "./icons";
import { activeKey, DEFAULT_MODEL, readStoredModel, writeKey, writeModel } from "../lib/config";
import {
  buildPayload,
  sendTestDispatch,
  TEST_RECIPIENTS,
  type DispatchRecord,
  type Recipient,
} from "../lib/dispatch";

interface Props {
  run: AnalysisRun;
}

const snapshotOf = (run: AnalysisRun) =>
  `${run.scenario.id}@${run.stepIndex}@${run.rows.length}`;

export default function AdvisoryPanel({ run }: Props) {
  const packet: EvidencePacket = useMemo(() => buildEvidencePacket(run), [run]);

  const [apiKey, setApiKey] = useState(activeKey());
  const [model, setModel] = useState(readStoredModel());
  const [officerNote, setOfficerNote] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [draft, setDraft] = useState<AdvisoryDraft | null>(null);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<string[]>(TEST_RECIPIENTS.map((r) => r.id));
  const [dispatch, setDispatch] = useState<DispatchRecord | null>(null);
  const [dispatching, setDispatching] = useState(false);

  const currentSnapshot = snapshotOf(run);
  const stale = draft !== null && snapshot !== currentSnapshot;

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await draftAdvisory(packet, { apiKey, model, officerNote });
      setDraft(d);
      setBody(d.body);
      setEditing(false);
      setSnapshot(currentSnapshot);
      setDispatch(null);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : String(e)} — falling back is available below.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const generateOffline = () => {
    setError(null);
    void draftAdvisory(packet, { apiKey: "", model, officerNote }).then((d) => {
      setDraft(d);
      setBody(d.body);
      setEditing(false);
      setSnapshot(currentSnapshot);
      setDispatch(null);
    });
  };

  const send = async () => {
    if (!draft) return;
    setDispatching(true);
    setDispatch(null);
    const chosen: Recipient[] = TEST_RECIPIENTS.filter((r) => recipients.includes(r.id));
    await sendTestDispatch(
      {
        headline: draft.headline,
        body,
        scenario: `${run.scenario.name} (${run.scenario.code})`,
        validTime: fmtIST(run.storm.time),
        assets: run.rows.slice(0, 8).map((r) => `${r.asset.name} [${r.band}]`),
        evidenceCount:
          packet.hazardLayers.length +
          packet.exposedAssets.length +
          draft.citations.length,
      },
      chosen.length ? chosen : TEST_RECIPIENTS.slice(0, 1),
      (rec) => setDispatch(rec),
    );
    setDispatching(false);
  };

  const payloadPreview = draft
    ? buildPayload({
        headline: draft.headline,
        body,
        scenario: run.scenario.code,
        validTime: fmtIST(run.storm.time),
        assets: run.rows.slice(0, 8).map((r) => `${r.asset.name} [${r.band}]`),
        evidenceCount: packet.hazardLayers.length + packet.exposedAssets.length,
      })
    : "";

  return (
    <section id="advisory" className="card card--yellow area-advisory">
      <div className="card-head">
        <h2>Advisory panel — Gemini drafting, review &amp; test dispatch</h2>
        <span className="sub">
          {apiKey ? `key configured · ${model}` : "no API key · offline drafter"}
        </span>
      </div>

      <div className="advisory-grid">
        {/* ── 1. evidence packet + generate ─────────────────────────────── */}
        <div>
          <div className="section-label" style={{ marginTop: 0 }}>
            1 · Evidence packet (what Gemini receives)
          </div>
          <div className="packet">
            {JSON.stringify(packet, null, 2)}
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <span className="label">Google AI Studio API key</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="textinput"
                type={showKey ? "text" : "password"}
                value={apiKey}
                placeholder="AIza… (optional — offline drafter used if empty)"
                onChange={(e) => {
                  setApiKey(e.target.value);
                  writeKey(e.target.value);
                }}
                style={{ fontWeight: 400 }}
              />
              <button className="btn btn--sm" type="button" onClick={() => setShowKey((s) => !s)}>
                {showKey ? "hide" : "show"}
              </button>
            </div>
          </div>

          <label className="field">
            <span className="label">Model</span>
            <select
              className="select"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                writeModel(e.target.value);
              }}
            >
              {[DEFAULT_MODEL, "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-3.7-flash"].map(
                (m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field">
            <span className="label">Officer instruction (optional)</span>
            <textarea
              className="textarea"
              value={officerNote}
              onChange={(e) => setOfficerNote(e.target.value)}
              placeholder="e.g. Emphasise the hospital and the 220 kV substation; keep it under 200 words for SMS relay."
            />
          </label>

          <div className="btn-row">
            <button className="btn btn--primary" type="button" onClick={generate} disabled={busy}>
              {busy && <span className="spinner" />} Generate advisory
            </button>
            <button className="btn btn--ghost" type="button" onClick={generateOffline} disabled={busy}>
              Offline draft
            </button>
          </div>

          {error && (
            <div className="note note--warn" style={{ marginTop: 10 }}>
              <b>Gemini request failed:</b> {error}
            </div>
          )}

          <p className="note" style={{ marginTop: 10 }}>
            The model is constrained to these facts: it is told not to invent rainfall, flood
            depth, wind or damage figures, and to repeat "unknown" where the register says
            unknown. Key is stored in this browser only (or via{" "}
            <code>VITE_GEMINI_API_KEY</code>).
          </p>
        </div>

        {/* ── 2. review ─────────────────────────────────────────────────── */}
        <div>
          <div className="section-label" style={{ marginTop: 0 }}>
            2 · Review the draft
          </div>

          {!draft ? (
            <div className="empty">
              No advisory yet. Generate one from the evidence packet on the left — the draft will
              be editable here before anything is dispatched.
            </div>
          ) : (
            <>
              <div
                className="note"
                style={{
                  marginBottom: 10,
                  borderColor: stale ? "var(--g-red)" : "var(--g-green)",
                  background: stale ? "var(--g-red-tint)" : "var(--g-green-tint)",
                  color: "var(--ink)",
                }}
              >
                <b>
                  {draft.mode === "gemini"
                    ? `Drafted by ${draft.model}`
                    : `Drafted by ${draft.model}`}
                </b>{" "}
                · {fmtIST(draft.generatedAt)} · evidence snapshot{" "}
                {run.scenario.name} @ step {run.stepIndex + 1}
                {stale && (
                  <>
                    <br />
                    <span className="inline-ico">
                      <WarnIcon size={14} />
                      <b>Stale draft:</b>
                    </span>{" "}
                    the scenario, forecast step or asset set has changed
                    since this draft was generated. Regenerate before dispatch.
                  </>
                )}
              </div>

              {editing ? (
                <>
                  <textarea
                    className="textarea textarea--tall"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    aria-label="Advisory text"
                  />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn btn--green btn--sm" type="button" onClick={() => setEditing(false)}>
                      Save edits
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() => {
                        setBody(draft.body);
                        setEditing(false);
                      }}
                    >
                      Revert
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="advisory-body">{renderBody(body)}</div>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn btn--sm" type="button" onClick={() => setEditing(true)}>
                      Edit text
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(body)}
                    >
                      Copy
                    </button>
                  </div>
                </>
              )}

              <div className="section-label">Cited evidence</div>
              <ul className="bullets">
                {draft.citations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ── 3. dispatch ───────────────────────────────────────────────── */}
        <div>
          <div className="section-label" style={{ marginTop: 0 }}>
            3 · Test notification
          </div>

          <div className="note note--warn" style={{ marginBottom: 10 }}>
            <b>SIMULATED DISPATCH.</b> No message leaves this browser. Recipients are test routes
            and addresses are placeholders.
          </div>

          {TEST_RECIPIENTS.map((r) => (
            <label className="recipient" key={r.id}>
              <input
                type="checkbox"
                checked={recipients.includes(r.id)}
                onChange={() =>
                  setRecipients((prev) =>
                    prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                  )
                }
              />
              <span className="who">
                <b>{r.name}</b>
                <span>
                  {r.channel} · {r.address} · {r.role}
                </span>
              </span>
            </label>
          ))}

          <div className="btn-row" style={{ marginTop: 10 }}>
            <button
              className="btn btn--danger"
              type="button"
              onClick={send}
              disabled={!draft || dispatching || stale}
            >
              {dispatching && <span className="spinner" />} Send test advisory
            </button>
            {!draft && <span className="chip">generate first</span>}
            {stale && <span className="chip chip--red">stale draft</span>}
          </div>

          {dispatch && (
            <div style={{ marginTop: 12 }}>
              <div className="prio-meta" style={{ marginBottom: 8 }}>
                <span className={`chip ${dispatch.status === "delivered" ? "chip--green" : "chip--yellow"}`}>
                  {dispatch.status}
                </span>
                <span className="chip">{dispatch.id}</span>
                <span className="chip">simulated</span>
              </div>
              {dispatch.steps.map((s, i) => (
                <div className="dispatch-step" key={i}>
                  <span className="tick">
                    <CheckIcon size={14} />
                  </span>
                  <span>
                    {s.label}
                    <br />
                    <span style={{ color: "var(--muted)" }}>{fmtIST(s.at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="section-label">Payload preview</div>
          <div className="pre">{payloadPreview || "Generate an advisory to preview the payload."}</div>
        </div>
      </div>
    </section>
  );
}

/* ── tiny markdown-lite renderer so edits stay single-source ────────────── */
function renderBody(text: string) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];

  const flush = (key: string) => {
    if (bullets.length) {
      out.push(
        <ul key={`u${key}`}>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (ordered.length) {
      out.push(
        <ol key={`o${key}`}>
          {ordered.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ol>,
      );
      ordered = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flush(`s${idx}`);
      return;
    }
    if (line.startsWith("## ")) {
      flush(`s${idx}`);
      out.push(<h2 key={idx}>{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      flush(`s${idx}`);
      out.push(<h1 key={idx}>{line.slice(2)}</h1>);
    } else if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      ordered.push(line.replace(/^\d+\.\s+/, ""));
    } else {
      flush(`s${idx}`);
      out.push(<p key={idx}>{line}</p>);
    }
  });
  flush("end");
  return out;
}
