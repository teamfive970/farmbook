import { Sprout } from "lucide-react";
import { Link } from "react-router-dom";

export function BrandMark({ size = "md" }) {
  const dimensions = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const icon = size === "lg" ? 26 : 18;
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl bg-primary text-white ${dimensions}`}>
      <Sprout size={icon} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

export default function Brand({ to = "/", size = "md" }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5 text-primary-dark">
      <BrandMark size={size} />
      <span className={`font-bold tracking-tight ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        Minders
      </span>
    </Link>
  );
}
