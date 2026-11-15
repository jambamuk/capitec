package dev.financial.app.transactions;

import dev.financial.app.transactions.internal.HistoryRepository;
import dev.financial.app.transactions.internal.TransactionRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;

/** Module API for fraud evidence. The caller owns the repeatable-read transaction. */
@Service
public class TransactionHistory {
  public record Window(long count, BigDecimal total, Instant fromExclusive, Instant toInclusive) {}

  private final TransactionRepository transactions;
  private final HistoryRepository history;

  public TransactionHistory(TransactionRepository transactions, HistoryRepository history) {
    this.transactions = transactions;
    this.history = history;
  }

  public PaymentDetails payment(CategorizedTransaction event) {
    var stored =
        transactions
            .findItem(event.transactionId())
            .orElseThrow(() -> new IllegalArgumentException("Unknown transaction"));
    boolean sameFinancialFacts =
        stored.accountId().equals(event.accountId())
            && new BigDecimal(stored.amount()).compareTo(event.amount()) == 0
            && stored.direction().equals(event.direction())
            && stored.currency().equals(event.currency())
            && stored.description().equals(event.description())
            && stored.category().equals(event.category());
    // PostgreSQL stores microseconds; the originating event may have nanosecond precision.
    boolean sameTime =
        Duration.between(stored.occurredAt(), event.occurredAt()).abs().toNanos() <= 1000;
    if (!sameFinancialFacts || !sameTime) {
      throw new IllegalArgumentException("Categorized event does not match the stored transaction");
    }
    return stored.payment();
  }

  public Window window(
      CategorizedTransaction event, int minutes, String direction, Instant cutoff) {
    Instant start = event.occurredAt().minusSeconds(minutes * 60L);
    var totals =
        history.summarizeWindow(
            event.accountId(), event.currency(), direction, start, event.occurredAt(), cutoff);
    return new Window(totals.count(), totals.total().setScale(2), start, event.occurredAt());
  }
}
