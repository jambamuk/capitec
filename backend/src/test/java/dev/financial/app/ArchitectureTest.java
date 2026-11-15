package dev.financial.app;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.core.ApplicationModules;

class ArchitectureTest {
  @Test
  void moduleBoundariesAreAcyclic() {
    ApplicationModules.of(FinanceApplication.class).verify();
  }

  @Test
  void businessCodeDoesNotExecuteSql() {
    var classes = new ClassFileImporter().importPackages("dev.financial.app");
    noClasses()
        .that()
        .haveSimpleNameEndingWith("Controller")
        .or()
        .haveSimpleNameEndingWith("Service")
        .or()
        .haveSimpleNameEndingWith("Queries")
        .or()
        .haveSimpleNameEndingWith("Processor")
        .should()
        .dependOnClassesThat()
        .haveFullyQualifiedName(JdbcClient.class.getName())
        .check(classes);
  }
}
