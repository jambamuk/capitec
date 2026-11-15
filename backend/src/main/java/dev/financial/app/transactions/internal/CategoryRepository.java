package dev.financial.app.transactions.internal;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.repository.Repository;

public interface CategoryRepository extends Repository<CategoryRepository.Category, String> {
  @Table("category")
  record Category(@Id String code, @JsonProperty("display_name") String displayName) {}

  @Query("select code, display_name from category order by display_name")
  List<Category> findAll();

  boolean existsById(String code);
}
