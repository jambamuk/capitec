package dev.financial.app.statements.internal;

import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class RequestLimiter {
  private final Clock clock;
  private final ConcurrentHashMap<String, Window> requests = new ConcurrentHashMap<>();

  private record Window(long minute, int count) {}

  public RequestLimiter(Clock clock) {
    this.clock = clock;
  }

  public void removeExpired() {
    long minute = clock.instant().getEpochSecond() / 60;
    requests.entrySet().removeIf(entry -> entry.getValue().minute() < minute);
  }

  public void check(String key, int max) {
    long minute = clock.instant().getEpochSecond() / 60;
    if (requests.size() > 10000 && !requests.containsKey(key))
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Try again later.");
    Window w =
        requests.compute(
            key,
            (k, v) -> new Window(minute, v == null || v.minute() != minute ? 1 : v.count() + 1));
    if (w.count() > max)
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Try again later.");
  }
}
