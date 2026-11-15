package dev.financial.app.overview.internal;

import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
class OverviewController {
  private final OverviewService overview;

  OverviewController(OverviewService overview) {
    this.overview = overview;
  }

  @GetMapping("/api/v1/overview")
  OverviewService.Overview read(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(defaultValue = "7") int days,
      Authentication auth) {
    return overview.read(accountId, days, auth);
  }
}
