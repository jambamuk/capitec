package dev.financial.app.fraud.internal;

/** An operator's recorded disposition. It does not execute a payment action. */
public enum ReviewOutcome {
  REVIEWED,
  CLEARED,
  ESCALATED
}
