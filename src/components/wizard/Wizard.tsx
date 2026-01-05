import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";

export interface WizardStep {
  id: string;
  title: string;
  component: React.ComponentType<WizardStepProps>;
  validate?: () => boolean | string; // Return true if valid, or error message
}

export interface WizardStepProps {
  isActive: boolean;
  onFieldChange: (field: string, value: unknown) => void;
  data: Record<string, unknown>;
  setFieldFocus: (index: number) => void;
  focusedField: number;
}

export interface WizardProps {
  title: string;
  steps: WizardStep[];
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  initialData?: Record<string, unknown>;
}

export function Wizard({
  title,
  steps,
  onComplete,
  onCancel,
  initialData = {},
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState(0);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const goNext = useCallback(async () => {
    if (!step) return;

    // Validate current step
    if (step.validate) {
      const result = step.validate();
      if (result !== true) {
        setError(typeof result === "string" ? result : "Please fill in all required fields");
        return;
      }
    }

    if (isLastStep) {
      setIsSubmitting(true);
      setError(null);
      try {
        await onComplete(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep((prev) => prev + 1);
      setFocusedField(0);
      setError(null);
    }
  }, [step, isLastStep, data, onComplete]);

  const goPrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
      setFocusedField(0);
      setError(null);
    }
  }, [isFirstStep]);

  useInput(
    (input, key) => {
      if (isSubmitting) return;

      if (key.escape) {
        if (isFirstStep) {
          onCancel();
        } else {
          goPrev();
        }
      } else if (key.tab && !key.shift) {
        // Tab handled by individual step components
      } else if (input === "n" && key.ctrl) {
        goNext();
      } else if (input === "p" && key.ctrl) {
        goPrev();
      }
    },
    { isActive: !isSubmitting }
  );

  if (!step) {
    return <Text color="red">Error: Invalid step</Text>;
  }

  const StepComponent = step.component;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          {title}
        </Text>
      </Box>

      {/* Step indicator */}
      <Box marginBottom={1}>
        {steps.map((s, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <Box key={s.id} marginRight={1}>
              <Text
                color={isCompleted ? "green" : isCurrent ? "cyan" : "gray"}
                bold={isCurrent}
              >
                {isCompleted ? "✓" : index + 1}. {s.title}
                {index < steps.length - 1 && " →"}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Step content */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        padding={1}
        marginBottom={1}
      >
        <Box marginBottom={1}>
          <Text bold>
            Step {currentStep + 1}: {step.title}
          </Text>
        </Box>
        <StepComponent
          isActive={!isSubmitting}
          onFieldChange={handleFieldChange}
          data={data}
          setFieldFocus={setFocusedField}
          focusedField={focusedField}
        />
      </Box>

      {/* Error display */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Navigation */}
      <Box>
        <Text dimColor>
          {isSubmitting ? (
            "Submitting..."
          ) : (
            <>
              [Esc] {isFirstStep ? "Cancel" : "Back"} | [Ctrl+N] {isLastStep ? "Create" : "Next"}
              {!isFirstStep && " | [Ctrl+P] Previous"}
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}
