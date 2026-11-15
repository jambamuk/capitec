package dev.financial.app.transactions.internal;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.transactions.TransactionQueries;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
class TransactionExport {
  private final TransactionQueries transactions;
  private final AccountAccess accounts;

  TransactionExport(TransactionQueries transactions, AccountAccess accounts) {
    this.transactions = transactions;
    this.accounts = accounts;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public byte[] export(TransactionQueries.Filter filter, Authentication auth) {
    var rows = transactions.exportRows(filter, auth);
    var visible =
        accounts.visible(auth).stream()
            .collect(Collectors.toMap(AccountAccess.Account::id, Function.identity()));
    StringBuilder csv = new StringBuilder();
    append(
        csv,
        "Date (UTC)",
        "Customer",
        "Account",
        "Description",
        "Reference",
        "Source",
        "Category",
        "Direction",
        "Amount",
        "Currency");
    for (var row : rows) {
      var account = visible.get(row.accountId());
      String reference =
          row.payment() != null && row.payment().paymentReference() != null
              ? row.payment().paymentReference()
              : row.sourceTransactionId();
      append(
          csv,
          row.occurredAt().toString(),
          account.customerName(),
          account.maskedNumber(),
          row.description(),
          reference,
          row.source(),
          row.category(),
          row.direction(),
          row.amount(),
          row.currency());
    }
    return csv.toString().getBytes(StandardCharsets.UTF_8);
  }

  private static void append(StringBuilder csv, String... fields) {
    csv.append(Arrays.stream(fields).map(TransactionExport::cell).collect(Collectors.joining(",")))
        .append("\r\n");
  }

  /** Quote CSV syntax and prevent spreadsheet programs from evaluating user-supplied formulas. */
  static String cell(String value) {
    String text = value == null ? "" : value;
    String stripped = text.stripLeading();
    if (!stripped.isEmpty() && "=+-@".indexOf(stripped.charAt(0)) >= 0
        || text.startsWith("\t")
        || text.startsWith("\r")
        || text.startsWith("\n")) {
      text = "'" + text;
    }
    return "\"" + text.replace("\"", "\"\"") + "\"";
  }
}
