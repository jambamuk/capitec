package dev.financial.app.transactions;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;

class CategorizationTest {
  @Test
  void deterministicKnownAndUnknownCategories() {
    assertThat(
            dev.financial.app.transactions.internal.TransactionCategorizer.fromDescription(
                "DEBIT", "FRESHMART"))
        .isEqualTo("GROCERIES");
    assertThat(
            dev.financial.app.transactions.internal.TransactionCategorizer.fromDescription(
                "DEBIT", "Unknown merchant"))
        .isEqualTo("UNCATEGORIZED");
    assertThat(
            dev.financial.app.transactions.internal.TransactionCategorizer.fromDescription(
                "CREDIT", "Salary"))
        .isEqualTo("INCOME");
  }
}
