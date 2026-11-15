package dev.financial.app.accounts.internal;

import dev.financial.app.accounts.AccountAccess;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class AccountsController {
  private final AccountAccess accounts;

  AccountsController(AccountAccess accounts) {
    this.accounts = accounts;
  }

  @GetMapping("/accounts")
  Map<String, Object> accounts(Authentication auth) {
    return Map.of("items", accounts.visible(auth));
  }

  @GetMapping("/customers")
  Map<String, Object> customers(Authentication auth) {
    return Map.of(
        "items",
        accounts.visible(auth).stream()
            .map(a -> Map.of("id", a.customerId(), "name", a.customerName()))
            .distinct()
            .toList());
  }

  @GetMapping("/customers/{customerId}/accounts")
  Map<String, Object> customerAccounts(@PathVariable UUID customerId, Authentication auth) {
    accounts.scope(null, customerId, auth);
    return Map.of(
        "items",
        accounts.visible(auth).stream().filter(a -> a.customerId().equals(customerId)).toList());
  }
}
