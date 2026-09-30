const WEATHER_PATHS = new Set([
  "currentConditions:lookup",
  "forecast/hours:lookup",
  "publicAlerts:lookup",
]);

const WEATHER_PARAMS = new Set([
  "location.latitude",
  "location.longitude",
  "unitsSystem",
  "languageCode",
  "hours",
  "pageSize",
]);

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: { message: "Method not allowed" } });
  }

  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    return response.status(503).json({
      error: {
        code: 503,
        message: "GOOGLE_API_KEY is not configured for this deployment.",
      },
    });
  }

  const url = new URL(request.url ?? "/api/weather", "https://cyclonesheild.vercel.app");
  const endpoint = url.searchParams.get("endpoint") ?? "";
  if (!WEATHER_PATHS.has(endpoint)) {
    return response.status(404).json({ error: { message: "Weather endpoint not allowed" } });
  }

  const query = new URLSearchParams();
  for (const [name, value] of url.searchParams) {
    if (WEATHER_PARAMS.has(name) && value.length <= 64) query.set(name, value);
  }

  const latitude = Number(query.get("location.latitude"));
  const longitude = Number(query.get("location.longitude"));
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    return response.status(400).json({ error: { message: "A valid location is required." } });
  }

  query.set("key", key);
  try {
    const upstream = await fetch(`https://weather.googleapis.com/v1/${endpoint}?${query.toString()}`);
    response.status(upstream.status);
    response.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    );
    return response.send(await upstream.text());
  } catch {
    return response.status(502).json({ error: { message: "Weather upstream is unavailable." } });
  }
}