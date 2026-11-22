// Small inline SVG weather icons (no icon font or emoji font needed on the TV).
const sun = '<circle cx="32" cy="32" r="12" fill="#ffcf5c"/><g stroke="#ffcf5c" stroke-width="4" stroke-linecap="round"><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>';
const moon = '<path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z" fill="#d8def0"/>';
const cloudPath = '<path d="M20 48h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 48z" fill="#c9d1e0"/>';
const smallSun = '<circle cx="22" cy="22" r="9" fill="#ffcf5c"/><g stroke="#ffcf5c" stroke-width="3" stroke-linecap="round"><path d="M22 5v5M5 22h5M10 10l3.5 3.5M34 10l-3.5 3.5"/></g>';
const drops = '<g stroke="#7cc4ff" stroke-width="4" stroke-linecap="round"><path d="M24 54l-3 6M34 54l-3 6M44 54l-3 6"/></g>';
const flakes = '<g fill="#ffffff"><circle cx="23" cy="57" r="3"/><circle cx="33" cy="60" r="3"/><circle cx="43" cy="57" r="3"/></g>';
const bolt = '<path d="M34 46l-8 12h7l-3 8 10-13h-7l3-7z" fill="#ffcf5c"/>';
const fog = '<g stroke="#c9d1e0" stroke-width="4" stroke-linecap="round"><path d="M12 26h40M8 36h48M14 46h36"/></g>';

export const ICONS = {
  sun, moon,
  partly: smallSun + cloudPath,
  cloud: cloudPath,
  rain: cloudPath + drops,
  snow: cloudPath + flakes,
  storm: cloudPath + bolt,
  fog,
};

export function iconSvg(name, isDay = true) {
  const n = name === 'sun' && !isDay ? 'moon' : name;
  return ICONS[n] || ICONS.cloud;
}
