package dev.financial.app.fraud.internal.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface RuleResultRepository extends Repository<RuleResultRecord, UUID> {
  @Query(
      """
      select id, evaluation_id, rule_code, rule_version, result,
        criteria_snapshot::text, observed_values::text, explanation
      from rule_result where evaluation_id = :evaluationId order by rule_code
      """)
  List<RuleResultRecord> findByEvaluationId(UUID evaluationId);

  @Modifying
  @Query(
      """
      insert into rule_result(id, evaluation_id, rule_code, rule_version, result,
        criteria_snapshot, observed_values, explanation)
      values(:#{#result.id}, :#{#result.evaluationId}, :#{#result.ruleCode}, :#{#result.ruleVersion},
        :#{#result.result}, cast(:#{#result.criteriaSnapshot} as jsonb),
        cast(:#{#result.observedValues} as jsonb), :#{#result.explanation})
      """)
  int insert(RuleResultRecord result);

  @Modifying
  @Query("delete from rule_result")
  int clearDemoData();
}
