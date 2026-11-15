package dev.financial.app.platform;

import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.*;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
class KafkaConfiguration {
  @Bean
  KafkaAdmin.NewTopics topics() {
    return new KafkaAdmin.NewTopics(
        topic("mock.bank.transactions.v1"),
        topic("mock.card.transactions.v1"),
        topic("mock.wallet.transactions.v1"),
        topic("transactions.categorized.v1"),
        topic("transactions.raw.dlt.v1"),
        topic("transactions.categorized.dlt.v1"));
  }

  private org.apache.kafka.clients.admin.NewTopic topic(String name) {
    return TopicBuilder.name(name)
        .partitions(3)
        .replicas(1)
        .config("retention.ms", "604800000")
        .build();
  }

  @Bean
  DefaultErrorHandler kafkaErrors(KafkaTemplate<String, String> template, MeterRegistry metrics) {
    var recoverer =
        new DeadLetterPublishingRecoverer(
            template,
            (record, exception) ->
                new TopicPartition(
                    record.topic().equals("transactions.categorized.v1")
                        ? "transactions.categorized.dlt.v1"
                        : "transactions.raw.dlt.v1",
                    -1));
    recoverer.setFailIfSendResultIsError(true);
    recoverer.setWaitForSendResultTimeout(Duration.ofSeconds(20));
    var handler =
        new DefaultErrorHandler(
            (record, exception) -> {
              recoverer.accept(record, exception);
              metrics.counter("transactions.quarantined", "topic", record.topic()).increment();
            },
            new FixedBackOff(1000, 3));
    handler.addNotRetryableExceptions(IllegalArgumentException.class);
    handler.setBackOffFunction(
        (record, exception) -> {
          Throwable cause = exception;
          while (cause != null) {
            if (cause instanceof org.springframework.transaction.CannotCreateTransactionException
                || cause instanceof DataAccessResourceFailureException
                || cause instanceof TransientDataAccessException)
              return new FixedBackOff(3000, FixedBackOff.UNLIMITED_ATTEMPTS);
            cause = cause.getCause();
          }
          return new FixedBackOff(1000, 3);
        });
    return handler;
  }
}
