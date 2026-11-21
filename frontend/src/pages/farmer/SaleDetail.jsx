import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DateChoice, MoneyPad, PictureGrid, Section } from "../../components/Choices.jsx";
import { Button, ConfirmDialog, ErrorBanner, PageHeader, PageLoading, StatusChip } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate, newClientId, todayInputValue } from "../../lib/format.js";
import { formatMoney, paymentsForSale, saleStatus, sayMoney } from "../../lib/ledger.js";
import { BUYER_TYPES, PAYMENT_METHODS, WORDS, growEmoji, optionFor, unitText } from "../../lib/words.js";

export default function SaleDetail() {
  const { clientId } = useParams();
  const { records, loading } = useFarmerData();
  const { createRecord, deleteRecord } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayInputValue());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sale = records.sales.find((item) => item.clientId === clientId);
  if (!sale) return loading ? <PageLoading label="Opening…" /> : <PageHeader title="Sale not found" backTo="/app/money" />;

  const status = saleStatus(sale, records.payments);
  const payments = paymentsForSale(sale, records.payments);
  const buyer = records.buyers.find((item) => item.clientId === sale.buyerClientId);
  const harvest = records.harvests.find((item) => item.clientId === sale.harvestClientId);
  const summary = `You sold ${sale.quantity} ${unitText(sale.unit)} ${sale.crop} for ${sayMoney(sale.totalAmount, sale.currency)}. ${
    status.owed > 0 ? `They still owe ${sayMoney(status.owed, sale.currency)}.` : "They pay all."
  }`;

  async function addPayment() {
    const value = Number(amount || 0);
    if (value <= 0) return setError("Put the money they pay with the numbers.");
    if (value > status.owed) return setError(`They only owe ${formatMoney(status.owed, sale.currency)}.`);
    setBusy(true);
    try {
      await createRecord("payments", {
        clientId: newClientId(),
        saleClientId: sale.clientId,
        amount: value,
        paidDate: date,
        method
      });
      toast.success(`They pay ${formatMoney(value, sale.currency)}.`);
      setAdding(false);
      setAmount("");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    for (const payment of payments) await deleteRecord(payment);
    await deleteRecord(sale);
    toast.success("The sale is deleted.");
    navigate("/app/money", { replace: true });
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`${sale.crop} sale`} subtitle={formatDate(sale.saleDate)} backTo="/app/money" say={{ say: summary }} />

      <Section>
        <div className="flex items-center gap-4">
          <span className="text-5xl" aria-hidden="true">{growEmoji(sale.crop)}</span>
          <div className="flex-1">
            <p className="text-lg font-bold text-ink">
              {sale.quantity} {unitText(sale.unit)} {sale.crop}
            </p>
            <p className="text-2xl font-bold text-success">{formatMoney(sale.totalAmount, sale.currency)}</p>
            {sale.unitPrice ? (
              <p className="text-xs text-ink-soft">{formatMoney(sale.unitPrice, sale.currency)} each</p>
            ) : null}
          </div>
          {sale.syncStatus && <StatusChip status={sale.syncStatus} />}
        </div>
        {buyer && (
          <p className="mt-3 text-sm text-ink" data-say={`Buyer: ${buyer.name}.`}>
            {optionFor(BUYER_TYPES, buyer.buyerType)?.emoji} {buyer.name}
          </p>
        )}
        {harvest && (
          <Link to={`/app/harvests/${harvest.clientId}`} className="mt-2 block text-sm font-semibold text-primary">
            From the harvest of {formatDate(harvest.harvestDate)}
          </Link>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-success/10 p-3" data-say={`${WORDS.received.say} ${sayMoney(status.paid, sale.currency)}.`}>
            <p className="text-xs text-ink-soft">{WORDS.received.text}</p>
            <p className="text-lg font-bold text-success">{formatMoney(status.paid, sale.currency)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3" data-say={`${WORDS.owed.say} ${sayMoney(status.owed, sale.currency)}.`}>
            <p className="text-xs text-ink-soft">{WORDS.owed.text}</p>
            <p className="text-lg font-bold text-amber-800">{formatMoney(status.owed, sale.currency)}</p>
          </div>
        </div>
      </Section>

      {payments.length > 0 && (
        <Section title={{ text: "Money they pay", say: "The money they pay you." }}>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.clientId} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
                <span>
                  {optionFor(PAYMENT_METHODS, payment.method)?.emoji} {formatDate(payment.paidDate)}
                </span>
                <span className="font-bold">{formatMoney(payment.amount, sale.currency)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {status.owed > 0 &&
        (adding ? (
          <Section title={WORDS.addPayment}>
            <ErrorBanner message={error} />
            <MoneyPad value={amount} onChange={setAmount} currency={sale.currency} />
            <div className="mt-3">
              <PictureGrid items={PAYMENT_METHODS} value={method} onChange={(value) => setMethod(value || "cash")} columns={4} />
            </div>
            <div className="mt-3">
              <DateChoice value={date} onChange={setDate} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>
                Back
              </Button>
              <Button className="flex-1" loading={busy} onClick={addPayment} data-say={WORDS.save.say}>
                {WORDS.save.text}
              </Button>
            </div>
          </Section>
        ) : (
          <Button size="lg" className="w-full text-lg" onClick={() => setAdding(true)} data-say={WORDS.addPayment.say}>
            💰 {WORDS.addPayment.text}
          </Button>
        ))}

      <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
        <Trash2 size={16} /> Delete this sale
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this sale?"
        message="The sale and the money paid for it will be deleted."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
