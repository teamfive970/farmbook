import { CheckCircle2, Eye, Megaphone, MessageSquareText, Send, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorBanner, Field, PageLoading, Select, TextInput, Textarea } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { COUNTIES } from "../../lib/labels.js";

const TITLE_MAX = 80;
const BODY_MAX = 500;
const SMS_SIZE = 160;

function when(value) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
}

function smsLine(sms) {
  if (sms.status === "none") return "App only";
  if (sms.status === "unavailable") return "SMS not set up: app only";
  if (sms.status === "sending") return "SMS sending…";
  const parts = [`${sms.sent} SMS sent`];
  if (sms.failed) parts.push(`${sms.failed} failed`);
  if (sms.skipped) parts.push(`${sms.skipped} chose app only`);
  return parts.join(" · ");
}

// Announcements: one message to every farmer, one county or one group. It goes
// to each farmer's Messages inbox and, if chosen, by SMS to farmers who allow it.
export default function AdminAnnouncements() {
  const { token } = useAuth();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [coops, setCoops] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", body: "", type: "all", value: "", sendSms: false });
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [announcements, cooperatives] = await Promise.all([
        api.get("/api/admin/announcements", { token }),
        api.get("/api/admin/cooperatives", { token }).catch(() => ({ items: [] }))
      ]);
      setList(announcements);
      setCoops((cooperatives.items || []).filter((item) => item.status !== "inactive"));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the history fresh while SMS are still going out.
  useEffect(() => {
    if (!list?.announcements?.some((item) => item.sms.status === "sending")) return undefined;
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [list, load]);

  const audienceReady = form.type === "all" || Boolean(form.value);
  useEffect(() => {
    setConfirming(false);
    if (!audienceReady) {
      setPreview(null);
      return undefined;
    }
    let active = true;
    const params = new URLSearchParams({ type: form.type });
    if (form.type !== "all") params.set("value", form.value);
    api
      .get(`/api/admin/announcements/audience?${params.toString()}`, { token })
      .then((result) => active && setPreview(result))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [form.type, form.value, audienceReady, token]);

  const set = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value, ...(field === "type" ? { value: "" } : {}) }));
  };

  const smsLength = `FarmBok: ${form.title.trim()}. ${form.body.trim()}`.length;
  const valid = form.title.trim().length >= 3 && form.body.trim().length >= 3 && audienceReady;

  async function send(event) {
    event.preventDefault();
    if (!valid) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSending(true);
    try {
      const result = await api.post(
        "/api/admin/announcements",
        {
          title: form.title.trim(),
          body: form.body.trim(),
          audience: { type: form.type, value: form.type === "all" ? undefined : form.value },
          sendSms: form.sendSms
        },
        { token }
      );
      toast.success(result.message);
      setForm({ title: "", body: "", type: form.type, value: form.value, sendSms: false });
      setConfirming(false);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  if (!list && !error) return <PageLoading label="Loading announcements…" />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Announcements</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Send a message to every farmer, one county or one group. It appears in their Messages, and by SMS for
          farmers who allow it. Every announcement is written to the audit log.
        </p>
      </div>
      <ErrorBanner message={error} className="mb-4" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <Card as="form" onSubmit={send} className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <Megaphone size={18} className="text-primary" aria-hidden="true" /> New announcement
          </h2>
          <Field
            label="Title"
            htmlFor="ann-title"
            hint={`${form.title.length}/${TITLE_MAX} · short and clear, e.g. "Free seed fair in Gbarnga"`}
          >
            <TextInput id="ann-title" maxLength={TITLE_MAX} value={form.title} onChange={set("title")} required />
          </Field>
          <Field label="Message" htmlFor="ann-body" hint={`${form.body.length}/${BODY_MAX} · use simple words`}>
            <Textarea id="ann-body" rows={4} maxLength={BODY_MAX} value={form.body} onChange={set("body")} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Send to" htmlFor="ann-type">
              <Select id="ann-type" value={form.type} onChange={set("type")}>
                <option value="all">All farmers</option>
                <option value="county">One county</option>
                <option value="cooperative">One group (cooperative)</option>
              </Select>
            </Field>
            {form.type === "county" && (
              <Field label="County" htmlFor="ann-county">
                <Select id="ann-county" value={form.value} onChange={set("value")} required>
                  <option value="">Choose a county</option>
                  {COUNTIES.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {form.type === "cooperative" && (
              <Field label="Group" htmlFor="ann-coop">
                <Select id="ann-coop" value={form.value} onChange={set("value")} required>
                  <option value="">Choose a group</option>
                  {coops.map((coop) => (
                    <option key={coop.id} value={coop.id}>
                      {coop.name} ({coop.county})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={form.sendSms} onChange={set("sendSms")} />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <MessageSquareText size={16} aria-hidden="true" /> Also send by SMS
              </span>
              <span className="mt-0.5 block text-ink-soft">
                {list?.smsAvailable
                  ? `Only to farmers who allow SMS. ${smsLength > SMS_SIZE ? `About ${Math.ceil(Math.min(smsLength, 320) / 153)} SMS each (long message).` : "1 SMS each."}`
                  : "SMS is not set up on this server, so the message will go in the app only."}
              </span>
            </span>
          </label>

          {preview && (
            <p className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm font-semibold text-primary-dark">
              <Users size={16} aria-hidden="true" />
              Reaches {preview.farmers} {preview.farmers === 1 ? "farmer" : "farmers"}
              {preview.audience.type === "all" ? " (all active farmers)" : ` in ${preview.audience.label}`}
              {form.sendSms && list?.smsAvailable ? ` · ${preview.smsFarmers} by SMS` : ""}
            </p>
          )}

          {confirming && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900">
              Check the message: it cannot be taken back once sent. Press Send again to confirm.
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={sending} disabled={!valid || preview?.farmers === 0}>
            <Send size={18} aria-hidden="true" /> {confirming ? "Send now" : "Send"}
          </Button>
        </Card>

        <section>
          <h2 className="mb-3 text-base font-bold text-ink">Sent</h2>
          {list?.announcements?.length ? (
            <ul className="space-y-3">
              {list.announcements.map((item) => (
                <li key={item.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-ink">{item.title}</h3>
                      <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                        {item.audience.label}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{item.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <Users size={14} aria-hidden="true" /> {item.recipients} farmers
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={14} aria-hidden="true" /> {item.readCount} read
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {item.sms.status === "done" ? (
                          <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
                        ) : (
                          <MessageSquareText size={14} aria-hidden="true" />
                        )}
                        {smsLine(item.sms)}
                      </span>
                      <span>
                        {when(item.createdAt)}
                        {item.sentBy ? ` · ${item.sentBy}` : ""}
                      </span>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Megaphone} title="No announcements yet" description="Messages you send will be listed here with how many farmers read them." />
          )}
        </section>
      </div>
    </div>
  );
}
