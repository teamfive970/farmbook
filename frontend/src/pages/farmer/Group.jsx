import { ChevronRight, Share2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Section } from "../../components/Choices.jsx";
import { Button, EmptyState, ErrorBanner, PageHeader, PageLoading, TextInput } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { formatMoney, sayMoney } from "../../lib/ledger.js";
import { CropIcon, GradeBadge } from "../../components/Choices.jsx";
import {
  dashboardName,
  dropGroupCache,
  forgetGroupOnError,
  readGroupCache,
  reconcileGroupCaches,
  writeGroupCache
} from "../../lib/groupCache.js";
import { ICONS } from "../../lib/icons.js";
import { GRADES, WORDS, unitText } from "../../lib/words.js";

// Farmer groups (cooperatives). Group information comes from the server, so
// the last copy is kept on the phone (lib/groupCache.js) to show when there is
// no network, and thrown away when it can no longer be right.
function useGroupData(path, name, { groupId = null } = {}) {
  const { token, user } = useAuth();
  const { online } = useSync();
  const [data, setData] = useState(() => readGroupCache(user.id, name));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !readGroupCache(user.id, name));

  const load = useCallback(async () => {
    if (!token || !online) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.get(path, { token });
      setData(result);
      writeGroupCache(user.id, name, result);
      if (name === "mine") reconcileGroupCaches(user.id, result);
      setError("");
    } catch (requestError) {
      if (groupId && forgetGroupOnError(user.id, groupId, requestError)) {
        setData(null);
        setError("You are not in this group any more.");
      } else {
        setError(requestError.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, online, path, name, groupId, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, online, token, user };
}

export default function Group() {
  const toast = useToast();
  const { data, error, loading, reload, online, token, user } = useGroupData("/api/cooperatives/mine", "mine");
  const [code, setCode] = useState("");
  const [agree, setAgree] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(false);
  const pendingAccount = Boolean(user.pendingRegistration);

  async function join() {
    if (pendingAccount) return setJoinError("Send your account first, then you can join a group.");
    if (!code.trim()) return setJoinError("Enter the group code.");
    if (!agree) return setJoinError("Tick the box to agree before joining.");
    setBusy(true);
    setJoinError("");
    try {
      const result = await api.post(
        "/api/cooperatives/join",
        { joinCode: code.trim(), consent: true },
        { token }
      );
      toast.success(result.message);
      setCode("");
      setAgree(false);
      // The saved list is out of date now.
      dropGroupCache(user.id, "mine");
      reload();
    } catch (requestError) {
      setJoinError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <PageLoading label="Opening your group…" />;
  const groups = data?.items || [];

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4 lg:space-y-0">
      <PageHeader className="lg:col-span-12" title={WORDS.groupTitle.text} subtitle="Your farmer group or cooperative." backTo="/app" say={WORDS.groupTitle} />
      {!online && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800 lg:col-span-12" data-say={WORDS.noNetwork.say}>
          Network not there. This is what the phone saved last time.
        </p>
      )}
      <ErrorBanner message={error} className="lg:col-span-12" />

      {groups.length === 0 ? (
        <EmptyState className="lg:col-span-7" icon={Users} title={WORDS.noGroup.text} description="Ask your group leader for the group code." />
      ) : (
        <div className="space-y-3 lg:col-span-7">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/app/group/${group.id}`}
              data-say={`${group.name}. ${group.memberCount} people.`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-800">
                <ICONS.group size={26} aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="text-base font-bold text-ink">{group.name}</p>
                <p className="text-xs text-ink-soft">
                  {group.memberCount} people · {group.county}
                  {group.myRole === "leader" ? " · You are a leader" : ""}
                </p>
              </div>
              <ChevronRight size={18} className="text-ink-soft" />
            </Link>
          ))}
        </div>
      )}

      <Section title={WORDS.joinGroup} className="lg:col-span-5">
        <ErrorBanner message={joinError} />
        <TextInput
          aria-label={WORDS.groupCode.text}
          placeholder="GRP-XXXXXX"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          autoCapitalize="characters"
          className="mt-2 font-mono text-lg tracking-wider"
          maxLength={20}
        />
        <label className="mt-3 flex items-start gap-2 rounded-xl bg-canvas p-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            Group leaders can see my total sales. The group total always includes every member,
            but my own figures stay hidden unless I agree. I can stop sharing later.
          </span>
        </label>
        <Button
          className="mt-3 w-full"
          loading={busy}
          disabled={!online || !agree || pendingAccount}
          onClick={join}
          data-say={WORDS.joinGroup.say}
        >
          {WORDS.joinGroup.text}
        </Button>
        {pendingAccount ? (
          <p className="mt-2 text-xs text-ink-soft">
            Send your account first. Open <span className="font-semibold">Me</span> and send it
            with your PIN, then you can join a group.
          </p>
        ) : (
          !online && <p className="mt-2 text-xs text-ink-soft">You need network to join a group.</p>
        )}
      </Section>
    </div>
  );
}

function Totals({ totals, title, className = "" }) {
  const { money, harvest, grades } = totals;
  const currencies = ["LRD", "USD"].filter((currency) => money.sold[currency] || money.spent[currency]);
  return (
    <Section title={title} className={className}>
      {harvest.length === 0 && currencies.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing yet.</p>
      ) : (
        <div className="space-y-3">
          {harvest.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {harvest.map((row) => (
                <div
                  key={`${row.crop}-${row.unit}`}
                  className="rounded-xl bg-canvas p-3"
                  data-say={`${row.quantity} ${unitText(row.unit)} ${row.crop}.`}
                >
                  <CropIcon name={row.crop} size={20} />
                  <p className="text-sm font-bold text-ink">
                    {row.quantity} {unitText(row.unit)}
                  </p>
                  <p className="text-xs text-ink-soft">{row.crop}</p>
                </div>
              ))}
            </div>
          )}
          {currencies.map((currency) => (
            <div
              key={currency}
              className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2.5"
              data-say={`${WORDS.sold.say} ${sayMoney(money.sold[currency], currency)}.`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ICONS.sale size={18} aria-hidden="true" /> {WORDS.totalSales.text}
              </span>
              <span className="text-lg font-bold text-success">{formatMoney(money.sold[currency], currency)}</span>
            </div>
          ))}
          {Object.keys(grades).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(grades).map(([grade, count]) => (
                <span
                  key={grade}
                  className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1 text-sm font-semibold"
                  data-say={`${count} harvest ${GRADES[grade]?.text}.`}
                >
                  <GradeBadge grade={grade} words={GRADES[grade]} /> × {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

export function GroupDashboard() {
  const { groupId } = useParams();
  const toast = useToast();
  const { data, error, loading, online, reload, token } = useGroupData(
    `/api/cooperatives/${groupId}/dashboard`,
    dashboardName(groupId),
    { groupId }
  );
  const [consentBusy, setConsentBusy] = useState(false);

  if (loading && !data) return <PageLoading label="Opening your group…" />;
  if (!data) {
    return (
      <div>
        <PageHeader title={WORDS.groupTitle.text} backTo="/app/group" />
        <ErrorBanner message={error || "This group is not saved on this phone. Open it when you are online."} />
      </div>
    );
  }

  const { cooperative, myRole, myConsent, leaders, groupTotals, myTotals, members } = data;

  async function changeConsent() {
    setConsentBusy(true);
    try {
      const result = await api.post(
        `/api/cooperatives/${groupId}/consent`,
        { consent: !myConsent },
        { token }
      );
      toast.success(result.message);
      await reload();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setConsentBusy(false);
    }
  }

  async function shareCode() {
    const text = `Join ${cooperative.name} on FarmBok. Group code: ${cooperative.joinCode}`;
    try {
      if (navigator.share) await navigator.share({ title: cooperative.name, text });
      else {
        await navigator.clipboard.writeText(cooperative.joinCode);
        toast.success("The code is copied.");
      }
    } catch {
      // closed
    }
  }

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4 lg:space-y-0">
      <PageHeader
        className="lg:col-span-12"
        title={cooperative.name}
        subtitle={`${cooperative.memberCount} people · ${cooperative.county}`}
        backTo="/app/group"
        say={{ say: `${cooperative.name}. ${cooperative.memberCount} people in the group.` }}
      />
      {!online && <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800 lg:col-span-12">Saved last time.</p>}

      {leaders.length > 0 && (
        <Section title={{ text: "Group leaders", say: "The group leaders." }} className="lg:col-span-12">
          <ul className="space-y-1 text-sm text-ink">
            {leaders.map((leader) => (
              <li key={leader.fullName} data-say={leader.fullName}>
                <ICONS.leader size={14} className="mr-1 inline text-amber-500" aria-hidden="true" />
                {leader.fullName}
                {leader.community ? ` · ${leader.community}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Totals totals={groupTotals} title={WORDS.groupTotal} className="lg:col-span-6" />
      <Totals totals={myTotals} title={WORDS.myPart} className="lg:col-span-6" />

      <Section title={{ text: "What leaders can see", say: "What group leaders can see." }} className="lg:col-span-6">
        <p className="text-sm text-ink-soft">
          {myConsent
            ? "You agreed to share your total sales with group leaders. Your daily records and notes are still private."
            : "Your totals are private. Leaders see the group total but not what you sold."}
        </p>
        <Button variant="secondary" className="mt-3" loading={consentBusy} onClick={changeConsent}>
          {myConsent ? "Stop sharing my totals" : "Share my totals with leaders"}
        </Button>
      </Section>

      {myRole === "leader" && cooperative.joinCode && (
        <Section title={WORDS.groupCode} className="lg:col-span-6">
          <p className="font-mono text-2xl font-bold tracking-wider text-ink">{cooperative.joinCode}</p>
          <Button variant="secondary" className="mt-3" onClick={shareCode}>
            <Share2 size={16} /> Send the code
          </Button>
        </Section>
      )}

      {myRole === "leader" && members && (
        <Section title={{ text: "The people in the group", say: "The people in the group." }} className="lg:col-span-12">
          <p className="mb-2 text-sm text-ink-soft">
            You only see the totals of people who agreed to share them. Their records and notes
            stay private.
          </p>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {members.map((member) => (
              <div
                key={member.farmerId}
                className="rounded-xl bg-canvas px-3 py-2.5"
                data-say={
                  member.sharesTotals
                    ? `${member.fullName}. Shares totals.`
                    : `${member.fullName}. Totals are private.`
                }
              >
                <p className="text-sm font-bold text-ink">
                  {member.role === "leader" ? <ICONS.leader size={14} className="mr-1 inline text-amber-500" aria-hidden="true" /> : null}
                  {member.fullName}
                </p>
                <p className="text-xs text-ink-soft">
                  {member.community ? `${member.community} · ` : ""}
                  {member.sharesTotals ? "Shares totals" : "Totals private"}
                </p>
                {member.sold && (
                  <p className="text-xs font-semibold text-success">
                    Sold {formatMoney(member.sold.LRD, "LRD")}
                    {member.sold.USD ? ` · ${formatMoney(member.sold.USD, "USD")}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
