export default function FaniImpactMap() {
  return (
    <section className="fani-impact-section" aria-label="Cyclone Fani reported district impact map">
      <iframe
        className="fani-impact-frame"
        src="/fani-impact-map.html"
        title="Cyclone Fani: reported impact by Odisha district"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </section>
  );
}
