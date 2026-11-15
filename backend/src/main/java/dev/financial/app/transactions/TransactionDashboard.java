package dev.financial.app.transactions;

import dev.financial.app.transactions.internal.DashboardRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Bounded reporting API. The caller supplies authorized accounts and owns the read snapshot. */
@Service
public class TransactionDashboard {
  public record Totals(long transactionCount, String moneyIn, String moneyOut) {}

  public record Activity(Instant at, long credits, long debits, String moneyIn, String moneyOut) {}

  public record Spending(String category, String amount) {}

  public record Arrival(Instant at, String source, long count) {}

  public record Report(
      Totals totals,
      List<Activity> activity,
      List<Spending> spending,
      List<Arrival> arrivals,
      Instant lastReceivedAt) {}

  private final DashboardRepository repository;

  public TransactionDashboard(DashboardRepository repository) {
    this.repository = repository;
  }

  public Report report(
      List<UUID> accounts,
      Instant from,
      Instant until,
      Instant asOf,
      String bucket,
      Instant receivedFrom) {
    if (accounts.isEmpty())
      return new Report(new Totals(0, "0.00", "0.00"), List.of(), List.of(), List.of(), null);
    return new Report(
        repository.totals(accounts, from, until, asOf),
        repository.activity(accounts, from, until, asOf, bucket),
        repository.spending(accounts, from, until, asOf),
        repository.arrivals(accounts, receivedFrom, asOf),
        repository.lastReceived(accounts, asOf));
  }
}
