package dev.financial.app.fraud.internal;

import static dev.financial.app.fraud.internal.FraudViews.*;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.fraud.internal.persistence.*;
import dev.financial.app.platform.PageCursor;
import dev.financial.app.transactions.TransactionQueries;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
class FraudEvaluationQueries {
  private final TransactionQueries transactions;
  private final AccountAccess accounts;
  private final EvaluationRepository evaluations;
  private final RuleResultRepository results;
  private final ReviewRepository reviews;
  private final ObjectMapper json;
  private final Clock clock;

  FraudEvaluationQueries(
      TransactionQueries transactions,
      AccountAccess accounts,
      EvaluationRepository evaluations,
      RuleResultRepository results,
      ReviewRepository reviews,
      ObjectMapper json,
      Clock clock) {
    this.transactions = transactions;
    this.accounts = accounts;
    this.evaluations = evaluations;
    this.results = results;
    this.reviews = reviews;
    this.json = json;
    this.clock = clock;
  }

  public EvaluationPage list(
      UUID accountId,
      UUID customerId,
      String reviewStatus,
      String severity,
      int limit,
      String cursor,
      LocalDate from,
      LocalDate toExclusive,
      Authentication auth) {
    if (limit < 1
        || limit > 100
        || !Set.of("ALL", "NEEDS_REVIEW", "REVIEWED").contains(reviewStatus))
      throw new IllegalArgumentException("Invalid page size or review status");
    if ((from == null) != (toExclusive == null)
        || (from != null
            && (!from.isBefore(toExclusive) || ChronoUnit.DAYS.between(from, toExclusive) > 366)))
      throw new IllegalArgumentException("Provide a date range of 1 to 366 days");
    if (!Set.of("ALL", "NONE", "LOW", "MEDIUM", "HIGH").contains(severity))
      throw new IllegalArgumentException("Invalid priority");
    var scope = accounts.scope(accountId, customerId, auth);
    String fingerprint =
        Integer.toHexString(
            Objects.hash(
                accountId, customerId, reviewStatus, severity, from, toExclusive, auth.getName()));
    var position = PageCursor.read(cursor, fingerprint, clock.instant());
    if (scope.isEmpty()) return new EvaluationPage(List.of(), null, position.asOf());
    var found =
        evaluations.findPage(
            scope,
            reviewStatus,
            severity,
            from == null ? null : from.atStartOfDay(ZoneId.of("Africa/Johannesburg")).toInstant(),
            toExclusive == null
                ? null
                : toExclusive.atStartOfDay(ZoneId.of("Africa/Johannesburg")).toInstant(),
            position.asOf(),
            position.afterTime(),
            position.afterId(),
            limit + 1);
    boolean hasNext = found.size() > limit;
    var page = hasNext ? found.subList(0, limit) : found;
    String next = hasNext ? position.next(page.getLast().completedAt(), page.getLast().id()) : null;
    return new EvaluationPage(listedTransactions(page, auth), next, position.asOf());
  }

  private List<ListedTransaction> listedTransactions(
      List<EvaluationRecord> page, Authentication auth) {
    if (page.isEmpty()) return List.of();
    var ids = page.stream().map(EvaluationRecord::transactionId).toList();
    var payments =
        transactions.getMany(ids, auth).stream()
            .collect(Collectors.toMap(TransactionQueries.Item::id, Function.identity()));
    var reviewed =
        reviews.findAllByTransactionIds(ids).stream()
            .map(FraudReview::transactionId)
            .collect(Collectors.toSet());
    return page.stream()
        .map(
            row ->
                new ListedTransaction(
                    payments.get(row.transactionId()),
                    row.outcome(),
                    row.severity(),
                    reviewStatus(row, reviewed)))
        .toList();
  }

  private String reviewStatus(EvaluationRecord evaluation, Set<UUID> reviewed) {
    if (reviewed.contains(evaluation.transactionId())) return "REVIEWED";
    return "FLAGGED".equals(evaluation.outcome()) ? "NEEDS_REVIEW" : "NOT_REQUIRED";
  }

  public Evaluation detail(UUID transactionId, Authentication auth) {
    transactions.get(transactionId, auth);
    return evaluations
        .findByTransactionId(transactionId)
        .map(this::detail)
        .orElseGet(
            () ->
                new Evaluation(
                    transactionId,
                    "PENDING",
                    null,
                    "NONE",
                    "NONE",
                    "PENDING",
                    null,
                    null,
                    List.of(),
                    null));
  }

  private Evaluation detail(EvaluationRecord evaluation) {
    var evidence =
        results.findByEvaluationId(evaluation.id()).stream().map(this::evidence).toList();
    boolean missingFacts =
        evidence.stream().anyMatch(rule -> "INSUFFICIENT_DATA".equals(rule.result()));
    return new Evaluation(
        evaluation.transactionId(),
        evaluation.outcome(),
        evaluation.rulesetVersion(),
        evaluation.severity(),
        "FLAGGED".equals(evaluation.outcome()) ? "REVIEW" : "NONE",
        missingFacts ? "PARTIAL" : "COMPLETE",
        evaluation.completedAt(),
        evaluation.evidenceAsOf(),
        evidence,
        reviews.findById(evaluation.transactionId()).orElse(null));
  }

  private RuleResult evidence(RuleResultRecord row) {
    try {
      return new RuleResult(
          row.ruleCode(),
          row.ruleVersion(),
          row.result(),
          json.readTree(row.criteriaSnapshot()),
          json.readTree(row.observedValues()),
          row.explanation());
    } catch (JsonProcessingException invalidStoredEvidence) {
      throw new IllegalStateException("Unreadable stored rule evidence", invalidStoredEvidence);
    }
  }
}
