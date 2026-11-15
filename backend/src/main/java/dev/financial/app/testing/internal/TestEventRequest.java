package dev.financial.app.testing.internal;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

record TestEventRequest(
    @NotNull UUID requestId,
    @NotNull UUID accountId,
    @NotNull MockSources.Source source,
    @NotBlank @Pattern(regexp = "[0-9]{1,17}(\\.[0-9]{1,2})?") String amount,
    @NotBlank @Size(max = 200) String description,
    @NotNull Direction direction,
    @NotNull PaymentType type,
    @NotNull Channel channel,
    @NotNull Instant occurredAt,
    @Min(1) @Max(20) int count,
    @Min(0) @Max(3600) int spacingSeconds,
    @Size(max = 200) String merchant,
    @Pattern(regexp = "[0-9]{4}") String merchantCategory,
    @Pattern(regexp = "[A-Z]{2}") String country,
    @Size(max = 200) String beneficiary,
    @Min(0) @Max(525600) int beneficiaryAgeMinutes) {
  enum Direction {
    DEBIT,
    CREDIT
  }

  enum PaymentType {
    CARD_PURCHASE,
    TRANSFER
  }

  enum Channel {
    POS,
    ECOMMERCE,
    MOBILE,
    ONLINE,
    ATM,
    BRANCH
  }
}
