import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudRainWind, CloudSun, Sun } from "lucide-react";

const ICONS = {
  sun: [Sun, "text-amber-500"],
  partly: [CloudSun, "text-amber-500"],
  cloud: [Cloud, "text-slate-500"],
  fog: [CloudFog, "text-slate-500"],
  drizzle: [CloudDrizzle, "text-sky-600"],
  rain: [CloudRain, "text-sky-600"],
  heavy: [CloudRainWind, "text-sky-800"],
  storm: [CloudLightning, "text-violet-700"]
};

export default function WeatherIcon({ kind, size = 24, className = "" }) {
  const [Icon, tone] = ICONS[kind] || ICONS.cloud;
  return <Icon size={size} className={`${tone} ${className}`} aria-hidden="true" />;
}
