package dev.financial.app.transactions;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.platform.PageCursor;
import dev.financial.app.transactions.internal.CategoryRepository;
import dev.financial.app.transactions.internal.TransactionReports.Scope;
import dev.financial.app.transactions.internal.TransactionRepository;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionQueries {
  public record Item(
      UUID id,
      UUID accountId,
      UUID customerId,
      String description,
      String source,
      String sourceTransactionId,
      String amount,
      String currency,
      String direction,
      String category,
      Instant occurredAt,
      Instant recordedAt,
      String categorizerVersion,
      PaymentDetails payment) {}

  public record Page(List<Item> items, String nextCursor, Instant asOf) {}

  public record Bucket(String name, long transactionCount, String moneyIn, String moneyOut) {}

  public record Summary(
      long transactionCount,
      String moneyIn,
      String moneyOut,
      String netFlow,
      String currency,
      Instant asOf,
      Instant lastProcessedAt,
      List<Bucket> spendingByCategory) {}

  public record Filter(
      UUID accountId,
      UUID customerId,
      LocalDate from,
      LocalDate toExclusive,
      String category,
      String source,
      String direction,
      String q,
      BigDecimal minAmount,
      BigDecimal maxAmount) {}

  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Africa/Johannesburg");
  private final TransactionRepository repository;
  private final CategoryRepository categories;
  private final AccountAccess accounts;
  private final Clock clock;

  public TransactionQueries(
      TransactionRepository repository,
      CategoryRepository categories,
      AccountAccess accounts,
      Clock clock) {
    this.repository = repository;
    this.categories = categories;
    this.accounts = accounts;
    this.clock = clock;
  }

  public boolean categoryExists(String code) {
    return categories.existsById(code);
  }

  private Scope scope(Filter filter, Authentication auth, Instant cutoff) {
    var accountIds = accounts.scope(filter.accountId(), filter.customerId(), auth);
    // A cursor must retain its original default date range even when paging crosses midnight.
    LocalDate today = cutoff.atZone(BUSINESS_ZONE).toLocalDate();
    LocalDate from = filter.from() == null ? today.minusDays(365) : filter.from();
    LocalDate until = filter.toExclusive() == null ? today.plusDays(1) : filter.toExclusive();
    if (!from.isBefore(until) || java.time.temporal.ChronoUnit.DAYS.between(from, until) > 366) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Date range must be between 1 and 366 days.");
    }
    if (filter.direction() != null
        && !filter.direction().isBlank()
        && !Set.of("DEBIT", "CREDIT").contains(filter.direction())) {
      throw new IllegalArgumentException("Invalid direction");
    }
    if (filter.q() != null && filter.q().length() > 120)
      throw new IllegalArgumentException("Search must be at most 120 characters");
    validateAmount(filter.minAmount());
    validateAmount(filter.maxAmount());
    if (filter.minAmount() != null
        && filter.maxAmount() != null
        && filter.minAmount().compareTo(filter.maxAmount()) > 0)
      throw new IllegalArgumentException("Minimum amount must not exceed maximum amount");
    return new Scope(
        accountIds,
        from.atStartOfDay(BUSINESS_ZONE).toInstant(),
        until.atStartOfDay(BUSINESS_ZONE).toInstant(),
        filter.category(),
        filter.source(),
        filter.direction(),
        filter.q(),
        filter.minAmount(),
        filter.maxAmount(),
        cutoff);
  }

  private void validateAmount(BigDecimal amount) {
    if (amount != null
        && (amount.signum() < 0
            || amount.scale() > 2
            || amount.compareTo(new BigDecimal("99999999999999999.99")) > 0))
      throw new IllegalArgumentException(
          "Amount must be non-negative with at most two decimal places");
  }

  /** Bounded export uses the same authorization and predicates as the interactive reports. */
  public List<Item> exportRows(Filter filter, Authentication auth) {
    List<Item> rows = repository.findPage(scope(filter, auth, clock.instant()), null, null, 10001);
    if (rows.size() > 10000)
      throw new ResponseStatusException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "Narrow your filters: exports are limited to 10,000 transactions.");
    return rows;
  }

  public Page list(Filter filter, int limit, String cursor, Authentication auth) {
    if (limit < 1 || limit > 100)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be between 1 and 100.");
    String fingerprint = Integer.toHexString(Objects.hash(filter, auth.getName()));
    PageCursor position = PageCursor.read(cursor, fingerprint, clock.instant());
    List<Item> found =
        repository.findPage(
            scope(filter, auth, position.asOf()),
            position.afterTime(),
            position.afterId(),
            limit + 1);
    boolean more = found.size() > limit;
    List<Item> items = more ? found.subList(0, limit) : found;
    String next = more ? position.next(items.getLast().occurredAt(), items.getLast().id()) : null;
    return new Page(items, next, position.asOf());
  }

  public Item get(UUID id, Authentication auth) {
    Item result =
        repository
            .findItem(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found."));
    accounts.require(result.accountId(), auth);
    return result;
  }

  @org.springframework.transaction.annotation.Transactional(
      readOnly = true,
      isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public Summary summary(Filter filter, Authentication auth) {
    return repository.summarize(scope(filter, auth, clock.instant()));
  }

  public List<Bucket> breakdown(Filter filter, String grouping, Authentication auth) {
    return repository.groupBy(scope(filter, auth, clock.instant()), grouping);
  }

  public List<Item> getMany(List<UUID> ids, Authentication auth) {
    List<Item> items = repository.findItems(ids);
    Set<UUID> allowedAccounts = new HashSet<>(accounts.scope(null, null, auth));
    return items.stream().filter(item -> allowedAccounts.contains(item.accountId())).toList();
  }
}
