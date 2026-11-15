package dev.financial.app.transactions.internal;

import dev.financial.app.transactions.TransactionQueries.Bucket;
import dev.financial.app.transactions.TransactionQueries.Item;
import dev.financial.app.transactions.TransactionQueries.Summary;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionReports {
  record Scope(
      List<UUID> accountIds,
      Instant from,
      Instant toExclusive,
      String category,
      String source,
      String direction,
      String q,
      java.math.BigDecimal minAmount,
      java.math.BigDecimal maxAmount,
      Instant asOf) {}

  List<Item> findPage(Scope scope, Instant afterTime, UUID afterId, int limit);

  Optional<Item> findItem(UUID id);

  List<Item> findItems(List<UUID> ids);

  Summary summarize(Scope scope);

  List<Bucket> groupBy(Scope scope, String grouping);
}
