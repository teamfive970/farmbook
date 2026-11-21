import { ChevronDown, ChevronUp, CircleCheck, Hourglass, PencilLine, SplitSquareHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChoiceButton,
  CropIcon,
  DateChoice,
  MoneyPad,
  PictureGrid,
  QuantityStepper,
  Section,
  moneyText
} from "../../components/Choices.jsx";
import {
  Button,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  TextInput,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { allYieldChoices } from "../../lib/farmCrops.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { batchStatus, formatMoney, saleStatus, sayMoney } from "../../lib/ledger.js";
import {
  BUYER_TYPES,
  CURRENCIES,
  HARVEST_UNITS,
  PAYMENT_METHODS,
  WORDS,
  growOption,
  optionFor,
  unitText
} from "../../lib/words.js";

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

// "I sell something": from a harvest batch (so what is left is known) or
// one of the crops on the farmer's farms. Price with big number keys, buyer as
// pictures, and whether they paid. Saves the buyer, the sale and the payment
// on the phone, then sends. Opened with a sale id, it changes that sale
// (payments are added or taken off on the sale's own page).
export default function SaleForm() {
  const { clientId } = useParams();
  const editing = Boolean(clientId);
  const [params] = useSearchParams();
  const { farms, records, loading } = useFarmerData();
  const { createRecord, updateRecord, online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const existing = editing ? records.sales.find((item) => item.clientId === clientId) : null;
  const [ready, setReady] = useState(!editing);
  const [harvestClientId, setHarvestClientId] = useState(params.get("harvest") || "");
  const [crop, setCrop] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("bags");
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

  useEffect(() => {
    if (!editing || ready || !existing) return;
    setHarvestClientId(existing.harvestClientId || "");
    setCrop(existing.crop || "");
    setQuantity(String(existing.quantity ?? ""));
    setUnit(existing.unit || "bags");
    if (existing.unitPrice) {
      setPriceMode("each");
      setPrice(moneyText(existing.unitPrice));
    } else {
      setPriceMode("total");
      setPrice(moneyText(existing.totalAmount));
    }
    setCurrency(existing.currency);
    // A buyer that was deleted is left out (the sale keeps working without it).
    const buyerStillThere = records.buyers.some((item) => item.clientId === existing.buyerClientId);
    setBuyerChoice(existing.buyerClientId && buyerStillThere ? { clientId: existing.buyerClientId } : null);
    setDate(existing.saleDate);
    setReady(true);
  }, [editing, existing, ready, records.buyers]);

  const harvest = records.harvests.find((item) => item.clientId === harvestClientId) || null;
  // Opened from a planting or animal group: only its harvests, and a sale
  // without a harvest still belongs to it.
  const fromProduction = records.productions.find((item) => item.clientId === params.get("production")) || null;
  const batches = useMemo(
    () =>
      records.harvests
        .filter((item) => !fromProduction || item.productionClientId === fromProduction.clientId)
        .map((item) => ({ item, status: batchStatus(item, records.sales, records.inspections) }))
        .filter(({ status }) => status.remaining > 0),
    [records, fromProduction]
  );
  useEffect(() => {
    if (editing || !fromProduction || crop) return;
    if (fromProduction.productionKind === "crop") setCrop(fromProduction.name);
  }, [editing, fromProduction, crop]);
  // Without a batch, only what is on the farmer's farms (and eggs or milk
  // when a farm keeps animals).
  const cropChoices = useMemo(() => allYieldChoices(farms).map((name) => growOption(name)), [farms]);

  if (editing && !existing) {
    return loading ? <PageLoading label="Opening…" /> : <PageHeader title="Sale not found" backTo="/app/money" />;
  }
  if (!ready || (loading && records.harvests.length === 0 && records.sales.length === 0)) {
    return <PageLoading label="Opening…" />;
  }

  const saleCrop = harvest ? harvest.crop : crop;
  const saleUnit = harvest ? harvest.unit : unit;
  // What is left in the batch, counting this sale's own amount back in when changing it.
  const left = harvest
    ? round(
        batchStatus(harvest, records.sales, records.inspections).remaining +
          (existing && existing.harvestClientId === harvest.clientId ? Number(existing.quantity) : 0)
      )
    : null;
  const qty = Number(quantity || 0);
  const total = priceMode === "each" ? round(qty * Number(price || 0)) : round(price);
  const paidValue = paid === "all" ? total : paid === "some" ? round(paidAmount) : 0;
  const alreadyPaid = existing ? saleStatus(existing, records.payments).paid : 0;

  function chooseBatch(nextClientId) {
    setHarvestClientId(nextClientId === harvestClientId ? "" : nextClientId);
    setError("");
  }

  function chooseCurrency(next) {
    if (next === currency) return;
    if (alreadyPaid > 0) return setError("Money was already paid for this sale, so the money type can't change.");
    setCurrency(next);
    // Liberian dollars are whole amounts.
    if (next === "LRD") {
      setPrice((value) => String(value).split(".")[0]);
      setPaidAmount((value) => String(value).split(".")[0]);
    }
  }

  async function save() {
    setError("");
    if (!saleCrop) return setError("Choose what you sold.");
    if (qty <= 0) return setError("Enter how much you sold.");
    if (left !== null && qty > left) return setError(`Only ${left} ${unitText(saleUnit)} left in this harvest.`);
    if (total <= 0) return setError("Enter the amount.");
    if (editing && total < alreadyPaid) {
      return setError(`The buyer already paid ${formatMoney(alreadyPaid, currency)}. The sale can't be less than that.`);
    }
    if (!editing && paid === "some" && (paidValue <= 0 || paidValue >= total)) {
      return setError("Enter how much they paid. It must be less than the total.");
    }
    setBusy(true);
    try {
      let buyerClientId = buyerChoice?.clientId || null;
      if (!buyerClientId && (buyerChoice?.type || buyerName.trim())) {
        const type = buyerChoice?.type || "other";
        buyerClientId = newClientId();
        await createRecord("buyers", {
          clientId: buyerClientId,
          name: buyerName.trim() || optionFor(BUYER_TYPES, type).text,
          buyerType: type
        });
      }
      const fields = {
        harvestClientId: harvest?.clientId || null,
        ...(!editing && !harvest && fromProduction ? { productionClientId: fromProduction.clientId } : {}),
        buyerClientId,
        saleDate: date,
        crop: saleCrop,
        quantity: qty,
        unit: saleUnit,
        unitPrice: priceMode === "each" ? round(price) : null,
        totalAmount: total,
        currency
      };
      if (editing) {
        await updateRecord(existing, fields);
        toast.success(`The sale changed. ${formatMoney(total, currency)}.`);
        navigate(`/app/money/sales/${existing.clientId}`, { replace: true });
        return;
      }
      const saleClientId = newClientId();
      await createRecord("sales", { clientId: saleClientId, ...fields });
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

  const knownBuyers = records.buyers.slice(0, 8);
  const showBatches = !editing ? batches.length > 0 : false;

  return (
    <div className="space-y-4">
      <PageHeader
        title={editing ? "Change the sale" : WORDS.sell.text}
        subtitle="Tap the pictures and the numbers."
        backTo={editing ? `/app/money/sales/${clientId}` : harvest ? `/app/harvests/${harvest.clientId}` : "/app/money"}
        say={WORDS.sell}
      />
      <ErrorBanner message={error} />

      {showBatches && (
        <Section title={{ text: "From which harvest?", say: "From which harvest? Touch one." }}>
          <div className="grid grid-cols-2 gap-2">
            {batches.map(({ item, status }) => (
              <ChoiceButton
                key={item.clientId}
                words={{ say: `${item.crop}. ${status.remaining} ${unitText(item.unit)} left.` }}
                selected={harvestClientId === item.clientId}
                onClick={() => chooseBatch(item.clientId)}
                className="flex-col gap-1 py-2"
              >
                <CropIcon name={item.crop} size={22} />
                {item.crop}
                <span className="text-xs font-normal">
                  {status.remaining} {unitText(item.unit)} left
                </span>
              </ChoiceButton>
            ))}
          </div>
        </Section>
      )}

      {editing && harvest && (
        <Section>
          <div className="flex items-center gap-3">
            <CropIcon name={harvest.crop} size={24} />
            <p className="text-sm text-ink">
              From the <strong>{harvest.crop}</strong> harvest. {left} {unitText(harvest.unit)} can be in this sale.
            </p>
          </div>
        </Section>
      )}

      {!harvest && (
        <Section title={{ text: "What you sold?", say: "What you sold? Touch the picture." }}>
          {cropChoices.length > 0 ? (
            <PictureGrid items={cropChoices} value={crop} onChange={(value) => setCrop(value || "")} columns={4} />
          ) : (
            <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800">
              Your farms have no crops or animals on them yet. Add what you grow to a farm first.
              <Link to="/app/farms" className={`${buttonClass("primary", "sm")} mt-3`}>
                {WORDS.navFarms.text}
              </Link>
            </div>
          )}
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
                <item.Icon size={22} aria-hidden="true" />
                {item.text}
              </ChoiceButton>
            ))}
          </div>
        )}
      </Section>

      <Section title={WORDS.moneyType}>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((item) => (
            <ChoiceButton key={item.value} words={item} selected={currency === item.value} onClick={() => chooseCurrency(item.value)}>
              <item.Icon size={18} aria-hidden="true" /> {item.value === "USD" ? "US$" : "L$"} · {item.text}
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
            {knownBuyers.map((buyer) => {
              const type = optionFor(BUYER_TYPES, buyer.buyerType) || BUYER_TYPES[BUYER_TYPES.length - 1];
              return (
                <ChoiceButton
                  key={buyer.clientId}
                  words={{ say: buyer.name }}
                  selected={buyerChoice?.clientId === buyer.clientId}
                  onClick={() => setBuyerChoice(buyerChoice?.clientId === buyer.clientId ? null : { clientId: buyer.clientId })}
                  className="justify-start text-left"
                >
                  <type.Icon size={18} aria-hidden="true" /> {buyer.name}
                </ChoiceButton>
              );
            })}
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
        <Link to="/app/money/buyers" className="mt-3 inline-block text-xs font-semibold text-primary">
          See and change my buyers
        </Link>
      </Section>

      {!editing && (
        <Section title={WORDS.didTheyPay}>
          <div className="grid grid-cols-3 gap-2">
            <ChoiceButton words={WORDS.paidAll} selected={paid === "all"} onClick={() => setPaid("all")}>
              <CircleCheck size={16} aria-hidden="true" /> {WORDS.paidAll.text}
            </ChoiceButton>
            <ChoiceButton words={WORDS.paidSome} selected={paid === "some"} onClick={() => setPaid("some")}>
              <SplitSquareHorizontal size={16} aria-hidden="true" /> {WORDS.paidSome.text}
            </ChoiceButton>
            <ChoiceButton words={WORDS.paidNone} selected={paid === "none"} onClick={() => setPaid("none")}>
              <Hourglass size={16} aria-hidden="true" /> {WORDS.paidNone.text}
            </ChoiceButton>
          </div>
          {paid === "some" && (
            <div className="mt-3">
              <p className="label">How much did they pay?</p>
              <MoneyPad value={paidAmount} onChange={setPaidAmount} currency={currency} />
            </div>
          )}
          {paid !== "none" && (
            <div className="mt-3">
              <PictureGrid items={PAYMENT_METHODS} value={method} onChange={(value) => setMethod(value || "cash")} columns={4} />
            </div>
          )}
        </Section>
      )}

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
          <Field label="New buyer name" htmlFor="buyerName" className="mt-4">
            <TextInput id="buyerName" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} maxLength={120} />
          </Field>
        )}
      </Section>

      <Button size="lg" className="w-full text-lg" loading={busy} onClick={save} data-say={WORDS.save.say}>
        <ICONS.sale size={20} aria-hidden="true" /> {WORDS.save.text} {total > 0 ? `· ${formatMoney(total, currency)}` : ""}
      </Button>
    </div>
  );
}
