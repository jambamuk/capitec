package dev.financial.app.transactions.internal;

import dev.financial.app.transactions.PaymentDetails;
import java.util.Locale;

public final class TransactionCategorizer {
  private TransactionCategorizer() {}

  public static String categorize(String direction, String description, PaymentDetails payment) {
    String fallback = fromDescription(direction, description);
    if (payment == null || payment.merchant() == null) {
      return fallback;
    }
    return switch (payment.merchant().categoryCode()) {
      case "5411", "5499" -> "GROCERIES";
      case "5541", "5542", "4121" -> "TRANSPORT";
      case "5732", "5311", "5399" -> "SHOPPING";
      case "4899", "5815" -> "SUBSCRIPTIONS";
      default -> fallback;
    };
  }

  public static String fromDescription(String direction, String description) {
    String normalized = description.toLowerCase(Locale.ROOT);
    if ("CREDIT".equals(direction) && normalized.contains("salary")) {
      return "INCOME";
    }
    return switch (normalized) {
      case "freshmart" -> "GROCERIES";
      case "gadgethub", "restricted shop" -> "SHOPPING";
      case "fuelstop" -> "TRANSPORT";
      case "streambox" -> "SUBSCRIPTIONS";
      default -> "UNCATEGORIZED";
    };
  }
}
