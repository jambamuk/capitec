package dev.financial.app.ingestion.internal;

import com.fasterxml.jackson.databind.*;
import dev.financial.app.transactions.PaymentDetails;
import dev.financial.app.transactions.TransactionWriter;
import java.math.*;
import java.time.Instant;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class SourceNormalizer {
  public static final Map<String, String> SOURCES =
      Map.of(
          "mock.bank.transactions.v1",
          "CORE_BANK",
          "mock.card.transactions.v1",
          "CARD_PROCESSOR",
          "mock.wallet.transactions.v1",
          "WALLET_PROVIDER");
  private final ObjectMapper json;

  public SourceNormalizer(ObjectMapper json) {
    this.json = json;
  }

  public TransactionWriter.Input normalize(String topic, int partition, long offset, String value) {
    try {
      if (value == null || value.length() > 65536)
        throw new IllegalArgumentException("Invalid event size");
      JsonNode event = json.readTree(value);
      String source = SOURCES.get(topic);
      if (source == null
          || !source.equals(text(event, "source", 40))
          || !event.path("schemaVersion").isIntegralNumber()
          || !event.path("schemaVersion").canConvertToInt()
          || !(event.path("schemaVersion").asInt() == 1
              || event.path("schemaVersion").asInt() == 2))
        throw new IllegalArgumentException("Unsupported source or event version");
      String account = text(event, "sourceAccountRef", 100);
      String eventId = text(event, "eventId", 150);
      Instant occurred = Instant.parse(text(event, "occurredAt", 40));
      JsonNode payload = event.path("payload");
      ProviderTransaction transaction = readProviderPayload(source, payload);
      BigDecimal amount = transaction.amount();
      String direction = transaction.direction();
      amount = amount.setScale(2, RoundingMode.UNNECESSARY);
      if (amount.signum() <= 0
          || amount.precision() > 19
          || !("DEBIT".equals(direction) || "CREDIT".equals(direction))
          || !"ZAR".equals(text(payload, "currency", 3)))
        throw new IllegalArgumentException("Invalid financial values");
      PaymentDetails payment = readPaymentDetails(event, occurred);
      return new TransactionWriter.Input(
          source,
          account,
          transaction.reference(),
          amount,
          "ZAR",
          direction,
          transaction.description(),
          occurred,
          eventId,
          topic,
          partition,
          offset,
          payment);
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid transaction event");
    }
  }

  private record ProviderTransaction(
      String reference, String description, String direction, BigDecimal amount) {}

  // Each adapter describes only its provider's format; common validation remains in normalize.
  private ProviderTransaction readProviderPayload(String source, JsonNode payload) {
    String reference, description, direction;
    BigDecimal amount;
    switch (source) {
      case "CORE_BANK" -> {
        reference = text(payload, "reference", 150);
        description = text(payload, "description", 200);
        direction = text(payload, "creditDebit", 6);
        amount = decimal(payload, "amount");
      }
      case "CARD_PROCESSOR" -> {
        reference = text(payload, "transactionRef", 150);
        description = text(payload, "merchantName", 200);
        direction = text(payload, "direction", 6);
        if (!payload.path("amountMinor").isIntegralNumber())
          throw new IllegalArgumentException("Minor amount must be an integer");
        amount = new BigDecimal(payload.path("amountMinor").asText()).movePointLeft(2);
      }
      case "WALLET_PROVIDER" -> {
        reference = text(payload, "reference", 150);
        description = text(payload, "counterparty", 200);
        BigDecimal signed = decimal(payload, "signedAmount");
        direction = signed.signum() < 0 ? "DEBIT" : "CREDIT";
        amount = signed.abs();
      }
      default -> throw new IllegalArgumentException("Unknown source");
    }
    return new ProviderTransaction(reference, description, direction, amount);
  }

  private PaymentDetails readPaymentDetails(JsonNode event, Instant occurred) throws Exception {
    if (event.path("schemaVersion").asInt() == 1) return null;
    var payment = json.treeToValue(event.path("payload").path("payment"), PaymentDetails.class);
    if (payment == null || payment.bookedAt().isBefore(occurred))
      throw new IllegalArgumentException("Booking must be at or after the transaction time");
    if (payment.counterparty() != null
        && payment.counterparty().beneficiaryCreatedAt() != null
        && payment.counterparty().beneficiaryCreatedAt().isAfter(occurred))
      throw new IllegalArgumentException("Beneficiary creation must precede the transaction");
    return payment;
  }

  private static String text(JsonNode node, String key, int max) {
    JsonNode value = node.path(key);
    if (!value.isTextual()
        || value.asText().isBlank()
        || value.asText().length() > max
        || value.asText().contains("\n"))
      throw new IllegalArgumentException("Invalid field " + key);
    return value.asText().strip();
  }

  private static BigDecimal decimal(JsonNode node, String key) {
    // Source decimal contracts require strings to avoid binary floating point ambiguity.
    return new BigDecimal(text(node, key, 30));
  }
}
