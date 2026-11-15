package dev.financial.app.transactions;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.transactions.internal.CategoryRepository;
import dev.financial.app.transactions.internal.TransactionRepository;
import java.time.Clock;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

class TransactionExportLimitTest {
  @Test
  void rejectsOversizedExportsInsteadOfSilentlyTruncating() {
    var repository = mock(TransactionRepository.class);
    var accounts = mock(AccountAccess.class);
    var auth = new TestingAuthenticationToken("amina", "unused");
    when(accounts.scope(null, null, auth)).thenReturn(List.of(UUID.randomUUID()));
    when(repository.findPage(any(), isNull(), isNull(), eq(10001)))
        .thenReturn(Collections.nCopies(10001, null));
    var queries =
        new TransactionQueries(
            repository, mock(CategoryRepository.class), accounts, Clock.systemUTC());
    var filter =
        new TransactionQueries.Filter(null, null, null, null, null, null, null, null, null, null);
    assertThatThrownBy(() -> queries.exportRows(filter, auth))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("10,000");
  }
}
