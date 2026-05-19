import { useState } from "react";
import { StepAdmin } from "./StepAdmin";
import { StepAI } from "./StepAI";

type Step = "admin" | "ai" | "done";

interface Props {
  onComplete: () => void;
}

const STEPS: Step[] = ["admin", "ai", "done"];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {(["admin", "ai"] as Step[]).map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              current === step
                ? "bg-white text-zinc-900"
                : STEPS.indexOf(current) > STEPS.indexOf(step)
                ? "bg-zinc-600 text-zinc-300"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {i + 1}
          </div>
          {i < 1 && <div className="w-8 h-px bg-zinc-700" />}
        </div>
      ))}
    </div>
  );
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("admin");

  if (step === "done") {
    return (
      <Overlay>
        <div className="text-center py-4">
          <div className="text-4xl mb-4">🍜</div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">You're all set!</h2>
          <p className="text-zinc-400 text-sm mb-6">Your Noodle instance is ready to use.</p>
          <button
            onClick={onComplete}
            className="bg-white text-zinc-900 font-medium rounded-lg px-6 py-2 text-sm hover:bg-zinc-200 transition"
          >
            Open Dashboard
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🍜</span>
        <span className="font-semibold text-zinc-100">Noodle Setup</span>
      </div>

      <StepIndicator current={step} />

      {step === "admin" && (
        <StepAdmin onDone={() => setStep("ai")} />
      )}
      {step === "ai" && (
        <StepAI onDone={() => setStep("done")} />
      )}
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {children}
      </div>
    </div>
  );
}
