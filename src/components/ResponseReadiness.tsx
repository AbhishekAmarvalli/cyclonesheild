import { assetsForDistrict } from "../data/assets";
import { TEST_RECIPIENTS } from "../lib/dispatch";

const shelters = assetsForDistrict("puri").filter((asset) => asset.kind === "shelter");

export default function ResponseReadiness() {
  return (
    <section className="response-readiness" aria-labelledby="response-readiness-title">
      <div className="response-heading">
        <div>
          <p className="eyebrow">Next steps</p>
          <h2 id="response-readiness-title">Shelter &amp; authority readiness</h2>
        </div>
        <a className="btn btn--primary" href="#advisory">Prepare authority alert</a>
      </div>

      <div className="response-columns">
        <section className="response-block">
          <h3>Evacuation center reference</h3>
          {shelters.length ? shelters.map((shelter) => (
            <article className="shelter-reference" key={shelter.id}>
              <div className="shelter-reference-title">
                <strong>{shelter.name}</strong>
                <span className="chip chip--yellow">Illustrative · unverified</span>
              </div>
              <dl className="shelter-facts">
                <div><dt>Reference point</dt><dd>{shelter.location[1].toFixed(3)}°N, {shelter.location[0].toFixed(3)}°E · demo only</dd></div>
                <div><dt>Capacity</dt><dd>{shelter.attributes.Capacity ?? "Unknown"}</dd></div>
                <div><dt>Operating status</dt><dd>Not verified</dd></div>
                <div><dt>Safe route</dt><dd>Not mapped</dd></div>
              </dl>
              <p>Confirm the official location, capacity, access route and open status with Puri DDMA before directing evacuees.</p>
            </article>
          )) : (
            <p className="response-empty">No verified evacuation-center directory is loaded for this district.</p>
          )}
        </section>

        <section className="response-block">
          <h3>Authority notification targets</h3>
          <ul className="authority-list">
            {TEST_RECIPIENTS.map((recipient) => (
              <li key={recipient.id}>
                <span><strong>{recipient.name}</strong><small>{recipient.role}</small></span>
                <span className="authority-channel">{recipient.channel} · test</span>
              </li>
            ))}
          </ul>
          <p className="response-disclaimer">
            Test routes only. This prototype does not contact real authorities; review the advisory and
            confirm approved channels before any operational dispatch.
          </p>
        </section>
      </div>
    </section>
  );
}