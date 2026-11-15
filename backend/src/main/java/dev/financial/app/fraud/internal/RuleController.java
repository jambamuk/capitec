package dev.financial.app.fraud.internal;

import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/fraud-rules")
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
class RuleController {
  private final RuleConfiguration rules;

  RuleController(RuleConfiguration rules) {
    this.rules = rules;
  }

  @GetMapping
  RuleConfiguration.Snapshot current(Authentication auth) {
    requireOperator(auth);
    return rules.current();
  }

  @GetMapping("/{version}")
  RuleConfiguration.Snapshot version(@PathVariable long version, Authentication auth) {
    requireOperator(auth);
    return rules.version(version);
  }

  @PutMapping
  RuleConfiguration.Snapshot save(
      @Valid @RequestBody RuleConfiguration.Change change, Authentication auth) throws Exception {
    requireOperator(auth);
    return rules.save(change, auth.getName());
  }

  private static void requireOperator(Authentication auth) {
    if (auth.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_OPERATOR")))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Only operators can manage fraud rules.");
  }
}
