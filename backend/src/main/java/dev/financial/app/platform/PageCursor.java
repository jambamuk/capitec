package dev.financial.app.platform;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/** Opaque keyset position. Authorization is always checked separately by the owning module. */
public record PageCursor(Instant afterTime, UUID afterId, Instant asOf, String scope) {
  public static PageCursor read(String encoded, String scope, Instant now) {
    if (encoded == null || encoded.isBlank()) return new PageCursor(null, null, now, scope);
    try {
      if (encoded.length() > 1000) throw new IllegalArgumentException("Cursor is too long");
      String[] parts =
          new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8)
              .split("\\|", -1);
      if (parts.length != 4 || !parts[3].equals(scope))
        throw new IllegalArgumentException("Cursor does not match the request");
      Instant cutoff = Instant.parse(parts[2]);
      if (cutoff.isAfter(now)) throw new IllegalArgumentException("Cursor cutoff is in the future");
      return new PageCursor(Instant.parse(parts[0]), UUID.fromString(parts[1]), cutoff, scope);
    } catch (RuntimeException invalid) {
      throw new IllegalArgumentException("Invalid cursor for these filters", invalid);
    }
  }

  public String next(Instant time, UUID id) {
    String value = time + "|" + id + "|" + asOf + "|" + scope;
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }
}
