package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class ForeignOnlineRule implements FraudRuleEvaluator {
  public Set<Type> supportedTypes() {
    return Set.of(Type.FOREIGN_ONLINE_PAYMENT);
  }

  public RuleCheck evaluate(RuleContext context, Rule rule) {
    var payment = context.payment();
    if (payment == null)
      return RuleCheck.skipped(
          RuleCheck.Outcome.INSUFFICIENT_DATA, "Source did not supply payment context.");
    if (!"CARD_PURCHASE".equals(payment.type()) || !"ECOMMERCE".equals(payment.channel()))
      return RuleCheck.skipped(
          RuleCheck.Outcome.NOT_APPLICABLE, "Only online card purchases are considered.");
    String country = payment.merchant().country();
    boolean matches = !rule.matchValue().equals(country) && context.amountExceeds(rule);
    var observations =
        Map.<String, Object>of(
            "merchantCountry",
            country,
            "channel",
            payment.channel(),
            "authentication",
            payment.instrument().authentication());
    String explanation =
        "Online purchase in "
            + country
            + " for ZAR "
            + context.event().amount().toPlainString()
            + ". "
            + (matches
                ? "Foreign country and amount conditions both matched."
                : "Combined conditions not met.");
    return RuleCheck.matched(matches, explanation, observations);
  }
}
