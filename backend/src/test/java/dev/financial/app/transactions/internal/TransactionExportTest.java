package dev.financial.app.transactions.internal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TransactionExportTest {
  @Test
  void quotesCsvSyntaxWithoutLosingPaymentText() {
    assertThat(TransactionExport.cell("Shop, \"Cape Town\"\nReceipt"))
        .isEqualTo("\"Shop, \"\"Cape Town\"\"\nReceipt\"");
    assertThat(TransactionExport.cell("123.45")).isEqualTo("\"123.45\"");
    assertThat(TransactionExport.cell(null)).isEqualTo("\"\"");
  }

  @Test
  void neutralizesFormulaPrefixesIncludingLeadingWhitespace() {
    for (String value :
        new String[] {
          "=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1+1", "\t123", "\r123", "\n123"
        }) {
      assertThat(TransactionExport.cell(value)).startsWith("\"'");
    }
  }
}
