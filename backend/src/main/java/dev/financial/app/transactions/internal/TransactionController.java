package dev.financial.app.transactions.internal;

import dev.financial.app.transactions.TransactionQueries;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class TransactionController {
  private final TransactionQueries queries;
  private final CategoryRepository categories;
  private final TransactionExport exporter;

  TransactionController(
      TransactionQueries queries, CategoryRepository categories, TransactionExport exporter) {
    this.queries = queries;
    this.exporter = exporter;
    this.categories = categories;
  }

  @GetMapping("/transactions")
  TransactionQueries.Page list(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(required = false) UUID customerId,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String source,
      @RequestParam(required = false) String direction,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) BigDecimal minAmount,
      @RequestParam(required = false) BigDecimal maxAmount,
      @RequestParam(defaultValue = "25") int limit,
      @RequestParam(required = false) String cursor,
      Authentication auth) {
    return queries.list(
        new TransactionQueries.Filter(
            accountId,
            customerId,
            from,
            toExclusive,
            category,
            source,
            direction,
            q,
            minAmount,
            maxAmount),
        limit,
        cursor,
        auth);
  }

  @GetMapping(value = "/transactions/export", produces = "text/csv")
  ResponseEntity<byte[]> export(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(required = false) UUID customerId,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String source,
      @RequestParam(required = false) String direction,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) BigDecimal minAmount,
      @RequestParam(required = false) BigDecimal maxAmount,
      Authentication auth) {
    var filter =
        new TransactionQueries.Filter(
            accountId,
            customerId,
            from,
            toExclusive,
            category,
            source,
            direction,
            q,
            minAmount,
            maxAmount);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=transactions.csv")
        .body(exporter.export(filter, auth));
  }

  @GetMapping("/transactions/{id}")
  TransactionQueries.Item get(@PathVariable UUID id, Authentication auth) {
    return queries.get(id, auth);
  }

  @GetMapping("/transaction-summary")
  TransactionQueries.Summary summary(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(required = false) UUID customerId,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String source,
      @RequestParam(required = false) String direction,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) BigDecimal minAmount,
      @RequestParam(required = false) BigDecimal maxAmount,
      Authentication auth) {
    return queries.summary(
        new TransactionQueries.Filter(
            accountId,
            customerId,
            from,
            toExclusive,
            category,
            source,
            direction,
            q,
            minAmount,
            maxAmount),
        auth);
  }

  @GetMapping("/customers/{id}/transaction-summary")
  TransactionQueries.Summary customerSummary(
      @PathVariable UUID id,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      Authentication auth) {
    return queries.summary(
        new TransactionQueries.Filter(
            null, id, from, toExclusive, null, null, null, null, null, null),
        auth);
  }

  @GetMapping("/accounts/{id}/transaction-summary")
  TransactionQueries.Summary accountSummary(
      @PathVariable UUID id,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      Authentication auth) {
    return queries.summary(
        new TransactionQueries.Filter(
            id, null, from, toExclusive, null, null, null, null, null, null),
        auth);
  }

  record Breakdown(String currency, String groupBy, List<TransactionQueries.Bucket> items) {}

  @GetMapping("/breakdowns")
  Breakdown breakdown(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(required = false) UUID customerId,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate toExclusive,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String source,
      @RequestParam(required = false) String direction,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) BigDecimal minAmount,
      @RequestParam(required = false) BigDecimal maxAmount,
      @RequestParam(defaultValue = "CATEGORY") String groupBy,
      Authentication auth) {
    return new Breakdown(
        "ZAR",
        groupBy,
        queries.breakdown(
            new TransactionQueries.Filter(
                accountId,
                customerId,
                from,
                toExclusive,
                category,
                source,
                direction,
                q,
                minAmount,
                maxAmount),
            groupBy,
            auth));
  }

  @GetMapping("/categories")
  Map<String, Object> categories() {
    return Map.of("items", categories.findAll());
  }
}
