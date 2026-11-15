package dev.financial.app.overview.internal;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.fraud.FraudDashboard;
import dev.financial.app.platform.AppProperties;
import dev.financial.app.transactions.TransactionDashboard;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
class OverviewService {
  record Overview(
      Instant asOf,
      LocalDate from,
      LocalDate toExclusive,
      String bucket,
      Instant receivedFrom,
      TransactionDashboard.Report transactions,
      FraudDashboard.Counts fraud) {}

  private final AccountAccess accounts;
  private final TransactionDashboard transactions;
  private final FraudDashboard fraud;
  private final AppProperties properties;
  private final Clock clock;

  OverviewService(
      AccountAccess accounts,
      TransactionDashboard transactions,
      FraudDashboard fraud,
      AppProperties properties,
      Clock clock) {
    this.accounts = accounts;
    this.transactions = transactions;
    this.fraud = fraud;
    this.properties = properties;
    this.clock = clock;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Overview read(UUID accountId, int days, Authentication auth) {
    if (days != 1 && days != 7 && days != 30)
      throw new IllegalArgumentException("Choose 1, 7 or 30 days");
    var scope = accounts.scope(accountId, null, auth);
    Instant now = clock.instant();
    ZoneId zone = ZoneId.of("Africa/Johannesburg");
    LocalDate today = now.atZone(zone).toLocalDate();
    LocalDate from = today.minusDays(days - 1L);
    LocalDate until = today.plusDays(1);
    Instant start = from.atStartOfDay(zone).toInstant();
    Instant end = until.atStartOfDay(zone).toInstant();
    Instant receivedFrom = now.truncatedTo(ChronoUnit.MINUTES).minus(14, ChronoUnit.MINUTES);
    String bucket = days == 1 ? "hour" : "day";
    return new Overview(
        now,
        from,
        until,
        bucket,
        receivedFrom,
        transactions.report(scope, start, end, now, bucket, receivedFrom),
        properties.fraudEnabled() ? fraud.counts(scope, start, end, now) : null);
  }
}
