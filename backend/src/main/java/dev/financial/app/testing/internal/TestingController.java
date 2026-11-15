package dev.financial.app.testing.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Profile("demo")
@RequestMapping("/api/v1/testing")
class TestingController {
  record StreamChange(boolean paused, @Min(500) @Max(60000) long intervalMs) {}

  record ResetRequest(@NotBlank String confirmation) {}

  private final TestingService service;

  TestingController(TestingService service) {
    this.service = service;
  }

  @GetMapping("/sources")
  List<MockSources.State> sources() {
    return service.sources();
  }

  @PutMapping("/sources")
  List<MockSources.State> configure(@Valid @RequestBody StreamChange request) {
    return service.configure(request.paused(), request.intervalMs());
  }

  @PostMapping("/events")
  @ResponseStatus(HttpStatus.ACCEPTED)
  TestingService.Receipt publish(@Valid @RequestBody TestEventRequest request, Authentication auth)
      throws Exception {
    return service.publish(request, auth);
  }

  @GetMapping("/events/{requestId}")
  List<TestingRepository.Result> results(@PathVariable UUID requestId) {
    return service.results(requestId);
  }

  @PostMapping("/reset")
  TestingService.ResetResult reset(@Valid @RequestBody ResetRequest request, Authentication auth)
      throws Exception {
    if (!"RESET ALL TRANSACTIONS".equals(request.confirmation()))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Confirm the reset before continuing.");
    return service.reset(auth.getName());
  }
}
