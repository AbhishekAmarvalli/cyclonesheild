import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Asset, District, Point, Scenario } from "../types";
import type { AssetRow, HazardZone } from "../lib/analysis";
import {
  buildSatelliteMapId,
  createSatelliteLayer,
  interactiveSignIn,
  silentSignIn,
  type SatelliteMode,
} from "../lib/ee";
import { activeEeClient, activeEeProject, writeEeClient, writeEeProject } from "../lib/config";
import { predictNextStep } from "../lib/prediction";
import { cycloneSvg, CycloneIcon, kindSvg, SatelliteIcon } from "./icons";

interface Props {
  district: District;
  hazards: HazardZone[];
  rows: AssetRow[];
  unexposed: Asset[];
  scenario: Scenario;
  stormPoint: Point;
  stepIndex: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  layerCounts: { wind: number; surge: number; rainfall: number };
}

const ll = (p: Point): [number, number] => [p[1], p[0]];

const KIND_COLOR: Record<string, string> = {
  wind: "#f9ab00",
  surge: "#1a73e8",
  rainfall: "#9334e6",
};

const SEVERITY_OPACITY: Record<string, number> = {
  severe: 0.42,
  high: 0.3,
  moderate: 0.2,
  low: 0.14,
};

export default function MapPanel({
  district,
  hazards,
  rows,
  unexposed,
  scenario,
  stormPoint,
  stepIndex,
  selectedId,
  onSelect,
  layerCounts,
}: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  // ── Earth Engine satellite basemap ────────────────────────────────────
  const shownRef = useRef<L.TileLayer | null>(null);
  const [satOn, setSatOn] = useState(false);
  const [satMode, setSatMode] = useState<SatelliteMode>("truecolor");
  const [satLayer, setSatLayer] = useState<L.TileLayer | null>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [eeState, setEeState] = useState<"unknown" | "signin-required" | "ready" | "error">(
    "unknown",
  );
  const [eeMsg, setEeMsg] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [eeClient, setEeClient] = useState(() => activeEeClient());
  const [eeProject, setEeProject] = useState(() => activeEeProject());

  // ── map lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    const map = L.map(holder.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    }).setView([district.center[1], district.center[0]], 10);

    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.control.scale({ imperial: false }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);

    tileRef.current = tiles;
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(holder.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── fit to district ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = L.latLngBounds(district.boundary.map(ll));
    map.fitBounds(bounds, { padding: [26, 26] });
  }, [district]);

  // ── Earth Engine sign-in: silent attempt when satellite is switched on ──
  useEffect(() => {
    if (!satOn || eeState !== "unknown") return;
    const client = activeEeClient();
    if (!client) {
      setEeMsg("OAuth client ID not set — open Earth Engine setup below.");
      setEeState("error");
      setShowSetup(true);
      return;
    }
    let cancelled = false;
    silentSignIn(client, activeEeProject()).then(
      (res) => {
        if (!cancelled) setEeState(res);
      },
      (e: unknown) => {
        if (cancelled) return;
        setEeMsg(e instanceof Error ? e.message : "Earth Engine sign-in failed");
        setEeState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [satOn, eeState]);

  // ── request the Sentinel-2 tile source for the current district/mode ────
  useEffect(() => {
    if (!satOn) {
      setSatLayer(null);
      setSatLoading(false);
      return;
    }
    if (eeState !== "ready") return;
    let cancelled = false;
    setSatLoading(true);
    buildSatelliteMapId(district, satMode).then(
      (mapId) => {
        if (cancelled) return;
        setSatLayer(
          createSatelliteLayer(mapId, "Sentinel-2 © Copernicus · Google Earth Engine"),
        );
      },
      (e: unknown) => {
        if (cancelled) return;
        setEeMsg(e instanceof Error ? e.message : "Could not request satellite tiles");
        setEeState("error");
      },
    ).finally(() => {
      if (!cancelled) setSatLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [satOn, eeState, satMode, district]);

  // ── swap the basemap (satellite ⇄ OpenStreetMap) under the overlays ─────
  useEffect(() => {
    const map = mapRef.current;
    const osm = tileRef.current;
    if (!map) return;
    const target = satOn && satLayer ? satLayer : null;
    if (shownRef.current === target) return;
    if (shownRef.current) {
      map.removeLayer(shownRef.current);
      shownRef.current = null;
    }
    if (target) {
      if (osm && map.hasLayer(osm)) map.removeLayer(osm);
      target.addTo(map);
      shownRef.current = target;
    } else if (osm && !map.hasLayer(osm)) {
      osm.addTo(map);
    }
  }, [satOn, satLayer]);

  // ── draw overlays ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    // district boundary
    L.polygon(district.boundary.map(ll), {
      color: "#202124",
      weight: 2.5,
      dashArray: "7 6",
      fill: false,
      interactive: false,
    }).addTo(group);

    // hazard footprints
    for (const h of hazards) {
      const poly = L.polygon(h.ring.map(ll), {
        color: KIND_COLOR[h.kind],
        weight: 1.6,
        fillColor: KIND_COLOR[h.kind],
        fillOpacity: SEVERITY_OPACITY[h.severity] ?? 0.2,
        opacity: 0.95,
      });
      poly.bindTooltip(
        `<b>${h.label}</b><br/>${h.detail}<br/><span style="opacity:.7">${h.severity.toUpperCase()} · ${h.provenance.status}</span>`,
        { sticky: true, direction: "top" },
      );
      poly.addTo(group);
    }

    // Keep Fani's future observations off the forecast side of the replay map.
    const trackToShow = scenario.id === "fani-2019"
      ? scenario.track.slice(0, stepIndex + 1)
      : scenario.track;
    const trackPts = trackToShow.map((t) => [t.lat, t.lon] as [number, number]);
    L.polyline(trackPts, {
      color: "#202124",
      weight: 4,
      dashArray: "2 9",
      opacity: 0.85,
      lineCap: "round",
    }).addTo(group);

    trackToShow.forEach((t, i) => {
      const active = i === stepIndex;
      L.circleMarker([t.lat, t.lon], {
        radius: active ? 7 : 4,
        color: "#202124",
        weight: 2,
        fillColor: active ? "#ea4335" : "#ffffff",
        fillOpacity: 1,
      })
        .bindTooltip(`${t.time} · ${t.windKt} kt${t.label ? ` · ${t.label}` : ""}`, {
          sticky: true,
        })
        .addTo(group);
    });

    const trend = scenario.id === "fani-2019" ? predictNextStep(scenario, stepIndex) : null;
    if (trend) {
      L.polyline(
        [[scenario.track[stepIndex].lat, scenario.track[stepIndex].lon], [trend.predictedPoint[1], trend.predictedPoint[0]]],
        { color: "#d97706", weight: 3, dashArray: "7 7", opacity: 0.95 },
      ).addTo(group);
      L.circleMarker([trend.predictedPoint[1], trend.predictedPoint[0]], {
        radius: 8,
        color: "#9a4d00",
        weight: 3,
        fillColor: "#fbbf24",
        fillOpacity: 1,
      })
        .bindTooltip(`Trend estimate · ${trend.predictedWindKmh} km/h · ${trend.leadHours} h outlook`, { sticky: true })
        .addTo(group);
      L.circleMarker([trend.observedNext.lat, trend.observedNext.lon], {
        radius: 7,
        color: "#137333",
        weight: 3,
        fillColor: "#ffffff",
        fillOpacity: 1,
      })
        .bindTooltip(`Next reported track point · ${trend.observedWindKmh} km/h`, { sticky: true })
        .addTo(group);
    }

    // storm centre
    const storm = L.marker(ll(stormPoint), {
      icon: L.divIcon({
        className: "",
        html: `<div class="storm-pin">${cycloneSvg()}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
      zIndexOffset: 900,
      keyboard: false,
    });
    storm.bindTooltip(
      `Storm centre · ${scenario.track[stepIndex].time} · ${scenario.track[stepIndex].windKt} kt`,
      { sticky: true },
    );
    storm.addTo(group);

    // linear assets coloured by priority
    for (const row of rows) {
      if (!row.asset.line) continue;
      L.polyline(row.asset.line.map(ll), {
        color: row.band === "P1" ? "#d93025" : row.band === "P2" ? "#f9ab00" : row.band === "P3" ? "#1a73e8" : "#1e8e3e",
        weight: row.band === "P1" ? 6 : 4,
        opacity: 0.95,
        lineCap: "round",
      }).addTo(group);
    }

    // markers
    const pinFor = (asset: Asset, band: string | null) => {
      const cls =
        band === "P1"
          ? "p1"
          : band === "P2"
            ? "p2"
            : band === "P3"
              ? "p3"
              : band === "P4"
                ? "p4"
                : "off";
      const selected = selectedId === asset.id ? " selected" : "";
      const icon = L.divIcon({
        className: "",
        html: `<div class="asset-pin ${cls}${selected}" aria-hidden="true">${kindSvg(
          asset.kind,
        )}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const m = L.marker(ll(asset.location), {
        icon,
        zIndexOffset: selectedId === asset.id ? 700 : 300,
        keyboard: false,
      });
      const row = rows.find((r) => r.asset.id === asset.id);
      m.bindTooltip(
        `<b>${asset.name}</b><br/>${
          row
            ? `${row.band} · score ${row.score}/100 · ${row.hits[0]?.label ?? ""}`
            : "outside every mapped hazard footprint"
        }`,
        { sticky: true },
      );
      m.on("click", () => onSelect(asset.id));
      m.addTo(group);
    };

    rows.forEach((r) => pinFor(r.asset, r.band));
    unexposed.forEach((a) => pinFor(a, null));
  }, [hazards, rows, unexposed, scenario, stepIndex, selectedId, stormPoint, district, onSelect]);

  const visibleCount = layerCounts.wind + layerCounts.surge + layerCounts.rainfall;

  const satStatus = (): string => {
    if (!satOn) return "basemap · OpenStreetMap";
    if (eeState === "unknown") return "connecting to Earth Engine…";
    if (eeState === "signin-required") return "Google sign-in required for satellite";
    if (eeState === "error") return eeMsg;
    if (satLoading) return "rendering Sentinel-2 tiles…";
    return satMode === "truecolor"
      ? "Sentinel-2 true colour · Google Earth Engine"
      : "Sentinel-2 flood water (NDWI) · Google Earth Engine";
  };

  const handleSignIn = (): void => {
    setEeMsg("");
    interactiveSignIn(activeEeProject()).then(
      () => setEeState("ready"),
      (e: unknown) => {
        setEeMsg(e instanceof Error ? e.message : "Earth Engine sign-in failed");
        setEeState("error");
      },
    );
  };

  return (    <section className="card card--flush area-map map-wrap">
      <div className="map-head">
        <div className="card-head">
          <h2>Interactive map</h2>
          <span className="sub">
            {district.name} district · {visibleCount} hazard layers
          </span>
        </div>

        <div className="sat-row" role="group" aria-label="Satellite basemap controls">
          <button
            className={`sat-btn${satOn ? " on" : ""}`}
            type="button"
            aria-pressed={satOn}
            onClick={() => setSatOn((v) => !v)}
          >
            <SatelliteIcon size={15} />
            Satellite
          </button>

          {satOn && (
            <span className="sat-modes">
              {(["truecolor", "water"] as const).map((m) => (
                <button
                  key={m}
                  className={`sat-mode${satMode === m ? " on" : ""}`}
                  type="button"
                  aria-pressed={satMode === m}
                  onClick={() => setSatMode(m)}
                >
                  {m === "truecolor" ? "True colour" : "Flood water"}
                </button>
              ))}
            </span>
          )}

          <span className="sat-status">{satStatus()}</span>

          {satOn && eeState === "signin-required" && (
            <button className="btn btn--sm btn--primary" type="button" onClick={handleSignIn}>
              Sign in with Earth Engine
            </button>
          )}
          {satOn && eeState === "error" && (
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => {
                setEeMsg("");
                setEeState("unknown");
              }}
            >
              Retry
            </button>
          )}
          <button
            className="sat-setup-toggle"
            type="button"
            aria-expanded={showSetup}
            onClick={() => setShowSetup((s) => !s)}
          >
            setup
          </button>
        </div>

        {showSetup && (
          <div className="ee-setup">
            <p>
              <b>Earth Engine sign-in setup.</b> Satellite tiles need an OAuth 2.0{" "}
              <b>Web application client ID</b> from a Cloud project registered for Earth Engine —
              not an API key. In Google Cloud Console: enable the <b>Earth Engine API</b>, register
              the project for Earth Engine, then Credentials → Create credentials → OAuth client
              ID, adding this page's origin to <i>Authorized JavaScript origins</i>.
            </p>
            <div className="field">
              <span className="label">OAuth client ID</span>
              <input
                className="textinput"
                value={eeClient}
                placeholder="…apps.googleusercontent.com"
                autoComplete="off"
                onChange={(e) => {
                  setEeClient(e.target.value);
                  writeEeClient(e.target.value.trim());
                }}
              />
            </div>
            <div className="field">
              <span className="label">Cloud project ID</span>
              <input
                className="textinput"
                value={eeProject}
                placeholder="e.g. my-gee-project"
                autoComplete="off"
                onChange={(e) => {
                  setEeProject(e.target.value);
                  writeEeProject(e.target.value.trim());
                }}
              />
            </div>
            <button
              className="btn btn--sm btn--primary"
              type="button"
              onClick={() => {
                setEeMsg("");
                setEeState("unknown");
              }}
            >
              Save &amp; connect
            </button>
          </div>
        )}
      </div>

      <div className="map-stage">
        <div className="map-banner">
          <span className="banner-pill">
            <CycloneIcon size={14} /> {scenario.name}
          </span>
          <span className="banner-pill">
            Valid {scenario.track[stepIndex].time.replace("T", " ").replace(":00Z", "Z")}
          </span>
          <span className="banner-pill">{scenario.track[stepIndex].windKt} kt</span>
          <span className="banner-pill">
            {scenario.kind === "synthetic" ? "SYNTHETIC INPUT" : "RECORDED SCENARIO"}
          </span>
        </div>

        <div className="map-frame" ref={holder} />
      </div>

      <div className="legend">
        <span className="item">
          <span className="sw" style={{ background: "rgba(249,171,0,.35)", borderColor: "#f9ab00" }} />
          Wind swath
        </span>
        <span className="item">
          <span className="sw" style={{ background: "rgba(26,115,232,.35)", borderColor: "#1a73e8" }} />
          Inundation corridor
        </span>
        <span className="item">
          <span className="sw" style={{ background: "rgba(147,52,230,.3)", borderColor: "#9334e6" }} />
          Rainfall cell ≥ 64.5 mm/24 h
        </span>
        <span className="item">
          <span className="sw" style={{ background: "var(--g-red-700)" }} />
          P1
        </span>
        <span className="item">
          <span className="sw" style={{ background: "var(--g-yellow-base)" }} />
          P2
        </span>
        <span className="item">
          <span className="sw" style={{ background: "var(--g-blue-700)" }} />
          P3
        </span>
        <span className="item">
          <span className="sw" style={{ background: "var(--g-green-700)" }} />
          P4
        </span>
        {scenario.id === "fani-2019" ? (
          <>
            <span className="item"><span className="sw sw--dashed" />Observed track to input time</span>
            <span className="item"><span className="sw sw--forecast" />Prototype trend estimate</span>
            <span className="item"><span className="sw sw--observed" />Next reported track point</span>
          </>
        ) : (
        <span className="item">
          <span className="sw sw--dashed" />
          Forecast track — centre positions, not a damage forecast
        </span>
        )}
      </div>
    </section>
  );
}
