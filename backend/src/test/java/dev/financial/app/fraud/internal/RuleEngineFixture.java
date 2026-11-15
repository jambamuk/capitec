package dev.financial.app.fraud.internal;

import dev.financial.app.fraud.internal.rules.*;
import java.util.List;

final class RuleEngineFixture {
  static FraudRules engine() {
    return new FraudRules(
        List.of(
            new AmountRule(),
            new MerchantRule(),
            new CategoryRule(),
            new VelocityRule(),
            new NewBeneficiaryRule(),
            new ForeignOnlineRule()));
  }
}
