import { ChevronDown, ChevronUp, PencilLine } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChoiceButton, DateChoice, QuantityStepper, Section } from "../../components/Choices.jsx";
import { Button, ErrorBanner, Field, PageHeader, PageLoading, TextInput, Textarea } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { GRADES, QUALITY_CHECKS, WORDS, growEmoji, suggestGrade } from "../../lib/words.js";

// Quality check by looking and smelling: yes/no for each picture. The grade is
// suggested from the answers (all yes = A) and can be changed.
export default function InspectionForm() {
  const { clientId } = useParams();
  const { records, loading } = useFarmerData();
  const { createRecord, online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const [checks, setChecks] = useState({});
  const [grade, setGrade] = useState(null);
  const [date, setDate] = useState(todayInputValue());
  const [moisture, setMoisture] = useState("");
  const [inspector, setInspector] = useState("");
  const [notes, setNotes] = useState("");
  const [showWrite, setShowWrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const harvest = records.harvests.find((item) => item.clientId === clientId);
  if (!harvest) return loading ? <PageLoading label="Opening…" /> : <PageHeader title="Harvest not found" backTo="/app/harvests" />;

  const suggested = suggestGrade(checks);
  const chosenGrade = grade || suggested;

  function answer(key, value) {
    setChecks((current) => ({ ...current, [key]: value }));
    setGrade(null);
  }

  async function save() {
    const answered = QUALITY_CHECKS.filter((item) => checks[item.value] !== undefined).length;
    if (answered === 0) return setError("Touch yes or no for at least one check.");
    setBusy(true);
    try {
      await createRecord("inspections", {
        clientId: newClientId(),
        harvestClientId: harvest.clientId,
        inspectionDate: date,
        grade: chosenGrade,
        checks,
        moisturePercent: moisture === "" ? null : Number(moisture),
        inspector: inspector.trim() || null,
        notes: notes.trim() || null
      });
      toast.success(`${GRADES[chosenGrade].text}. ${online ? WORDS.savedSending.text : WORDS.saved.say}`);
      navigate(`/app/harvests/${harvest.clientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={WORDS.checkQuality.text}
        subtitle={`${growEmoji(harvest.crop)} ${harvest.crop} · ${harvest.quantity} ${harvest.unit}`}
        backTo={`/app/harvests/${clientId}`}
        say={WORDS.checkQuality}
      />
      <ErrorBanner message={error} />

      <Section>
        <div className="space-y-2">
          {QUALITY_CHECKS.map((check) => (
            <div key={check.value} className="flex items-center gap-2" data-say={check.say}>
              <span className="text-3xl" aria-hidden="true">
                {check.emoji}
              </span>
              <span className="flex-1 text-sm font-bold text-ink">{check.text}</span>
              <ChoiceButton
                words={{ say: `${check.text}: yes.` }}
                selected={checks[check.value] === true}
                onClick={() => answer(check.value, true)}
                className="min-w-16"
              >
                👍 Yes
              </ChoiceButton>
              <ChoiceButton
                words={{ say: `${check.text}: no.` }}
                selected={checks[check.value] === false}
                onClick={() => answer(check.value, false)}
                className="min-w-16"
              >
                👎 No
              </ChoiceButton>
            </div>
          ))}
        </div>
      </Section>

      <Section title={WORDS.grade}>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(GRADES).map(([value, item]) => (
            <ChoiceButton
              key={value}
              words={item}
              selected={chosenGrade === value}
              onClick={() => setGrade(value)}
              className="flex-col gap-0.5 py-2"
            >
              <span className="text-3xl" aria-hidden="true">
                {item.emoji}
              </span>
              {item.text}
              {suggested === value && !grade && <span className="text-[10px] font-normal">(from the checks)</span>}
            </ChoiceButton>
          ))}
        </div>
      </Section>

      <DateChoice value={date} onChange={setDate} />

      <Section>
        <button
          type="button"
          onClick={() => setShowWrite((value) => !value)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={showWrite}
          data-say={WORDS.writeMyself.say}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <PencilLine size={20} className="text-ink-soft" aria-hidden="true" /> More (for the extension officer)
          </span>
          {showWrite ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showWrite && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="label">Moisture % (if you have a meter)</p>
              <QuantityStepper value={moisture} onChange={setMoisture} label="Moisture percent" />
            </div>
            <Field label="Checked by" htmlFor="inspector">
              <TextInput id="inspector" value={inspector} onChange={(event) => setInspector(event.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
            </Field>
          </div>
        )}
      </Section>

      <Button size="lg" className="w-full text-lg" loading={busy} onClick={save} data-say={WORDS.save.say}>
        {GRADES[chosenGrade].emoji} {WORDS.save.text}
      </Button>
    </div>
  );
}
