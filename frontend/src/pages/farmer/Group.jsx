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
import { GRADES, WORDS, growEmoji, unitText } from "../../lib/words.js";

// Farmer groups (cooperatives). Group information comes from the server, so
// the last copy is kept on the phone to show when there is no network.
function cacheKey(userId, name) {
  return `minders.group.${userId}.${name}`;
}
function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function useGroupData(path, key) {
  const { token } = useAuth();
  const { online } = useSync();
  const [data, setData] = useState(() => readCache(key));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!readCache(key));

  const load = useCallback(async () => {
    if (!token || !online) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.get(path, { token });
      setData(result);
      writeCache(key, result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token, online, path, key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, online, token };
}

export default function Group() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload, online, token } = useGroupData("/api/cooperatives/mine", cacheKey(user.id, "mine"));
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!code.trim()) return setJoinError("Put the group code.");
    setBusy(true);
    setJoinError("");
    try {
      const result = await api.post("/api/cooperatives/join", { joinCode: code.trim() }, { token });
      toast.success(result.message);
      setCode("");
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
    <div className="space-y-4">
      <PageHeader title={WORDS.groupTitle.text} subtitle="Your farmer group or cooperative." backTo="/app" say={WORDS.groupTitle} />
      {!online && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" data-say={WORDS.noNetwork.say}>
          Network not there. This is what the phone saved last time.
        </p>
      )}
      <ErrorBanner message={error} />

      {groups.length === 0 ? (
        <EmptyState icon={Users} title={WORDS.noGroup.text} description="Ask your group leader for the group code." />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/app/group/${group.id}`}
              data-say={`${group.name}. ${group.memberCount} people.`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
            >
              <span className="text-4xl" aria-hidden="true">👥</span>
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

      <Section title={WORDS.joinGroup}>
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
        <Button className="mt-3 w-full" loading={busy} disabled={!online} onClick={join} data-say={WORDS.joinGroup.say}>
          {WORDS.joinGroup.text}
        </Button>
        {!online && <p className="mt-2 text-xs text-ink-soft">You need network to join a group.</p>}
      </Section>
    </div>
  );
}

function Totals({ totals, title }) {
  const { money, harvest, grades } = totals;
  const currencies = ["LRD", "USD"].filter((currency) => money.sold[currency] || money.spent[currency]);
  return (
    <Section title={title}>
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
                  <p className="text-2xl" aria-hidden="true">{growEmoji(row.crop)}</p>
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
              <span className="text-sm font-semibold text-ink">💵 {WORDS.sold.text}</span>
              <span className="text-lg font-bold text-success">{formatMoney(money.sold[currency], currency)}</span>
            </div>
          ))}
          {Object.keys(grades).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(grades).map(([grade, count]) => (
                <span
                  key={grade}
                  className="rounded-full bg-canvas px-3 py-1.5 text-sm font-semibold"
                  data-say={`${count} harvest ${GRADES[grade]?.text}.`}
                >
                  {GRADES[grade]?.emoji} {count}
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
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, online } = useGroupData(
    `/api/cooperatives/${groupId}/dashboard`,
    cacheKey(user.id, `dash.${groupId}`)
  );

  if (loading && !data) return <PageLoading label="Opening your group…" />;
  if (!data) {
    return (
      <div>
        <PageHeader title={WORDS.groupTitle.text} backTo="/app/group" />
        <ErrorBanner message={error || "This group is not saved on this phone. Open it when network come."} />
      </div>
    );
  }

  const { cooperative, myRole, leaders, groupTotals, myTotals, members } = data;

  async function shareCode() {
    const text = `Join ${cooperative.name} on Minders. Group code: ${cooperative.joinCode}`;
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
    <div className="space-y-4">
      <PageHeader
        title={cooperative.name}
        subtitle={`${cooperative.memberCount} people · ${cooperative.county}`}
        backTo="/app/group"
        say={{ say: `${cooperative.name}. ${cooperative.memberCount} people in the group.` }}
      />
      {!online && <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800">Saved last time.</p>}

      {leaders.length > 0 && (
        <Section title={{ text: "Group leaders", say: "The group leaders." }}>
          <ul className="space-y-1 text-sm text-ink">
            {leaders.map((leader) => (
              <li key={leader.fullName} data-say={leader.fullName}>
                ⭐ {leader.fullName}
                {leader.community ? ` · ${leader.community}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Totals totals={groupTotals} title={WORDS.groupTotal} />
      <Totals totals={myTotals} title={WORDS.myPart} />

      {myRole === "leader" && cooperative.joinCode && (
        <Section title={WORDS.groupCode}>
          <p className="font-mono text-2xl font-bold tracking-wider text-ink">{cooperative.joinCode}</p>
          <Button variant="secondary" className="mt-3" onClick={shareCode}>
            <Share2 size={16} /> Send the code
          </Button>
        </Section>
      )}

      {myRole === "leader" && members && (
        <Section title={{ text: "The people in the group", say: "The people in the group and what they did." }}>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.farmerId}
                className="rounded-xl bg-canvas px-3 py-2.5"
                data-say={`${member.fullName}. ${member.harvestCount} harvest. ${member.workLast30Days} work this month.`}
              >
                <p className="text-sm font-bold text-ink">
                  {member.role === "leader" ? "⭐ " : ""}
                  {member.fullName}
                </p>
                <p className="text-xs text-ink-soft">
                  {member.community} · {member.farmCount} farms · {member.harvestCount} harvest ·{" "}
                  {member.workLast30Days} work in 30 days
                </p>
                <p className="text-xs font-semibold text-success">
                  Sold {formatMoney(member.sold.LRD, "LRD")}
                  {member.sold.USD ? ` · ${formatMoney(member.sold.USD, "USD")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
