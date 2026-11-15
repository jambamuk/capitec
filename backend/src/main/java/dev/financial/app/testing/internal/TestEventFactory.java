package dev.financial.app.testing.internal;

import dev.financial.app.transactions.PaymentDetails;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

final class TestEventFactory {
  private TestEventFactory() {}

  static Map<String, Object> create(
      TestEventRequest request, String accountReference, String lastFour, int index) {
    BigDecimal amount = new BigDecimal(request.amount()).setScale(2, RoundingMode.UNNECESSARY);
    if (amount.signum() <= 0 || amount.precision() > 19)
      throw new IllegalArgumentException("Amount must be positive with at most 17 whole digits");
    String reference = "test-" + request.requestId() + "-" + index;
    var occurred =
        request
            .occurredAt()
            .minusSeconds((long) (request.count() - 1 - index) * request.spacingSeconds());
    boolean card = request.type() == TestEventRequest.PaymentType.CARD_PURCHASE;
    var payment =
        new PaymentDetails(
            "BOOKED",
            request.type().name(),
            request.channel().name(),
            occurred,
            occurred.atZone(ZoneId.of("Africa/Johannesburg")).toLocalDate(),
            reference,
            card
                ? new PaymentDetails.Merchant(
                    "test-merchant",
                    request.merchant(),
                    request.merchantCategory(),
                    request.country())
                : null,
            card
                ? null
                : new PaymentDetails.Counterparty(
                    "test-beneficiary",
                    request.beneficiary(),
                    occurred.minusSeconds(request.beneficiaryAgeMinutes() * 60L)),
            card ? new PaymentDetails.Instrument(lastFour, "THREE_DS") : null);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("currency", "ZAR");
    payload.put("payment", payment);
    switch (request.source()) {
      case CORE_BANK -> {
        payload.put("reference", reference);
        payload.put("description", request.description());
        payload.put("amount", amount.toPlainString());
        payload.put("creditDebit", request.direction().name());
      }
      case CARD_PROCESSOR -> {
        payload.put("transactionRef", reference);
        payload.put("merchantName", request.description());
        payload.put("amountMinor", amount.unscaledValue());
        payload.put("direction", request.direction().name());
      }
      case WALLET_PROVIDER -> {
        payload.put("reference", reference);
        payload.put("counterparty", request.description());
        payload.put(
            "signedAmount",
            (request.direction() == TestEventRequest.Direction.DEBIT ? amount.negate() : amount)
                .toPlainString());
      }
    }
    return Map.of(
        "eventId",
        "evt-" + reference,
        "schemaVersion",
        2,
        "source",
        request.source().name(),
        "sourceAccountRef",
        accountReference,
        "occurredAt",
        occurred.toString(),
        "payload",
        payload);
  }
}
