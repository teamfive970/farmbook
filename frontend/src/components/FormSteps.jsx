export function StepIndicator({ step, steps, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Step {step + 1} of {steps.length}
      </p>
      <div
        className="mt-2 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step + 1}
        aria-label={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}
      >
        {steps.map((label, index) => (
          <span
            key={label}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index <= step ? "bg-primary" : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-base font-bold text-ink">{steps[step]}</p>
    </div>
  );
}
