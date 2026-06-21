import type { ReadinessResult } from "./specReadiness.js";
import clarificationQuestions from "../rules/clarificationQuestions.json";

export interface ClarificationQuestion {
  field: string;
  question: string;
  whyImportant: string;
  options: string[];
  defaultAssumption: string;
  priority: string;
}

export interface ClarificationResult {
  missingFields: string[];
  questions: ClarificationQuestion[];
  defaultAssumptions: Record<string, string>;
}

export function generateClarification(
  rawIdea: string,
  readiness: ReadinessResult,
  scenario: string,
  platform: string,
  strictness: string,
  knownContext?: Record<string, any>
): ClarificationResult {
  const questions: ClarificationQuestion[] = [];
  const defaultAssumptions: Record<string, string> = {};
  const missingFields: string[] = [];

  const scenarioQuestions =
    clarificationQuestions[scenario as keyof typeof clarificationQuestions] ||
    clarificationQuestions.build_product;

  for (const field of Object.entries(readiness.fields)) {
    const [fieldName, fieldInfo] = field;
    if (!fieldInfo.present) {
      missingFields.push(fieldName);
    }
  }

  for (const sq of scenarioQuestions) {
    const fieldInfo = readiness.fields[sq.field];
    if (!fieldInfo || !fieldInfo.present) {
      questions.push({
        field: sq.field,
        question: sq.question,
        whyImportant: sq.why_important,
        options: sq.options,
        defaultAssumption: sq.default_assumption,
        priority: sq.priority,
      });
      defaultAssumptions[sq.field] = sq.default_assumption;
    }
  }

  if (strictness === "grill") {
    for (const field of Object.entries(readiness.fields)) {
      const [fieldName, fieldInfo] = field;
      if (!fieldInfo.present && !questions.find((q) => q.field === fieldName)) {
        const allQuestions = Object.values(clarificationQuestions).flat();
        const matchingQ = allQuestions.find((q) => q.field === fieldName);
        if (matchingQ) {
          questions.push({
            field: matchingQ.field,
            question: matchingQ.question,
            whyImportant: matchingQ.why_important,
            options: matchingQ.options,
            defaultAssumption: matchingQ.default_assumption,
            priority: matchingQ.priority,
          });
          defaultAssumptions[matchingQ.field] = matchingQ.default_assumption;
        }
      }
    }
  }

  return { missingFields, questions, defaultAssumptions };
}
