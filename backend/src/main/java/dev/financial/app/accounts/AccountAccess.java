package dev.financial.app.accounts;

import dev.financial.app.accounts.internal.AccountRepository;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountAccess {
  private final AccountRepository repository;

  public AccountAccess(AccountRepository repository) {
    this.repository = repository;
  }

  public record Account(
      UUID id, UUID customerId, String customerName, String maskedNumber, String currency) {}

  public record SourceAccount(UUID id, UUID accountId) {}

  public List<Account> visible(Authentication auth) {
    boolean operator =
        auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_OPERATOR"));
    return repository.findVisibleAccounts(operator, auth.getName());
  }

  public void require(UUID accountId, Authentication auth) {
    if (visible(auth).stream().noneMatch(a -> a.id().equals(accountId)))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
  }

  public List<UUID> scope(UUID accountId, UUID customerId, Authentication auth) {
    List<Account> accounts = visible(auth);
    if (accountId != null && accounts.stream().noneMatch(a -> a.id().equals(accountId)))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
    List<UUID> ids =
        accounts.stream()
            .filter(a -> accountId == null || a.id().equals(accountId))
            .filter(a -> customerId == null || a.customerId().equals(customerId))
            .map(Account::id)
            .toList();
    if (customerId != null && ids.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found.");
    return ids;
  }

  public SourceAccount resolve(String source, String reference) {
    return repository
        .findSourceAccount(source, reference)
        .orElseThrow(() -> new IllegalArgumentException("Unknown source account"));
  }

  public String sourceReference(UUID accountId, String source) {
    return repository
        .sourceReference(accountId, source)
        .orElseThrow(() -> new IllegalArgumentException("Account is not connected to this source"));
  }
}
