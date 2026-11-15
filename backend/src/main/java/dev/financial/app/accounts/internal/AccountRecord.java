package dev.financial.app.accounts.internal;

import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("account")
public record AccountRecord(@Id UUID id, UUID customerId, String maskedNumber, String currency) {}
