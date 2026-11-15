package dev.financial.app.fraud.internal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.fraud.internal.persistence.RulesetRepository;
import dev.financial.app.fraud.internal.persistence.StoredRuleset;
import dev.financial.app.fraud.internal.rules.RuleValidator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
public class RuleConfiguration {
  public enum Type {
    AMOUNT_GREATER_THAN,
    MERCHANT_EQUALS,
    CATEGORY_EQUALS,
    VELOCITY_COUNT,
    VELOCITY_AMOUNT,
    NEW_BENEFICIARY_PAYMENT,
    FOREIGN_ONLINE_PAYMENT
  }

  public enum Severity {
    LOW,
    MEDIUM,
    HIGH
  }

  public enum Direction {
    ANY,
    DEBIT,
    CREDIT
  }

  public record Rule(
      @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{0,49}") String code,
      @NotBlank @Size(max = 100) String name,
      @NotNull Type type,
      boolean enabled,
      @NotNull Direction direction,
      @Pattern(regexp = "[0-9]{1,17}(\\.[0-9]{1,2})?") String amount,
      @Size(max = 200) String matchValue,
      @Min(1) @Max(1440) Integer windowMinutes,
      @Min(1) @Max(10000) Integer countThreshold,
      Severity severity) {
    public Rule {
      if (severity == null) severity = Severity.MEDIUM;
    }

    public Rule(
        String code,
        String name,
        Type type,
        boolean enabled,
        Direction direction,
        String amount,
        String matchValue) {
      this(code, name, type, enabled, direction, amount, matchValue, null, null, Severity.MEDIUM);
    }
  }

  public record Change(
      @Positive long expectedVersion, @NotNull @Size(max = 20) List<@NotNull @Valid Rule> rules) {}

  public record Snapshot(long version, List<Rule> rules, String createdBy, Instant createdAt) {}

  private final RulesetRepository repository;
  private final RuleValidator validator;
  private final ObjectMapper json;

  public RuleConfiguration(
      RulesetRepository repository, RuleValidator validator, ObjectMapper json) {
    this.repository = repository;
    this.validator = validator;
    this.json = json;
  }

  public Snapshot current() {
    return snapshot(repository.findActive());
  }

  public Snapshot version(long version) {
    return snapshot(
        repository
            .findById(version)
            .orElseThrow(
                () ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Rule version not found.")));
  }

  @Transactional(rollbackFor = Exception.class)
  public Snapshot save(Change change, String actor) throws Exception {
    List<Rule> normalized = validator.normalize(change);
    var revision = repository.insertRevision(json.writeValueAsString(normalized), actor);
    if (repository.activateIfCurrent(change.expectedVersion(), revision.version()) != 1) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Rules changed since you opened them. Reload before saving.");
    }
    return snapshot(revision);
  }

  private Snapshot snapshot(StoredRuleset stored) {
    try {
      List<Rule> rules = json.readValue(stored.rules(), new TypeReference<List<Rule>>() {});
      return new Snapshot(stored.version(), rules, stored.createdBy(), stored.createdAt());
    } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
      throw new IllegalStateException("Unreadable stored rule configuration", exception);
    }
  }
}
