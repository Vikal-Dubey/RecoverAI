export default function RecoveryStepper({ payment, liveStage }) {
  if (!payment) return null;

  const decisions = payment.agentDecisions || [];
  const latestDecision = decisions[0];
  const attempts = payment.recoveryAttempts || [];
  const currentState = payment.agentState?.currentState;
  const status = payment.status;

  // Real state determination
  const hasDecision = decisions.length > 0 || ['DECISION_MADE', 'POLICY_CHECKED', 'ACTION_SCHEDULED', 'ACTION_EXECUTED', 'RESULT_RECEIVED', 'COMPLETED', 'ESCALATED', 'STOPPED'].includes(currentState);
  const hasPolicyCheck = (latestDecision?.policyChecks && latestDecision.policyChecks.length > 0) || ['POLICY_CHECKED', 'ACTION_SCHEDULED', 'ACTION_EXECUTED', 'RESULT_RECEIVED', 'COMPLETED', 'ESCALATED', 'STOPPED'].includes(currentState);
  const hasRecoveryAction = attempts.some((a) => a.executedAt) || ['ACTION_EXECUTED', 'RESULT_RECEIVED', 'COMPLETED', 'ESCALATED', 'STOPPED'].includes(currentState) || status === 'RECOVERED' || status === 'ESCALATED' || status === 'STOPPED';
  const isTerminal = status === 'RECOVERED' || status === 'ESCALATED' || status === 'STOPPED';

  const isAnalyzing = liveStage === 'decision' || currentState === 'ANALYZING';
  const isExecuting = liveStage === 'executing' || currentState === 'ACTION_SCHEDULED' || currentState === 'ACTION_EXECUTED';

  // Step status: 'done' | 'active' | 'upcoming'
  const step1State = 'done'; // Failed is always the initial root state

  let step2State = 'upcoming';
  if (hasDecision) {
    step2State = 'done';
  } else if (isAnalyzing) {
    step2State = 'active';
  }

  let step3State = 'upcoming';
  if (hasPolicyCheck) {
    step3State = 'done';
  } else if (step2State === 'done' && !hasPolicyCheck) {
    step3State = 'active';
  }

  let step4State = 'upcoming';
  if (hasRecoveryAction) {
    step4State = 'done';
  } else if (isExecuting || (step3State === 'done' && !hasRecoveryAction)) {
    step4State = 'active';
  }

  let step5State = 'upcoming';
  if (isTerminal) {
    step5State = 'done';
  } else if (step4State === 'done') {
    step5State = 'active';
  }

  // Determine dynamic result label
  let resultLabel = 'Result';
  if (status === 'RECOVERED') resultLabel = 'Recovered';
  else if (status === 'ESCALATED') resultLabel = 'Escalated';
  else if (status === 'STOPPED') resultLabel = 'Stopped';

  const steps = [
    { id: 1, label: 'Payment Failed', state: step1State },
    { id: 2, label: 'AI Recommendation', state: step2State },
    { id: 3, label: 'Policy Check', state: step3State },
    { id: 4, label: 'Recovery', state: step4State },
    { id: 5, label: resultLabel, state: step5State },
  ];

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isDone = step.state === 'done';
          const isActive = step.state === 'active';
          const isUpcoming = step.state === 'upcoming';
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2.5">
                {isDone ? (
                  <div className="w-6 h-6 rounded-full bg-accent text-bg flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </div>
                ) : isActive ? (
                  <div className="w-6 h-6 rounded-full bg-warn text-bg flex items-center justify-center text-xs font-bold shrink-0 stepper-active-pulse">
                    ●
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-border text-muted-2 flex items-center justify-center text-xs font-medium shrink-0">
                    {step.id}
                  </div>
                )}

                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isDone ? 'text-text' : isActive ? 'text-warn font-semibold' : 'text-muted-2'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={`h-px flex-1 mx-4 ${
                    isDone && steps[idx + 1].state !== 'upcoming' ? 'bg-accent' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
