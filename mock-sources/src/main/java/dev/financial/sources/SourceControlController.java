package dev.financial.sources;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/control")
class SourceControlController {
  record Change(boolean paused, long intervalMs) {}

  private final SourcePublisher publisher;
  private final String key;

  SourceControlController(SourcePublisher publisher, @Value("${MOCK_CONTROL_KEY}") String key) {
    this.publisher = publisher;
    this.key = key;
    if (key.length() < 24)
      throw new IllegalArgumentException("Mock control key must have at least 24 characters");
  }

  @GetMapping
  SourcePublisher.State state(
      @RequestHeader(value = "X-Mock-Control-Key", defaultValue = "") String supplied) {
    authorize(supplied);
    return publisher.state();
  }

  @PutMapping
  SourcePublisher.State configure(
      @RequestHeader(value = "X-Mock-Control-Key", defaultValue = "") String supplied,
      @RequestBody Change change) {
    authorize(supplied);
    return publisher.configure(change.paused(), change.intervalMs());
  }

  private void authorize(String supplied) {
    if (!MessageDigest.isEqual(
        key.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8)))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }
}
