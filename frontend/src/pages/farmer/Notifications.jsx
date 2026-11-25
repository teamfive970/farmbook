import {
  Bell,
  CheckCheck,
  CloudRainWind,
  ChevronRight,
  ClipboardList,
  Handshake,
  Megaphone,
  MessageSquareText,
  QrCode,
  Sprout,
  Users,
  Wallet,
  WifiOff
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SpeakButton } from "../../components/Voice.jsx";
import { Button, EmptyState, ErrorBanner, PageHeader, PageLoading } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useNotifications } from "../../contexts/NotificationContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { markInboxRead, readInbox, writeInbox } from "../../lib/notificationCache.js";
import { WORDS } from "../../lib/words.js";

// A picture and colour for each kind of message, so a farmer who reads
// little can tell news from a reminder at a glance.
const LOOK = {
  announcement: { Icon: Megaphone, tone: "bg-sky-100 text-sky-700", label: "News" },
  no_work: { Icon: ClipboardList, tone: "bg-amber-100 text-amber-700", label: "Reminder" },
  money_owed: { Icon: Wallet, tone: "bg-rose-100 text-rose-700", label: "Money" },
  passport: { Icon: QrCode, tone: "bg-primary-soft text-primary-dark", label: "Harvest Passport" },
  group_joined: { Icon: Users, tone: "bg-violet-100 text-violet-700", label: "My group" },
  buyer_request: { Icon: Handshake, tone: "bg-emerald-100 text-emerald-800", label: "Buyer" },
  weather: { Icon: CloudRainWind, tone: "bg-sky-100 text-sky-800", label: "Weather" },
  welcome: { Icon: Sprout, tone: "bg-primary-soft text-primary-dark", label: "FarmBok" }
};

function lookFor(item) {
  return LOOK[item.topic] || LOOK[item.kind] || { Icon: Bell, tone: "bg-slate-100 text-slate-700", label: "Message" };
}

function whenText(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return formatDate(value);
}

function MessageCard({ item, onOpen }) {
  const { Icon, tone, label } = lookFor(item);
  const unread = !item.readAt;
  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-card transition ${
        unread ? "border-primary/40" : "border-transparent"
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true">
        <Icon size={22} />
      </span>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 text-left"
        data-say={`${item.title}. ${item.body}`}
      >
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {unread && <span className="h-2 w-2 rounded-full bg-primary" aria-label="New" />}
          {label} · {whenText(item.createdAt)}
        </span>
        <span className={`mt-1 block text-[15px] leading-snug text-ink ${unread ? "font-bold" : "font-semibold"}`}>
          {item.title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{item.body}</span>
        {item.link && (
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">
            Open <ChevronRight size={16} aria-hidden="true" />
          </span>
        )}
      </button>
      <SpeakButton phrase={{ say: `${item.title}. ${item.body}` }} />
    </li>
  );
}

function SmsSwitch({ on, busy, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      data-say={WORDS.messagesSms.say}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card disabled:opacity-60"
    >
      <MessageSquareText size={22} className="shrink-0 text-ink-soft" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{WORDS.messagesSms.text}</span>
        <span className="block text-xs text-ink-soft">News from the Ministry and your group. Reminders stay in the app.</span>
      </span>
      <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-line"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

// "Messages": news from the Ministry and the farmer's group, reminders worked
// out from their own records, and app messages. The last copy is kept on the
// phone, so it opens without network.
export default function Notifications() {
  const { user, token } = useAuth();
  const { online } = useSync();
  const { setUnread } = useNotifications();
  const navigate = useNavigate();
  const [inbox, setInbox] = useState(() => readInbox(user?.id));
  const [loading, setLoading] = useState(!inbox);
  const [error, setError] = useState("");
  const [savingSms, setSavingSms] = useState(false);
  const canAsk = Boolean(online && token && !user?.pendingRegistration);

  const save = useCallback(
    (next) => {
      setInbox(next);
      writeInbox(user?.id, next);
      setUnread(next?.unreadCount || 0);
    },
    [user?.id, setUnread]
  );

  const load = useCallback(async () => {
    if (!canAsk) {
      setLoading(false);
      return;
    }
    try {
      save(await api.get("/api/notifications", { token }));
      setError("");
    } catch (requestError) {
      setError(requestError.isNetworkError ? "" : requestError.message);
    } finally {
      setLoading(false);
    }
  }, [canAsk, token, save]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(item) {
    if (!item.readAt) {
      save(markInboxRead(inbox, item.id));
      if (canAsk) api.post(`/api/notifications/${item.id}/read`, undefined, { token }).catch(() => {});
    }
    if (item.link) navigate(item.link);
  }

  async function readAll() {
    save(markInboxRead(inbox));
    if (canAsk) await api.post("/api/notifications/read-all", undefined, { token }).catch(() => {});
  }

  async function changeSms(on) {
    setSavingSms(true);
    try {
      const result = await api.patch("/api/notifications/settings", { sms: on }, { token });
      save({ ...inbox, settings: result.settings });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingSms(false);
    }
  }

  if (loading) return <PageLoading label="Opening your messages…" />;

  const items = inbox?.notifications || [];
  const fresh = items.filter((item) => !item.readAt);
  const earlier = items.filter((item) => item.readAt);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={WORDS.messagesTitle.text}
        subtitle="From the Ministry, your group and FarmBok."
        say={WORDS.messagesTitle}
        action={
          fresh.length > 0 && (
            <Button variant="ghost" size="sm" onClick={readAll} data-say={WORDS.messagesAllRead.say}>
              <CheckCheck size={16} aria-hidden="true" />
              <span className="sm:hidden">Read all</span>
              <span className="hidden sm:inline">{WORDS.messagesAllRead.text}</span>
            </Button>
          )
        }
      />

      {!canAsk && (
        <p
          className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700"
          data-say={WORDS.messagesOffline.say}
        >
          <WifiOff size={18} aria-hidden="true" /> {WORDS.messagesOffline.text}
        </p>
      )}
      <ErrorBanner message={error} />

      {items.length === 0 ? (
        <EmptyState icon={Bell} title={WORDS.messagesNone.text} description="News and reminders will show here." />
      ) : (
        <>
          {fresh.length > 0 && (
            <section>
              <h2 className="label" data-say={WORDS.messagesNew.say}>
                {WORDS.messagesNew.text} ({fresh.length})
              </h2>
              <ul className="space-y-2">
                {fresh.map((item) => (
                  <MessageCard key={item.id} item={item} onOpen={open} />
                ))}
              </ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <h2 className="label" data-say={WORDS.messagesEarlier.say}>
                {WORDS.messagesEarlier.text}
              </h2>
              <ul className="space-y-2">
                {earlier.map((item) => (
                  <MessageCard key={item.id} item={item} onOpen={open} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {canAsk && inbox?.settings && (
        <SmsSwitch on={inbox.settings.sms} busy={savingSms} onChange={changeSms} />
      )}
    </div>
  );
}
