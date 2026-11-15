package dev.financial.app.transactions;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.transactions.internal.StoredTransaction;
import dev.financial.app.transactions.internal.TransactionCategorizer;
import dev.financial.app.transactions.internal.TransactionRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransactionWriter {
  public record Input(
      String source,
      String accountReference,
      String reference,
      BigDecimal amount,
      String currency,
      String direction,
      String description,
      Instant occurredAt,
      String eventId,
      String topic,
      int partition,
      long offset,
      PaymentDetails payment) {}

  private final TransactionRepository repository;
  private final AccountAccess accounts;
  private final ApplicationEventPublisher events;
  private final MeterRegistry metrics;
  private final ObjectMapper json;

  public TransactionWriter(
      TransactionRepository repository,
      AccountAccess accounts,
      ApplicationEventPublisher events,
      MeterRegistry metrics,
      ObjectMapper json) {
    this.repository = repository;
    this.accounts = accounts;
    this.events = events;
    this.metrics = metrics;
    this.json = json;
  }

  @Transactional(rollbackFor = Exception.class)
  public void accept(Input input) throws Exception {
    var source = accounts.resolve(input.source(), input.accountReference());
    String category =
        TransactionCategorizer.categorize(input.direction(), input.description(), input.payment());
    String paymentJson = input.payment() == null ? null : json.writeValueAsString(input.payment());
    String fingerprint = fingerprint(input, paymentJson);
    var transaction = newTransaction(input, source.id(), category, paymentJson, fingerprint);
    if (repository.insertIfAbsent(transaction) == 0) {
      verifyReplay(input, source.id(), fingerprint);
      metrics.counter("transactions.duplicates", "source", input.source()).increment();
      return;
    }
    publishCategorized(input, transaction, source.accountId());
    metrics.counter("transactions.accepted", "source", input.source()).increment();
  }

  private String fingerprint(Input input, String paymentJson) {
    // Hash source facts only: deployment or rule changes must not turn a replay into a conflict.
    return hash(
        String.join(
                "\n",
                input.reference(),
                input.amount().toPlainString(),
                input.currency(),
                input.direction(),
                input.description(),
                input.occurredAt().toString())
            + (paymentJson == null ? "" : "\n" + paymentJson));
  }

  private StoredTransaction newTransaction(
      Input input, UUID sourceAccountId, String category, String paymentJson, String fingerprint) {
    return new StoredTransaction(
        UUID.randomUUID(),
        sourceAccountId,
        input.reference(),
        input.amount(),
        input.currency(),
        input.direction(),
        input.description(),
        category,
        paymentJson == null ? "1" : "2",
        fingerprint,
        input.eventId(),
        input.topic(),
        input.partition(),
        input.offset(),
        input.occurredAt(),
        null,
        paymentJson);
  }

  private void verifyReplay(Input input, UUID sourceAccountId, String fingerprint) {
    String previous =
        repository
            .findBySourceAccountIdAndSourceTransactionRef(sourceAccountId, input.reference())
            .orElseThrow()
            .inputHash();
    if (!fingerprint.equals(previous))
      throw new IllegalArgumentException("Conflicting provider transaction identity");
  }

  private void publishCategorized(Input input, StoredTransaction transaction, UUID accountId) {
    events.publishEvent(
        new CategorizedTransaction(
            UUID.randomUUID(),
            1,
            transaction.id(),
            accountId,
            input.amount(),
            input.currency(),
            input.direction(),
            input.description(),
            transaction.categoryCode(),
            transaction.categorizerVersion(),
            "1",
            input.occurredAt()));
  }

  private static String hash(String text) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
