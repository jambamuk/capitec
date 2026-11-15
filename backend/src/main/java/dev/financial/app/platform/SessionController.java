package dev.financial.app.platform;

import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
class SessionController {
  private final org.springframework.core.env.Environment environment;
  private final AppProperties properties;

  SessionController(
      AppProperties properties, org.springframework.core.env.Environment environment) {
    this.properties = properties;
    this.environment = environment;
  }

  @GetMapping("/api/csrf")
  Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/api/me")
  Map<String, Object> me(Authentication auth) {
    return session(auth);
  }

  private Map<String, Object> session(Authentication auth) {
    return Map.of(
        "username",
        auth.getName(),
        "operator",
        auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_OPERATOR")),
        "fraudEnabled",
        properties.fraudEnabled(),
        "testingEnabled",
        environment.matchesProfiles("demo"),
        "statementsEnabled",
        properties.statementsEnabled());
  }
}
