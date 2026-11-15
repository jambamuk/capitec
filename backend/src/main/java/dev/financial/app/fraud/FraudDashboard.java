package dev.financial.app.fraud;

import dev.financial.app.fraud.internal.persistence.FraudDashboardRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Read model for mutually exclusive states within a transaction-date cohort. */
@Service
public class FraudDashboard {
  public record Counts(
      long notFlagged, long needsReview, long reviewed, long pending, long highPriority) {}

  private final FraudDashboardRepository repository;

  public FraudDashboard(FraudDashboardRepository repository) {
    this.repository = repository;
  }

  public Counts counts(List<UUID> accounts, Instant from, Instant until, Instant asOf) {
    if (accounts.isEmpty()) return new Counts(0, 0, 0, 0, 0);
    return repository.counts(accounts, from, until, asOf);
  }
}
