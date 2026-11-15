package dev.financial.app.transactions;

import java.time.Instant;
import java.time.LocalDate;

/** Facts supplied by the trusted source adapter, never inferred from missing data. */
public record PaymentDetails(
    String status,
    String type,
    String channel,
    Instant bookedAt,
    LocalDate valueDate,
    String paymentReference,
    Merchant merchant,
    Counterparty counterparty,
    Instrument instrument) {
  public PaymentDetails {
    if (!"BOOKED".equals(status))
      throw new IllegalArgumentException("This feed accepts booked movements only");
    if (!java.util.Set.of("CARD_PURCHASE", "TRANSFER", "DIRECT_DEBIT", "CASH_WITHDRAWAL", "REFUND")
        .contains(type == null ? "" : type))
      throw new IllegalArgumentException("Invalid payment type");
    if (!java.util.Set.of("POS", "ECOMMERCE", "MOBILE", "ONLINE", "ATM", "BRANCH")
        .contains(channel == null ? "" : channel))
      throw new IllegalArgumentException("Invalid channel");
    if (bookedAt == null || valueDate == null)
      throw new IllegalArgumentException("Booking and value dates are required");
    bounded(paymentReference, 150);
    if ("CARD_PURCHASE".equals(type) && (merchant == null || instrument == null))
      throw new IllegalArgumentException(
          "Card purchases require merchant and masked instrument details");
    if ("TRANSFER".equals(type) && counterparty == null)
      throw new IllegalArgumentException("Transfers require a counterparty");
  }

  public record Merchant(String id, String name, String categoryCode, String country) {
    public Merchant {
      bounded(id, 100);
      bounded(name, 200);
      if (categoryCode == null || !categoryCode.matches("[0-9]{4}"))
        throw new IllegalArgumentException("Invalid MCC");
      if (country == null
          || !java.util.Set.of(java.util.Locale.getISOCountries()).contains(country))
        throw new IllegalArgumentException("Invalid merchant country");
    }
  }

  public record Counterparty(String id, String name, Instant beneficiaryCreatedAt) {
    public Counterparty {
      bounded(id, 100);
      bounded(name, 200);
    }
  }

  public record Instrument(String lastFour, String authentication) {
    public Instrument {
      if (lastFour == null || !lastFour.matches("[0-9]{4}"))
        throw new IllegalArgumentException("Only the last four card digits are accepted");
      if (!java.util.Set.of("THREE_DS", "PIN", "NONE", "UNKNOWN")
          .contains(authentication == null ? "" : authentication))
        throw new IllegalArgumentException("Invalid authentication evidence");
    }
  }

  private static void bounded(String value, int max) {
    if (value == null
        || value.isBlank()
        || value.length() > max
        || value.chars().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException("Invalid payment text field");
  }
}
