package dev.financial.app.fraud.internal.rules;

import java.util.Map;

/** The decision from one rule, including only the extra facts that rule used. */
public record RuleCheck(Outcome outcome, String explanation, Map<String, Object> observations) {
  public enum Outcome {
    MATCHED,
    NOT_MATCHED,
    NOT_APPLICABLE,
    INSUFFICIENT_DATA,
    DISABLED
  }

  public static RuleCheck matched(
      boolean matches, String explanation, Map<String, Object> observations) {
    return new RuleCheck(
        matches ? Outcome.MATCHED : Outcome.NOT_MATCHED, explanation, observations);
  }

  public static RuleCheck skipped(Outcome outcome, String explanation) {
    return new RuleCheck(outcome, explanation, Map.of());
  }
}
