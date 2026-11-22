import { ChevronDown, ChevronUp, CircleCheck, CircleX, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChoiceButton, DateChoice, QuantityStepper, Section } from "../../components/Choices.jsx";
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  TextInput,
  Textarea
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { GRADES, QUALITY_CHECKS, WORDS, suggestGrade, unitText } from "../../lib/words.js";

// Quality check by looking and smelling: yes/no for each picture. The grade is
// suggested from the checks that were answered (a skipped check does not count
// against the crop) and can be changed. Opened with a check id, it changes or
// deletes that check.
export default function InspectionForm() {
  const { clientId, checkId } = useParams();
  const editing = Boolean(checkId);
  const { records, loading } = useFarmerData();
  const { createRecord, updateRecord, deleteRecord, online } = useSync();
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  const harvest = records.harvests.find((item) => item.clientId === clientId);
  const existing = editing ? records.inspections.find((item) => item.clientId === checkId) : null;

  useEffect(() => {
    if (!editing || loaded || !existing) return;
    setChecks(existing.checks || {});
    setGrade(existing.grade);
    setDate(existing.inspectionDate || todayInputValue());
    setMoisture(existing.moisturePercent === null || existing.moisturePercent === undefined ? "" : String(existing.moisturePercent));
    setInspector(existing.inspector || "");
    setNotes(existing.notes || "");
    setShowWrite(Boolean(existing.inspector || existing.notes || existing.moisturePercent));
    setLoaded(true);
  }, [editing, existing, loaded]);

  if (!harvest || (editing && !existing)) {
    if (loading) return <PageLoading label="Opening…" />;
    return <PageHeader title={editing ? "Check not found" : "Harvest not found"} backTo={harvest ? `/app/harvests/${clientId}` : "/app/harvests"} />;
  }

  const suggested = suggestGrade(checks);
  const chosenGrade = grade || suggested;
  const answered = QUALITY_CHECKS.filter((item) => checks[item.value] !== undefined).length;

  function answer(key, value) {
    setChecks((current) => {
      const next = { ...current };
      // Touching the same answer again clears it (as if skipped).
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
    setGrade(null);
    setError("");
  }

  async function save() {
    if (answered === 0 && !grade) return setError("Touch yes or no for at least one check, or choose the grade.");
    if (!chosenGrade) return setError("Choose the grade.");
    const payload = {
      inspectionDate: date,
      grade: chosenGrade,
      checks,
      moisturePercent: moisture === "" ? null : Number(moisture),
      inspector: inspector.trim() || null,
      notes: notes.trim() || null
    };
    setBusy(true);
    try {
      if (editing) await updateRecord(existing, payload);
      else await createRecord("inspections", { clientId: newClientId(), harvestClientId: harvest.clientId, ...payload });
      toast.success(`${GRADES[chosenGrade].text}. ${online ? WORDS.savedSending.text : WORDS.saved.say}`);
      navigate(`/app/harvests/${harvest.clientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await deleteRecord(existing);
      toast.success("The check is deleted.");
      navigate(`/app/harvests/${harvest.clientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-4xl">
      <PageHeader
        title={editing ? "Change the check" : WORDS.checkQuality.text}
        subtitle={`${harvest.crop} · ${harvest.quantity} ${unitText(harvest.unit)}`}
        backTo={`/app/harvests/${clientId}`}
        say={WORDS.checkQuality}
      />
      <ErrorBanner message={error} />

      <Section>
        <p className="-mt-1 mb-3 text-xs text-ink-soft">You can leave a check you can't do. Touch an answer again to clear it.</p>
        <div className="space-y-2">
          {QUALITY_CHECKS.map((check) => (
            <div key={check.value} className="flex items-center gap-2" data-say={check.say}>
              <check.Icon size={26} className="shrink-0 text-ink-soft" aria-hidden="true" />
              <span className="flex-1 text-sm font-bold text-ink">{check.text}</span>
              <ChoiceButton
                words={{ say: `${check.text}: yes.` }}
                selected={checks[check.value] === true}
                onClick={() => answer(check.value, true)}
                className="min-w-16"
              >
                <CircleCheck size={16} aria-hidden="true" /> Yes
              </ChoiceButton>
              <ChoiceButton
                words={{ say: `${check.text}: no.` }}
                selected={checks[check.value] === false}
                onClick={() => answer(check.value, false)}
                className="min-w-16"
              >
                <CircleX size={16} aria-hidden="true" /> No
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
              <item.Icon size={24} aria-hidden="true" />
              {item.text}
              {suggested === value && !grade && <span className="text-[10px] font-normal">(from the checks)</span>}
            </ChoiceButton>
          ))}
        </div>
        {answered > 0 && answered < QUALITY_CHECKS.length && (
          <p className="mt-2 text-xs text-ink-soft">
            {answered} of {QUALITY_CHECKS.length} checks answered. The ones you left do not lower the grade.
          </p>
        )}
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
        <ICONS.quality size={20} aria-hidden="true" /> {WORDS.save.text}
        {chosenGrade ? ` · ${GRADES[chosenGrade].text}` : ""}
      </Button>

      {editing && (
        <>
          <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete this check
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            title="Delete this check?"
            message="The grade from this check will be taken off the harvest."
            confirmLabel="Delete"
            onConfirm={remove}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      )}
    </div>
  );
}
