package dev.financial.sources;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class SourcePublisher {
  record State(String source, boolean paused, long intervalMs) {}

  private final KafkaTemplate<String, String> kafka;
  private final ObjectMapper json;
  private final String source;
  private boolean paused;
  private long intervalMs;
  private long nextEmission;
  private long sequence;
  private boolean seeded;

  SourcePublisher(
      KafkaTemplate<String, String> kafka,
      ObjectMapper json,
      @Value("${SOURCE:CORE_BANK}") String source,
      @Value("${EMIT_INTERVAL_MS:5000}") long interval) {
    this.kafka = kafka;
    this.json = json;
    this.source = source;
    paused = interval <= 0;
    intervalMs = interval > 0 ? interval : 5000;
  }

  synchronized void seed() throws Exception {
    send(
        kafka,
        json,
        source,
        "001",
        Instant.parse("2026-11-09T06:00:00Z")
            .plusSeconds(
                source.equals("CARD_PROCESSOR")
                    ? 9760
                    : source.equals("WALLET_PROVIDER") ? 900 : 0));
    if (source.equals("CORE_BANK")) {
      var other = new LinkedHashMap<String, Object>();
      other.put("eventId", "evt-bank-ben-001");
      other.put("schemaVersion", 1);
      other.put("source", source);
      other.put("sourceAccountRef", "bank-account-2075");
      other.put("occurredAt", "2026-11-09T07:00:00Z");
      other.put(
          "payload",
          Map.of(
              "reference",
              "bank-ben-001",
              "description",
              "November salary",
              "amount",
              "12000.00",
              "currency",
              "ZAR",
              "creditDebit",
              "CREDIT"));
      kafka
          .send("mock.bank.transactions.v1", "bank-account-2075", json.writeValueAsString(other))
          .get(10, java.util.concurrent.TimeUnit.SECONDS);
    }

    nextEmission = System.currentTimeMillis() + intervalMs;
    seeded = true;
  }

  synchronized State state() {
    return new State(source, paused, intervalMs);
  }

  synchronized State configure(boolean paused, long intervalMs) {
    if (!seeded)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
          "Source is starting. Retry shortly.");
    if (intervalMs < 500 || intervalMs > 60000)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.BAD_REQUEST, "Interval must be 500–60000 ms.");
    this.paused = paused;
    this.intervalMs = intervalMs;
    nextEmission = System.currentTimeMillis() + intervalMs;
    return state();
  }

  @Scheduled(fixedDelay = 250)
  synchronized void tick() {
    if (!seeded || paused || System.currentTimeMillis() < nextEmission) return;
    try {
      sendLive(kafka, json, source, sequence++);
    } catch (Exception exception) {
      org.slf4j.LoggerFactory.getLogger(getClass())
          .warn("Mock event publication failed; next tick will retry", exception);
    }
    nextEmission = System.currentTimeMillis() + intervalMs;
  }

  private void sendLive(
      KafkaTemplate<String, String> kafka, ObjectMapper json, String source, long sequence)
      throws Exception {
    var now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    String kind =
        switch (source) {
          case "CORE_BANK" -> "bank";
          case "CARD_PROCESSOR" -> "card";
          default -> "wallet";
        };
    String account = kind + "-account-" + (sequence % 2 == 0 ? "1042" : "2075");
    String reference = kind + "-" + UUID.randomUUID();
    boolean scenario = sequence % 12 == 9;
    var random = java.util.concurrent.ThreadLocalRandom.current();
    String[] merchants = {"FreshMart", "FuelStop", "GadgetHub", "StreamBox"};
    String[] mccs = {"5411", "5541", "5732", "5815"};
    int index = (int) (sequence % merchants.length);
    long minor = scenario ? 750000 : random.nextLong(2500, 180001);
    String amount = java.math.BigDecimal.valueOf(minor, 2).toPlainString();
    var payment = new LinkedHashMap<String, Object>();
    payment.put("status", "BOOKED");
    payment.put("bookedAt", now.toString());
    payment.put(
        "valueDate",
        now.atZone(java.time.ZoneId.of("Africa/Johannesburg")).toLocalDate().toString());
    payment.put("paymentReference", reference);
    var payload = new LinkedHashMap<String, Object>();
    payload.put("currency", "ZAR");
    if (source.equals("CORE_BANK")) {
      payment.put("type", "TRANSFER");
      payment.put("channel", "MOBILE");
      payment.put(
          "counterparty",
          Map.of(
              "id",
              scenario ? "beneficiary-new-" + reference : "beneficiary-rent",
              "name",
              scenario ? "New supplier" : "Monthly services",
              "beneficiaryCreatedAt",
              now.minusSeconds(scenario ? 600 : 90 * 86400L).toString()));
      payload.put("reference", reference);
      payload.put("description", scenario ? "Supplier payment" : "Services transfer");
      payload.put("amount", amount);
      payload.put("creditDebit", "DEBIT");
    } else {
      payment.put("type", "CARD_PURCHASE");
      payment.put("channel", scenario ? "ECOMMERCE" : "POS");
      payment.put(
          "merchant",
          Map.of(
              "id",
              "merchant-" + index,
              "name",
              merchants[index],
              "categoryCode",
              mccs[index],
              "country",
              scenario ? "GB" : "ZA"));
      payment.put(
          "instrument",
          Map.of(
              "lastFour",
              sequence % 2 == 0 ? "1042" : "2075",
              "authentication",
              scenario ? "NONE" : "PIN"));
      if (source.equals("CARD_PROCESSOR")) {
        payload.put("transactionRef", reference);
        payload.put("merchantName", merchants[index]);
        payload.put("amountMinor", minor);
        payload.put("direction", "DEBIT");
      } else {
        payload.put("reference", reference);
        payload.put("counterparty", merchants[index]);
        payload.put("signedAmount", "-" + amount);
      }
    }
    payload.put("payment", payment);
    var event =
        Map.of(
            "eventId",
            "evt-" + reference,
            "schemaVersion",
            2,
            "source",
            source,
            "sourceAccountRef",
            account,
            "occurredAt",
            now.toString(),
            "payload",
            payload);
    kafka
        .send("mock." + kind + ".transactions.v1", account, json.writeValueAsString(event))
        .get(10, java.util.concurrent.TimeUnit.SECONDS);
  }

  private void send(
      KafkaTemplate<String, String> kafka, ObjectMapper json, String source, String ref, Instant at)
      throws Exception {
    String kind;
    Map<String, Object> payload;
    switch (source) {
      case "CORE_BANK" -> {
        kind = "bank";
        payload =
            Map.of(
                "reference",
                "bank-" + ref,
                "description",
                "November salary",
                "amount",
                "25000.00",
                "currency",
                "ZAR",
                "creditDebit",
                "CREDIT");
      }
      case "CARD_PROCESSOR" -> {
        kind = "card";
        payload =
            Map.of(
                "transactionRef",
                "card-" + ref,
                "merchantName",
                "GadgetHub",
                "amountMinor",
                510000,
                "currency",
                "ZAR",
                "direction",
                "DEBIT");
      }
      case "WALLET_PROVIDER" -> {
        kind = "wallet";
        payload =
            Map.of(
                "reference",
                "wallet-" + ref,
                "counterparty",
                "FreshMart",
                "signedAmount",
                "-842.50",
                "currency",
                "ZAR");
      }
      default -> throw new IllegalArgumentException("Unknown SOURCE");
    }
    var event =
        Map.of(
            "eventId",
            "evt-" + kind + "-" + ref,
            "schemaVersion",
            1,
            "source",
            source,
            "sourceAccountRef",
            kind + "-account-1042",
            "occurredAt",
            at.toString(),
            "payload",
            payload);
    kafka
        .send(
            "mock." + kind + ".transactions.v1",
            kind + "-account-1042",
            json.writeValueAsString(event))
        .get(10, java.util.concurrent.TimeUnit.SECONDS);
  }
}
