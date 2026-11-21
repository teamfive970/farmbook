import { ChevronDown, ChevronUp, PencilLine } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChoiceButton,
  DateChoice,
  MoneyPad,
  PictureGrid,
  QuantityStepper,
  Section
} from "../../components/Choices.jsx";
import { Button, ErrorBanner, Field, PageHeader, PageLoading, TextInput } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { batchStatus, formatMoney, sayMoney } from "../../lib/ledger.js";
import {
  ANIMALS,
  BUYER_TYPES,
  CROPS,
  CURRENCIES,
  HARVEST_UNITS,
  PAYMENT_METHODS,
  WORDS,
  growEmoji,
  optionFor,
  unitText
} from "../../lib/words.js";

// "I sell something": from a harvest batch (so what is left is known) or
// just a crop. Price with big number keys, buyer as pictures, and whether they
// paid. Saves the buyer, the sale and the payment on the phone, then sends.
export default function SaleForm() {
  const [params] = useSearchParams();
  const { records, loading } = useFarmerData();
  const { createRecord, online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const [harvestClientId, setHarvestClientId] = useState(params.get("harvest") || "");
  const harvest = records.harvests.find((item) => item.clientId === harvestClientId) || null;
  const [crop, setCrop] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [priceMode, setPriceMode] = useState("each");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("LRD");
  const [buyerChoice, setBuyerChoice] = useState(null); // { clientId } or { type }
  const [buyerName, setBuyerName] = useState("");
  const [paid, setPaid] = useState("all");
  const [paidAmount, setPaidAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayInputValue());
  const [showWrite, setShowWrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const batches = useMemo(
    () =>
      records.harvests
        .map((item) => ({ item, status: batchStatus(item, records.sales, records.inspections) }))
        .filter(({ status }) => status.remaining > 0),
    [records]
  );

  if (loading && records.harvests.length === 0 && records.sales.length === 0) return <PageLoading label="Opening…" />;

  const saleCrop = harvest ? harvest.crop : crop;
  const saleUnit = harvest ? harvest.unit : unit || "bags";
  const left = harvest ? batchStatus(harvest, records.sales, records.inspections).remaining : null;
  const qty = Number(quantity || 0);
  const total = priceMode === "each" ? Math.round(qty * Number(price || 0) * 100) / 100 : Number(price || 0);
  const paidValue = paid === "all" ? total : paid === "some" ? Number(paidAmount || 0) : 0;

  function chooseBatch(clientId) {
    setHarvestClientId(clientId === harvestClientId ? "" : clientId);
    setError("");
  }

  async function save() {
    setError("");
    if (!saleCrop) return setError("Touch what you sold.");
    if (qty <= 0) return setError("Touch plus to show how much you sold.");
    if (left !== null && qty > left) return setError(`Only ${left} ${unitText(saleUnit)} left in this harvest.`);
    if (total <= 0) return setError("Put the money with the numbers.");
    if (paid === "some" && (paidValue <= 0 || paidValue > total)) {
      return setError("Put how much they paid. It must be less than all the money.");
    }
    setBusy(true);
    try {
      let buyerClientId = null;
      if (buyerChoice?.clientId) buyerClientId = buyerChoice.clientId;
      else if (buyerChoice?.type || buyerName.trim()) {
        const type = buyerChoice?.type || "other";
        buyerClientId = newClientId();
        await createRecord("buyers", {
          clientId: buyerClientId,
          name: buyerName.trim() || optionFor(BUYER_TYPES, type).text,
          buyerType: type
        });
      }
      const saleClientId = newClientId();
      await createRecord("sales", {
        clientId: saleClientId,
        harvestClientId: harvest?.clientId || null,
        buyerClientId,
        saleDate: date,
        crop: saleCrop,
        quantity: qty,
        unit: saleUnit,
        unitPrice: priceMode === "each" ? Number(price) : null,
        totalAmount: total,
        currency
      });
      if (paidValue > 0) {
        await createRecord("payments", {
          clientId: newClientId(),
          saleClientId,
          amount: paidValue,
          paidDate: date,
          method
        });
      }
      toast.success(`You sold for ${formatMoney(total, currency)}. ${online ? "" : WORDS.saved.say}`);
      navigate(`/app/money/sales/${saleClientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const knownBuyers = records.buyers.slice(0, 6);

  return (
    <div className="space-y-4">
      <PageHeader
        title={WORDS.sell.text}
        subtitle="Touch the pictures and the numbers."
        backTo={harvest ? `/app/harvests/${harvest.clientId}` : "/app/money"}
        say={WORDS.sell}
      />
      <ErrorBanner message={error} />

      {batches.length > 0 && (
        <Section title={{ text: "From which harvest?", say: "From which harvest? Touch one, or leave it." }} hint="you can leave it">
          <div className="grid grid-cols-2 gap-2">
            {batches.map(({ item, status }) => (
              <ChoiceButton
                key={item.clientId}
                words={{ say: `${item.crop}. ${status.remaining} ${unitText(item.unit)} left.` }}
                selected={harvestClientId === item.clientId}
                onClick={() => chooseBatch(item.clientId)}
                className="flex-col gap-0 py-2"
              >
                <span className="text-2xl" aria-hidden="true">{growEmoji(item.crop)}</span>
                {item.crop}
                <span className="text-xs font-normal">
                  {status.remaining} {unitText(item.unit)} left
                </span>
              </ChoiceButton>
            ))}
          </div>
        </Section>
      )}

      {!harvest && (
        <Section title={{ text: "What you sold?", say: "What you sold? Touch the picture." }}>
          <PictureGrid items={[...CROPS, ...ANIMALS]} value={crop} onChange={(value) => setCrop(value || "")} columns={4} />
        </Section>
      )}

      <Section title={{ text: "How much you sold?", say: "How much you sold?" }}>
        <QuantityStepper value={quantity} onChange={setQuantity} label="How much sold" />
        {left !== null ? (
          <p className="mt-2 text-sm text-ink-soft">
            {left} {unitText(saleUnit)} left in this harvest
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {HARVEST_UNITS.map((item) => (
              <ChoiceButton
                key={item.value}
                words={item}
                selected={saleUnit === item.value}
                onClick={() => setUnit(item.value)}
                className="flex-col gap-0.5 py-1 text-xs"
              >
                <span className="text-2xl" aria-hidden="true">{item.emoji}</span>
                {item.text}
              </ChoiceButton>
            ))}
          </div>
        )}
      </Section>

      <Section title={WORDS.moneyType}>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((item) => (
            <ChoiceButton key={item.value} words={item} selected={currency === item.value} onClick={() => setCurrency(item.value)}>
              <span aria-hidden="true">{item.emoji}</span> {item.text}
            </ChoiceButton>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <ChoiceButton words={WORDS.pricePerOne} selected={priceMode === "each"} onClick={() => setPriceMode("each")}>
            {WORDS.pricePerOne.text}
          </ChoiceButton>
          <ChoiceButton words={WORDS.totalMoney} selected={priceMode === "total"} onClick={() => setPriceMode("total")}>
            {WORDS.totalMoney.text}
          </ChoiceButton>
        </div>
        <MoneyPad value={price} onChange={setPrice} currency={currency} />
        {priceMode === "each" && qty > 0 && Number(price) > 0 && (
          <p
            className="mt-3 rounded-xl bg-primary-soft px-4 py-3 text-center text-base font-bold text-primary-dark"
            data-say={`All together: ${sayMoney(total, currency)}.`}
          >
            {qty} × {formatMoney(price, currency)} = {formatMoney(total, currency)}
          </p>
        )}
      </Section>

      <Section title={WORDS.whoBuy} hint="you can leave it">
        {knownBuyers.length > 0 && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            {knownBuyers.map((buyer) => (
              <ChoiceButton
                key={buyer.clientId}
                words={{ say: buyer.name }}
                selected={buyerChoice?.clientId === buyer.clientId}
                onClick={() => setBuyerChoice(buyerChoice?.clientId === buyer.clientId ? null : { clientId: buyer.clientId })}
                className="justify-start text-left"
              >
                {optionFor(BUYER_TYPES, buyer.buyerType)?.emoji} {buyer.name}
              </ChoiceButton>
            ))}
          </div>
        )}
        <PictureGrid
          items={BUYER_TYPES}
          value={buyerChoice?.type || null}
          onChange={(type) => setBuyerChoice(type ? { type } : null)}
        />
        {buyerChoice?.type && (
          <TextInput
            className="mt-3"
            aria-label="Buyer name"
            placeholder="Name (somebody can write it)"
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            maxLength={120}
          />
        )}
      </Section>

      <Section title={WORDS.didTheyPay}>
        <div className="grid grid-cols-3 gap-2">
          <ChoiceButton words={WORDS.paidAll} selected={paid === "all"} onClick={() => setPaid("all")}>
            ✅ {WORDS.paidAll.text}
          </ChoiceButton>
          <ChoiceButton words={WORDS.paidSome} selected={paid === "some"} onClick={() => setPaid("some")}>
            ➗ {WORDS.paidSome.text}
          </ChoiceButton>
          <ChoiceButton words={WORDS.paidNone} selected={paid === "none"} onClick={() => setPaid("none")}>
            ⏳ {WORDS.paidNone.text}
          </ChoiceButton>
        </div>
        {paid === "some" && (
          <div className="mt-3">
            <p className="label">How much they pay?</p>
            <MoneyPad value={paidAmount} onChange={setPaidAmount} currency={currency} />
          </div>
        )}
        {paid !== "none" && (
          <div className="mt-3">
            <PictureGrid items={PAYMENT_METHODS} value={method} onChange={(value) => setMethod(value || "cash")} columns={4} />
          </div>
        )}
      </Section>

      <DateChoice value={date} onChange={setDate} />

      <Section>
        <button
          type="button"
          onClick={() => setShowWrite((value) => !value)}
          className="flex w-full items-center justify-between text-left"
          data-say={WORDS.writeMyself.say}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <PencilLine size={20} className="text-ink-soft" aria-hidden="true" /> {WORDS.writeMyself.text}
          </span>
          {showWrite ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showWrite && (
          <Field label="Buyer name" htmlFor="buyerName" className="mt-4">
            <TextInput id="buyerName" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} maxLength={120} />
          </Field>
        )}
      </Section>

      <Button size="lg" className="w-full text-lg" loading={busy} onClick={save} data-say={WORDS.save.say}>
        💵 {WORDS.save.text} {total > 0 ? `· ${formatMoney(total, currency)}` : ""}
      </Button>
    </div>
  );
}
