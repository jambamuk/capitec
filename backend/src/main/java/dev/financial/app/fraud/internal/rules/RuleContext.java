package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.transactions.CategorizedTransaction;
import dev.financial.app.transactions.PaymentDetails;
import dev.financial.app.transactions.TransactionHistory.Window;
import java.math.BigDecimal;
import java.util.function.Function;

public record RuleContext(
    CategorizedTransaction event, PaymentDetails payment, Function<Rule, Window> history) {
  public String merchantName() {
    return payment != null && payment.merchant() != null
        ? payment.merchant().name()
        : event.description();
  }

  public boolean amountExceeds(Rule rule) {
    return event.amount().compareTo(new BigDecimal(rule.amount())) > 0;
  }
}
