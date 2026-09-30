const references = [
  {
    name: "Google Weather Lab",
    url: "https://deepmind.google.com/science/weatherlab",
    limitation: "Experimental research forecasts are not official warnings.",
    safeguard:
      "Not connected in this build. If added, preserve multiple tracks, label them experimental, and compare with IMD; never present them as official warnings.",
  },
  {
    name: "IMD / RSMC New Delhi",
    url: "https://rsmcnewdelhi.imd.gov.in/",
    limitation: "A forecast position is uncertain; a track is not an exact route.",
    safeguard:
      "The Fani points here are rounded historical inputs, not a live IMD cone. Use current IMD bulletins and uncertainty guidance for warning decisions.",
  },
  {
    name: "Windy hurricane tracker",
    url: "https://community.windy.com/topic/37123/understand-hurricane-tracking-forecast-and-measurements/2",
    limitation: "A standard 10 m wind layer does not establish a cyclone's maximum sustained wind.",
    safeguard:
      "Windy is not an input in this build. Keep general 10 m wind maps separate from cyclone maximum sustained winds reported by IMD.",
  },
  {
    name: "CLIMADA",
    url: "https://climada-python.readthedocs.io/en/v6.1.0/user-guide/0_10min_climada.html",
    limitation: "Impact estimates depend on local exposure data and region-appropriate vulnerability functions.",
    safeguard:
      "CLIMADA is not integrated. P1–P4 are exposure-screening priorities, not damage or loss estimates; unknown vulnerability stays unknown until locally validated data exists.",
  },
];

export default function TrustPanel() {
  return (
    <details className="trust-disclosure">
      <summary>
        <span>Trust, limits &amp; safeguards</span>
        <small>Evidence trail · one Fani replay · not independently validated</small>
      </summary>
      <div className="trust-content">
        <div className="trust-proof-strip">
          <div>
            <strong>Traceable</strong>
            <span>IMD track and post-event source links</span>
          </div>
          <div>
            <strong>Measured, not marketed</strong>
            <span>Fani example: 190 vs 176 km/h · 61 km track error</span>
          </div>
          <div>
            <strong>Human authority</strong>
            <span>Official warnings stay with IMD · dispatch is simulated</span>
          </div>
        </div>

        <p className="trust-method-note">
          <b>What is the AI here?</b> The displayed track estimate is a reproducible linear trend
          baseline, not a trained AI forecast. Gemini is used only to draft advisories from the
          evidence packet. One historical example does not establish forecast skill.
        </p>

        <div className="trust-rows" aria-label="Reference systems and CycloneSheild safeguards">
          {references.map((reference) => (
            <article className="trust-row" key={reference.name}>
              <div className="trust-reference">
                <a href={reference.url} target="_blank" rel="noreferrer">
                  {reference.name}
                </a>
              </div>
              <div>
                <b>Known limit</b>
                <p>{reference.limitation}</p>
              </div>
              <div>
                <b>CycloneSheild safeguard</b>
                <p>{reference.safeguard}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="trust-footer">
          Before operational use: validate across many storms and agencies, add official uncertainty
          tracks, verify local infrastructure, calibrate regional vulnerability data, and require
          authorized human review.
        </p>
      </div>
    </details>
  );
}