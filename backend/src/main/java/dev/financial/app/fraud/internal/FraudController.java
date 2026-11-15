package dev.financial.app.fraud.internal;

import dev.financial.app.fraud.internal.persistence.FraudReview;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
class FraudController {
  record ReviewRequest(@NotBlank @Size(max = 1000) String note, ReviewOutcome outcome) {}

  private final FraudEvaluationQueries queries;

  private final FraudReviewService reviews;

  FraudController(FraudEvaluationQueries queries, FraudReviewService reviews) {
    this.reviews = reviews;
    this.queries = queries;
  }

  @GetMapping("/fraud-evaluations")
  FraudViews.EvaluationPage list(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(required = false) UUID customerId,
      @RequestParam(defaultValue = "ALL") String reviewStatus,
      @RequestParam(defaultValue = "ALL") String severity,
      @RequestParam(defaultValue = "25") int limit,
      @RequestParam(required = false) String cursor,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      Authentication auth) {
    return queries.list(
        accountId, customerId, reviewStatus, severity, limit, cursor, from, toExclusive, auth);
  }

  @GetMapping("/transactions/{id}/fraud-evaluation")
  FraudViews.Evaluation detail(@PathVariable UUID id, Authentication auth) {
    return queries.detail(id, auth);
  }

  @PostMapping("/transactions/{id}/fraud-review")
  FraudReview review(
      @PathVariable UUID id, @Valid @RequestBody ReviewRequest request, Authentication auth) {
    return reviews.review(id, request.note(), request.outcome(), auth);
  }
}
