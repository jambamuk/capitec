package dev.financial.app.accounts.internal;

import dev.financial.app.accounts.AccountAccess.Account;
import dev.financial.app.accounts.AccountAccess.SourceAccount;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface AccountRepository extends Repository<AccountRecord, UUID> {
  @Query(
      """
      select a.id, a.customer_id, c.display_name customer_name, a.masked_number, a.currency
      from account a join customer c on c.id = a.customer_id
      where (:operator or c.auth_subject = :subject)
      order by c.display_name, a.id
      """)
  List<Account> findVisibleAccounts(boolean operator, String subject);

  @Query(
      """
      select id, account_id from source_account
      where source_code = :source and external_account_ref = :reference
      """)
  Optional<SourceAccount> findSourceAccount(String source, String reference);

  @Query(
      "select external_account_ref from source_account where account_id=:accountId and source_code=:source")
  Optional<String> sourceReference(UUID accountId, String source);
}
