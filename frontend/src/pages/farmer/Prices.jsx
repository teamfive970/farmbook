import { ChevronRight, Store } from "lucide-react";
import { Link } from "react-router-dom";
import MarketPrices from "../../components/MarketPrices.jsx";
import { PageHeader } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { WORDS } from "../../lib/words.js";

// Market prices for the farmer, starting with their own county: what other
// FarmBok farmers got for the same crop lately. Helps set a fair price.
export default function Prices() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <PageHeader title={WORDS.pricesTitle.text} subtitle="What crops sold for lately." say={WORDS.pricesTitle} backTo="/app/money" />
      <MarketPrices defaultCounty={user?.county || "all"} wide />
      <Link
        to="/market"
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
        data-say="See what other farmers have for sale."
      >
        <Store size={22} className="text-primary" aria-hidden="true" />
        <span className="flex-1 text-sm font-bold text-ink">See harvests for sale</span>
        <ChevronRight size={18} className="text-ink-soft" aria-hidden="true" />
      </Link>
    </div>
  );
}
