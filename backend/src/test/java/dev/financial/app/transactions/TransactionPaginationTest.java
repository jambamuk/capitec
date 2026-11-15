package dev.financial.app.transactions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.platform.PageCursor;
import dev.financial.app.transactions.internal.CategoryRepository;
import dev.financial.app.transactions.internal.TransactionReports.Scope;
import dev.financial.app.transactions.internal.TransactionRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.TestingAuthenticationToken;

class TransactionPaginationTest {
  @Test
  void defaultDateRangeDoesNotChangeWhenFollowingACursorAfterMidnight() {
    var repository = mock(TransactionRepository.class);
    var accounts = mock(AccountAccess.class);
    var categories = mock(CategoryRepository.class);
    var auth = new TestingAuthenticationToken("amina", "unused");
    var filter =
        new TransactionQueries.Filter(null, null, null, null, null, null, null, null, null, null);
    var beforeMidnight = Instant.parse("2026-11-10T21:59:00Z");
    var afterMidnight = beforeMidnight.plusSeconds(120);
    var fingerprint = Integer.toHexString(Objects.hash(filter, auth.getName()));
    String cursor =
        new PageCursor(null, null, beforeMidnight, fingerprint)
            .next(beforeMidnight.minusSeconds(30), UUID.randomUUID());
    when(accounts.scope(null, null, auth)).thenReturn(List.of(UUID.randomUUID()));
    when(repository.findPage(any(), any(), any(), anyInt())).thenReturn(List.of());
    var queries =
        new TransactionQueries(
            repository, categories, accounts, Clock.fixed(afterMidnight, ZoneOffset.UTC));

    queries.list(filter, 25, cursor, auth);

    var scope = ArgumentCaptor.forClass(Scope.class);
    verify(repository).findPage(scope.capture(), any(), any(), eq(26));
    assertThat(scope.getValue().toExclusive()).isEqualTo(Instant.parse("2026-11-10T22:00:00Z"));
    assertThat(scope.getValue().asOf()).isEqualTo(beforeMidnight);
  }
}
