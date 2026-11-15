package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class NewBeneficiaryRule implements FraudRuleEvaluator {
  public Set<Type> supportedTypes() {
    return Set.of(Type.NEW_BENEFICIARY_PAYMENT);
  }

  public RuleCheck evaluate(RuleContext context, Rule rule) {
    var payment = context.payment();
    if (payment == null)
      return RuleCheck.skipped(
          RuleCheck.Outcome.INSUFFICIENT_DATA, "Source did not supply payment context.");
    if (!"TRANSFER".equals(payment.type()))
      return RuleCheck.skipped(
          RuleCheck.Outcome.NOT_APPLICABLE, "Only outgoing transfers are considered.");
    var beneficiary = payment.counterparty();
    if (beneficiary.beneficiaryCreatedAt() == null)
      return RuleCheck.skipped(
          RuleCheck.Outcome.INSUFFICIENT_DATA, "Beneficiary creation time was not supplied.");
    long ageSeconds =
        Duration.between(beneficiary.beneficiaryCreatedAt(), context.event().occurredAt())
            .getSeconds();
    boolean recent = ageSeconds >= 0 && ageSeconds <= rule.windowMinutes() * 60L;
    boolean matches = recent && context.amountExceeds(rule);
    var observations =
        Map.<String, Object>of(
            "beneficiaryId",
            beneficiary.id(),
            "beneficiaryCreatedAt",
            beneficiary.beneficiaryCreatedAt().toString(),
            "beneficiaryAgeSeconds",
            ageSeconds);
    String explanation =
        "Beneficiary age "
            + ageSeconds
            + " seconds; amount ZAR "
            + context.event().amount().toPlainString()
            + ". "
            + (matches
                ? "Recent beneficiary and amount conditions both matched."
                : "Combined conditions not met.");
    return RuleCheck.matched(matches, explanation, observations);
  }
}
