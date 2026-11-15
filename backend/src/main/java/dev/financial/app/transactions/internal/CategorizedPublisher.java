package dev.financial.app.transactions.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.platform.ProcessingGate;
import dev.financial.app.transactions.CategorizedTransaction;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.modulith.events.CompletedEventPublications;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class CategorizedPublisher {
  private final KafkaTemplate<String, String> kafka;
  private final ProcessingGate gate;
  private final TransactionRepository transactions;
  private final ObjectMapper json;
  private final IncompleteEventPublications pending;
  private final CompletedEventPublications completed;

  CategorizedPublisher(
      KafkaTemplate<String, String> kafka,
      ObjectMapper json,
      IncompleteEventPublications pending,
      CompletedEventPublications completed,
      ProcessingGate gate,
      TransactionRepository transactions) {
    this.kafka = kafka;
    this.json = json;
    this.pending = pending;
    this.completed = completed;
    this.gate = gate;
    this.transactions = transactions;
  }

  @ApplicationModuleListener
  public void publish(CategorizedTransaction event) throws Exception {
    // Returning only after broker acknowledgement lets Modulith safely mark this publication
    // complete.
    gate.shared(
        () -> {
          // An asynchronous publication queued before a reset may outlive its transaction.
          if (!transactions.existsById(event.transactionId())) return;
          kafka
              .send(
                  "transactions.categorized.v1",
                  event.accountId().toString(),
                  json.writeValueAsString(event))
              .get(20, TimeUnit.SECONDS);
        });
  }

  @Scheduled(fixedDelayString = "${app.publication-retry-ms:30000}")
  void retry() {
    pending.resubmitIncompletePublicationsOlderThan(Duration.ofSeconds(30));
  }

  @Scheduled(fixedDelay = 3600000, initialDelay = 3600000)
  void cleanCompleted() {
    completed.deletePublicationsOlderThan(Duration.ofDays(7));
  }
}
