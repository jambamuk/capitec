package dev.financial.app.transactions;

import dev.financial.app.transactions.internal.TransactionRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Owns transaction deletion; dependent fraud data must be cleared first. */
@Service
@Profile("demo")
public class TransactionDemoReset {
  private final TransactionRepository transactions;

  public TransactionDemoReset(TransactionRepository transactions) {
    this.transactions = transactions;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public long clear() {
    long count = transactions.count();
    transactions.clearDemoPublications();
    transactions.deleteAll();
    return count;
  }
}
