// Weather from Open-Meteo (free, no API key). The server fetches and caches it,
// so the TV makes no outside requests and Open-Meteo gets at most one call per 10 min.
import fs from 'node:fs/promises';

const TTL_MS = 10 * 60 * 1000;
let cache = { at: 0, data: null };

// WMO weather codes -> short label + icon name used by the front-end
const CODES = {
  0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'cloud'],
  45: ['Fog', 'fog'], 48: ['Fog', 'fog'],
  51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm', 'storm'], 99: ['Thunderstorm', 'storm'],
};
const describe = (code) => CODES[code] || ['—', 'cloud'];

function simplify(raw, city) {
  const c = raw.current;
  const [label, icon] = describe(c.weather_code);
  // next 4 hourly slots, every 3 hours, starting after the current hour
  const now = c.time.slice(0, 13);
  const start = Math.max(0, raw.hourly.time.findIndex((t) => t.slice(0, 13) === now));
  const hours = [3, 6, 9, 12].map((h) => {
    const i = start + h;
    return {
      time: raw.hourly.time[i]?.slice(11, 16),
      temp: Math.round(raw.hourly.temperature_2m[i]),
      icon: describe(raw.hourly.weather_code[i])[1],
      rainChance: raw.hourly.precipitation_probability?.[i] ?? null,
    };
  }).filter((h) => h.time);
  return {
    city,
    temp: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    wind: Math.round(c.wind_speed_10m),
    label,
    icon,
    isDay: c.is_day === 1,
    high: Math.round(raw.daily.temperature_2m_max[0]),
    low: Math.round(raw.daily.temperature_2m_min[0]),
    hours,
    updated: c.time,
  };
}

export async function getWeather({ lat, lon, city, timezone, fixture }) {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data;

  let raw;
  if (fixture) {
    raw = JSON.parse(await fs.readFile(fixture, 'utf8'));
  } else {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: lat, longitude: lon, timezone,
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'temperature_2m_max,temperature_2m_min',
      forecast_days: 2,
    });
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    raw = await res.json();
  }
  cache = { at: Date.now(), data: simplify(raw, city) };
  return cache.data;
}
