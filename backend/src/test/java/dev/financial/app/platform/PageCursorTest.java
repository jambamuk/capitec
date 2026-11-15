package dev.financial.app.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PageCursorTest {
  private final Instant now = Instant.parse("2026-11-10T10:00:00Z");
  private final UUID id = UUID.randomUUID();

  @Test
  void subsequentPagesKeepTheirOriginalCutoff() {
    var first = PageCursor.read(null, "scope", now);
    var next = PageCursor.read(first.next(now.minusSeconds(10), id), "scope", now.plusSeconds(60));
    assertThat(next).isEqualTo(new PageCursor(now.minusSeconds(10), id, now, "scope"));
  }

  @Test
  void malformedTimestampIsARequestErrorInsteadOfAnUnhandledDateTimeException() {
    String cursor = encode("invalid-date|" + id + "|" + now + "|scope");
    assertThatThrownBy(() -> PageCursor.read(cursor, "scope", now))
        .isExactlyInstanceOf(IllegalArgumentException.class)
        .hasMessage("Invalid cursor for these filters");
  }

  @Test
  void changedScopeAndFutureCutoffAreRejected() {
    String cursor = new PageCursor(null, null, now, "account-one").next(now, id);
    assertThatThrownBy(() -> PageCursor.read(cursor, "account-two", now))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> PageCursor.read(cursor, "account-one", now.minusSeconds(1)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private String encode(String value) {
    return Base64.getUrlEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }
}
