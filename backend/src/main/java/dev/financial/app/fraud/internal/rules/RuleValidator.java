package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Change;
import dev.financial.app.fraud.internal.RuleConfiguration.Direction;
import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import dev.financial.app.transactions.TransactionQueries;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class RuleValidator {
  private final TransactionQueries transactions;

  public RuleValidator(TransactionQueries transactions) {
    this.transactions = transactions;
  }

  public List<Rule> normalize(Change change) {
    Set<String> codes = new HashSet<>();
    List<Rule> normalized = new ArrayList<>();
    for (Rule rule : change.rules()) {
      if (!codes.add(rule.code())) throw invalid("Rule codes must be unique.");
      validateRequiredFields(rule);
      normalized.add(
          new Rule(
              rule.code(),
              rule.name().strip(),
              rule.type(),
              rule.enabled(),
              rule.direction(),
              normalizedAmount(rule),
              normalizedMatchValue(rule),
              needsWindow(rule.type()) ? rule.windowMinutes() : null,
              rule.type() == Type.VELOCITY_COUNT ? rule.countThreshold() : null,
              rule.severity()));
    }

    return List.copyOf(normalized);
  }

  private void validateRequiredFields(Rule rule) {
    if (needsWindow(rule.type()) && rule.windowMinutes() == null)
      throw invalid("This condition requires a window in minutes.");
    if (rule.type() == Type.VELOCITY_COUNT && rule.countThreshold() == null)
      throw invalid("Velocity requires a transaction count threshold.");
    if (Set.of(Type.NEW_BENEFICIARY_PAYMENT, Type.FOREIGN_ONLINE_PAYMENT).contains(rule.type())
        && rule.direction() != Direction.DEBIT)
      throw invalid("Payment risk conditions require DEBIT direction.");
  }

  private String normalizedAmount(Rule rule) {
    boolean needsAmount =
        switch (rule.type()) {
          case AMOUNT_GREATER_THAN,
                  VELOCITY_AMOUNT,
                  NEW_BENEFICIARY_PAYMENT,
                  FOREIGN_ONLINE_PAYMENT ->
              true;
          default -> false;
        };
    if (!needsAmount) return null;
    if (rule.amount() == null) throw invalid("Amount rules require a threshold.");
    BigDecimal number = new BigDecimal(rule.amount()).setScale(2);
    if (number.signum() <= 0 || number.precision() > 19)
      throw invalid("Threshold must be positive and fit NUMERIC(19,2).");
    return number.toPlainString();
  }

  private String normalizedMatchValue(Rule rule) {
    if (!Set.of(Type.MERCHANT_EQUALS, Type.CATEGORY_EQUALS, Type.FOREIGN_ONLINE_PAYMENT)
        .contains(rule.type())) return null;
    if (rule.matchValue() == null || rule.matchValue().isBlank())
      throw invalid("This condition requires a comparison value.");
    String value = rule.matchValue().strip();
    if (rule.type() == Type.FOREIGN_ONLINE_PAYMENT
        && !Set.of(Locale.getISOCountries()).contains(value))
      throw invalid("Home country must be a two-letter ISO country code, such as ZA.");
    if (rule.type() == Type.CATEGORY_EQUALS && !transactions.categoryExists(value))
      throw invalid("Choose an existing category code.");
    return value;
  }

  private boolean needsWindow(Type type) {
    return Set.of(Type.VELOCITY_COUNT, Type.VELOCITY_AMOUNT, Type.NEW_BENEFICIARY_PAYMENT)
        .contains(type);
  }

  private static ResponseStatusException invalid(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
