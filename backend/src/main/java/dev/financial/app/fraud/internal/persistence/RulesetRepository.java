package dev.financial.app.fraud.internal.persistence;

import java.util.Optional;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface RulesetRepository extends Repository<StoredRuleset, Long> {
  @Query(
      """
      select r.version, r.rules::text, r.created_by, r.created_at
      from fraud_ruleset r join fraud_rule_configuration c on c.active_version = r.version
      where c.id = 1
      """)
  StoredRuleset findActive();

  @Query(
      "select version, rules::text, created_by, created_at from fraud_ruleset where version = :version")
  Optional<StoredRuleset> findById(long version);

  @Query(
      """
      insert into fraud_ruleset(rules, created_by) values(cast(:rules as jsonb), :actor)
      returning version, rules::text, created_by, created_at
      """)
  StoredRuleset insertRevision(String rules, String actor);

  @Modifying
  @Query(
      """
      update fraud_rule_configuration set active_version = :next
      where id = 1 and active_version = :expected
      """)
  int activateIfCurrent(long expected, long next);
}
