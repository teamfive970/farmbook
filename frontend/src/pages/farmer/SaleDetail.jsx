import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CropIcon, DateChoice, MoneyPad, PictureGrid, Section } from "../../components/Choices.jsx";
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  PageHeader,
  PageLoading,
  StatusChip,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate, newClientId, todayInputValue } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { formatMoney, paymentsForSale, saleStatus, sayMoney } from "../../lib/ledger.js";
import { BUYER_TYPES, PAYMENT_METHODS, WORDS, optionFor, unitText } from "../../lib/words.js";

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
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const sale = records.sales.find((item) => item.clientId === clientId);
  if (!sale) return loading ? <PageLoading label="Opening…" /> : <PageHeader title="Sale not found" backTo="/app/money" />;

  const status = saleStatus(sale, records.payments);
  const payments = paymentsForSale(sale, records.payments).sort((a, b) =>
    String(b.paidDate).localeCompare(String(a.paidDate))
  );
  const buyer = records.buyers.find((item) => item.clientId === sale.buyerClientId);
  const buyerType = buyer ? optionFor(BUYER_TYPES, buyer.buyerType) || BUYER_TYPES[BUYER_TYPES.length - 1] : null;
  const harvest = records.harvests.find((item) => item.clientId === sale.harvestClientId);
  const summary = `You sold ${sale.quantity} ${unitText(sale.unit)} ${sale.crop} for ${sayMoney(sale.totalAmount, sale.currency)}. ${
    status.owed > 0 ? `${sayMoney(status.owed, sale.currency)} still to pay.` : "Paid in full."
  }`;

  async function addPayment() {
    const value = Math.round(Number(amount || 0) * 100) / 100;
    if (value <= 0) return setError("Enter the amount they paid.");
    if (value > status.owed) return setError(`Only ${formatMoney(status.owed, sale.currency)} is still to pay.`);
    setBusy(true);
    try {
      await createRecord("payments", {
        clientId: newClientId(),
        saleClientId: sale.clientId,
        amount: value,
        paidDate: date,
        method
      });
      toast.success(`Payment of ${formatMoney(value, sale.currency)} added.`);
      setAdding(false);
      setAmount("");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removePayment() {
    const payment = paymentToDelete;
    setPaymentToDelete(null);
    try {
      await deleteRecord(payment);
      toast.success(`The payment of ${formatMoney(payment.amount, sale.currency)} is taken off.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    // The server takes the payments off with the sale; the phone does the same.
    for (const payment of payments) await deleteRecord(payment);
    await deleteRecord(sale);
    toast.success("The sale is deleted.");
    navigate("/app/money", { replace: true });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${sale.crop} sale`}
        subtitle={formatDate(sale.saleDate)}
        backTo="/app/money"
        say={{ say: summary }}
        action={
          <Link to={`/app/money/sales/${sale.clientId}/edit`} className={buttonClass("secondary", "sm")} data-say="Change it">
            <Pencil size={14} /> Change
          </Link>
        }
      />
      <ErrorBanner message={error} />

      <Section>
        <div className="flex items-center gap-4">
          <CropIcon name={sale.crop} size={36} />
          <div className="flex-1">
            <p className="text-lg font-bold text-ink">
              {sale.quantity} {unitText(sale.unit)} {sale.crop}
            </p>
            <p className="text-2xl font-bold text-ink">{formatMoney(sale.totalAmount, sale.currency)}</p>
            {sale.unitPrice ? (
              <p className="text-xs text-ink-soft">{formatMoney(sale.unitPrice, sale.currency)} each</p>
            ) : null}
          </div>
          {sale.syncStatus && <StatusChip status={sale.syncStatus} />}
        </div>
        {buyer && (
          <Link
            to={`/app/money/buyers/${buyer.clientId}`}
            className="mt-3 flex items-center gap-2 text-sm text-ink"
            data-say={`Buyer: ${buyer.name}.`}
          >
            <buyerType.Icon size={18} className="text-ink-soft" aria-hidden="true" /> {buyer.name}
          </Link>
        )}
        {harvest && (
          <Link to={`/app/harvests/${harvest.clientId}`} className="mt-2 block text-sm font-semibold text-primary">
            From the harvest of {formatDate(harvest.harvestDate)}
          </Link>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-success/10 p-3" data-say={`${WORDS.received.say} ${sayMoney(status.paid, sale.currency)}.`}>
            <p className="flex items-center justify-center gap-1 text-xs text-ink-soft">
              <ICONS.income size={14} aria-hidden="true" /> {WORDS.received.text}
            </p>
            <p className="text-lg font-bold text-success">{formatMoney(status.paid, sale.currency)}</p>
          </div>
          <div className="rounded-xl bg-canvas p-3" data-say={`${sayMoney(status.owed, sale.currency)} still to pay.`}>
            <p className="text-xs text-ink-soft">Still to pay</p>
            <p className="text-lg font-bold text-ink">{formatMoney(status.owed, sale.currency)}</p>
          </div>
        </div>
      </Section>

      {payments.length > 0 && (
        <Section title={{ text: "Money they pay", say: "The money they pay you. Touch the bin to take one off." }}>
          <div className="space-y-2">
            {payments.map((payment) => {
              const way = optionFor(PAYMENT_METHODS, payment.method) || PAYMENT_METHODS[0];
              return (
                <div key={payment.clientId} className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
                  <way.Icon size={18} className="text-ink-soft" aria-hidden="true" />
                  <span className="flex-1">
                    {formatDate(payment.paidDate)}
                    <span className="block text-xs text-ink-soft">{way.text}</span>
                  </span>
                  <span className="font-bold">{formatMoney(payment.amount, sale.currency)}</span>
                  {payment.syncStatus && payment.syncStatus !== "synced" && <StatusChip status={payment.syncStatus} showLabel={false} />}
                  <button
                    type="button"
                    onClick={() => setPaymentToDelete(payment)}
                    aria-label={`Take off the payment of ${formatMoney(payment.amount, sale.currency)}`}
                    data-say="Take this payment off."
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {status.owed > 0 &&
        (adding ? (
          <Section title={WORDS.addPayment}>
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
            <ICONS.income size={20} aria-hidden="true" /> {WORDS.addPayment.text}
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
      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        title="Take this payment off?"
        message={
          paymentToDelete
            ? `${formatMoney(paymentToDelete.amount, sale.currency)} on ${formatDate(paymentToDelete.paidDate)} will be taken off. Use this if it was put by mistake.`
            : ""
        }
        confirmLabel="Take it off"
        onConfirm={removePayment}
        onCancel={() => setPaymentToDelete(null)}
      />
    </div>
  );
}
