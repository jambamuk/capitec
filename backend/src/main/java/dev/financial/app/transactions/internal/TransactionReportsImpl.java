package dev.financial.app.transactions.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.transactions.PaymentDetails;
import dev.financial.app.transactions.TransactionQueries.Bucket;
import dev.financial.app.transactions.TransactionQueries.Item;
import dev.financial.app.transactions.TransactionQueries.Summary;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.server.ResponseStatusException;

/** Spring Data repository fragment for parameterized, dynamic reporting queries. */
class TransactionReportsImpl implements TransactionReports {
  private static final String JOIN =
      """
      from financial_transaction t
      join source_account s on s.id = t.source_account_id
      join account a on a.id = s.account_id
      """;
  private final JdbcClient jdbc;
  private final ObjectMapper json;

  TransactionReportsImpl(JdbcClient jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  private record Predicate(String where, Map<String, Object> params) {}

  private Predicate where(Scope scope) {
    Map<String, Object> parameters = new HashMap<>();
    parameters.put(
        "accounts", scope.accountIds().isEmpty() ? List.of(new UUID(0, 0)) : scope.accountIds());
    parameters.put("from", Timestamp.from(scope.from()));
    parameters.put("to", Timestamp.from(scope.toExclusive()));
    parameters.put("asOf", Timestamp.from(scope.asOf()));
    StringBuilder sql =
        new StringBuilder(
            """
        where s.account_id in (:accounts)
          and t.occurred_at >= :from and t.occurred_at < :to and t.recorded_at <= :asOf
        """);
    addFilter(sql, parameters, "t.category_code", "category", scope.category());
    addFilter(sql, parameters, "s.source_code", "source", scope.source());
    addFilter(sql, parameters, "t.direction", "direction", scope.direction());
    if (scope.q() != null && !scope.q().isBlank()) {
      sql.append(' ');
      sql.append(
          """
          and (position(lower(:search) in lower(t.description)) > 0
            or position(lower(:search) in lower(t.source_transaction_ref)) > 0
            or position(lower(:search) in lower(t.payment_details->>'paymentReference')) > 0)
          """);
      parameters.put("search", scope.q().strip());
    }
    if (scope.minAmount() != null) {
      sql.append(" and t.amount >= :minAmount");
      parameters.put("minAmount", scope.minAmount());
    }
    if (scope.maxAmount() != null) {
      sql.append(" and t.amount <= :maxAmount");
      parameters.put("maxAmount", scope.maxAmount());
    }
    return new Predicate(sql.toString(), parameters);
  }

  private void addFilter(
      StringBuilder sql, Map<String, Object> parameters, String column, String name, String value) {
    if (value != null && !value.isBlank()) {
      sql.append(" and ").append(column).append(" = :").append(name);
      parameters.put(name, value);
    }
  }

  @Override
  public List<Item> findPage(Scope scope, Instant afterTime, UUID afterId, int limit) {
    Predicate predicate = where(scope);
    String sql = predicate.where();
    if (afterTime != null) {
      sql += " and (t.occurred_at, t.id) < (:afterTime, :afterId)";
      predicate.params().put("afterTime", Timestamp.from(afterTime));
      predicate.params().put("afterId", afterId);
    }
    predicate.params().put("limit", limit);
    return jdbc.sql(
            "select t.*, s.account_id, s.source_code, a.customer_id "
                + JOIN
                + sql
                + " order by t.occurred_at desc, t.id desc limit :limit")
        .params(predicate.params())
        .query(this::item)
        .list();
  }

  @Override
  public Optional<Item> findItem(UUID id) {
    return jdbc.sql(
            "select t.*, s.account_id, s.source_code, a.customer_id " + JOIN + " where t.id=:id")
        .param("id", id)
        .query(this::item)
        .optional();
  }

  @Override
  public List<Item> findItems(List<UUID> ids) {
    if (ids.isEmpty()) return List.of();
    return jdbc.sql(
            "select t.*, s.account_id, s.source_code, a.customer_id "
                + JOIN
                + " where t.id in (:ids)")
        .param("ids", ids)
        .query(this::item)
        .list();
  }

  private Item item(ResultSet resultSet, int row) throws SQLException {
    PaymentDetails payment;
    try {
      String stored = resultSet.getString("payment_details");
      payment = stored == null ? null : json.readValue(stored, PaymentDetails.class);
    } catch (Exception ex) {
      throw new SQLException("Unreadable payment context", ex);
    }
    return new Item(
        resultSet.getObject("id", UUID.class),
        resultSet.getObject("account_id", UUID.class),
        resultSet.getObject("customer_id", UUID.class),
        resultSet.getString("description"),
        resultSet.getString("source_code"),
        resultSet.getString("source_transaction_ref"),
        resultSet.getBigDecimal("amount").toPlainString(),
        resultSet.getString("currency"),
        resultSet.getString("direction"),
        resultSet.getString("category_code"),
        resultSet.getTimestamp("occurred_at").toInstant(),
        resultSet.getTimestamp("recorded_at").toInstant(),
        resultSet.getString("categorizer_version"),
        payment);
  }

  @Override
  public Summary summarize(Scope scope) {
    Predicate predicate = where(scope);
    return jdbc.sql(
            """
            select count(*) count,coalesce(sum(amount) filter(where direction='CREDIT'),0) income,
            coalesce(sum(amount) filter(where direction='DEBIT'),0) expenses,max(recorded_at) last
            """
                + JOIN
                + predicate.where())
        .params(predicate.params())
        .query(
            (resultSet, n) -> {
              BigDecimal moneyIn = resultSet.getBigDecimal("income").setScale(2);
              BigDecimal moneyOut = resultSet.getBigDecimal("expenses").setScale(2);
              Timestamp last = resultSet.getTimestamp("last");
              return new Summary(
                  resultSet.getLong("count"),
                  moneyIn.toPlainString(),
                  moneyOut.toPlainString(),
                  moneyIn.subtract(moneyOut).toPlainString(),
                  "ZAR",
                  scope.asOf(),
                  last == null ? null : last.toInstant(),
                  buckets(predicate, "t.category_code"));
            })
        .single();
  }

  @Override
  public List<Bucket> groupBy(Scope scope, String grouping) {
    String expression =
        switch (grouping) {
          case "CATEGORY" -> "t.category_code";
          case "MERCHANT" -> "coalesce(t.payment_details->'merchant'->>'name', t.description)";
          case "SOURCE" -> "s.source_code";
          case "ACCOUNT" -> "a.id::text";
          case "DAY" -> "to_char(t.occurred_at at time zone 'Africa/Johannesburg','YYYY-MM-DD')";
          case "MONTH" -> "to_char(t.occurred_at at time zone 'Africa/Johannesburg','YYYY-MM')";
          default -> throw new IllegalArgumentException("Unknown grouping");
        };
    return buckets(where(scope), expression);
  }

  private List<Bucket> buckets(Predicate predicate, String expression) {
    var rows =
        jdbc.sql(
                "select "
                    + expression
                    + " name,count(*) count,coalesce(sum(amount) filter(where direction='CREDIT'),0) income,"
                    + "coalesce(sum(amount) filter(where direction='DEBIT'),0) expenses "
                    + JOIN
                    + predicate.where()
                    + " group by "
                    + expression
                    + " order by "
                    + expression
                    + " limit 1001")
            .params(predicate.params())
            .query(
                (resultSet, n) ->
                    new Bucket(
                        resultSet.getString("name"),
                        resultSet.getLong("count"),
                        resultSet.getBigDecimal("income").setScale(2).toPlainString(),
                        resultSet.getBigDecimal("expenses").setScale(2).toPlainString()))
            .list();
    if (rows.size() > 1000)
      throw new ResponseStatusException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "Narrow the date range: this breakdown exceeds 1,000 groups.");
    return rows;
  }
}
