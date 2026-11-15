package dev.financial.app.testing.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.fraud.FraudDemoReset;
import dev.financial.app.platform.ProcessingGate;
import dev.financial.app.transactions.TransactionDemoReset;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("demo")
class TestingService {
  record Published(
      String reference, String topic, int partition, long offset, Map<String, Object> event) {}

  record Receipt(UUID requestId, int requested, List<Published> accepted, String error) {}

  record ResetResult(long removedTransactions, boolean sourcesPaused) {}

  private final FraudDemoReset fraudReset;
  private final TransactionDemoReset transactionReset;
  private final MockSources sources;
  private final TestingRepository repository;
  private final AccountAccess accounts;
  private final ProcessingGate gate;
  private final KafkaTemplate<String, String> kafka;
  private final KafkaAdmin admin;
  private final ObjectMapper json;
  private final TransactionTemplate transaction;
  private final Clock clock;

  TestingService(
      FraudDemoReset fraudReset,
      TransactionDemoReset transactionReset,
      MockSources sources,
      TestingRepository repository,
      AccountAccess accounts,
      ProcessingGate gate,
      KafkaTemplate<String, String> kafka,
      KafkaAdmin admin,
      ObjectMapper json,
      TransactionTemplate transaction,
      Clock clock) {
    this.fraudReset = fraudReset;
    this.transactionReset = transactionReset;
    this.sources = sources;
    this.repository = repository;
    this.accounts = accounts;
    this.gate = gate;
    this.kafka = kafka;
    this.admin = admin;
    this.json = json;
    this.transaction = transaction;
    this.clock = clock;
  }

  List<MockSources.State> sources() {
    return sources.states();
  }

  synchronized List<MockSources.State> configure(boolean paused, long intervalMs) {
    sources.configureAll(paused, intervalMs);
    return sources.states();
  }

  List<TestingRepository.Result> results(UUID requestId) {
    return repository.results("test-" + requestId + "-%");
  }

  synchronized Receipt publish(TestEventRequest request, Authentication auth) throws Exception {
    accounts.require(request.accountId(), auth);
    String accountReference =
        accounts.sourceReference(request.accountId(), request.source().name());
    String digits =
        accounts.visible(auth).stream()
            .filter(account -> account.id().equals(request.accountId()))
            .findFirst()
            .orElseThrow()
            .maskedNumber()
            .replaceAll("[^0-9]", "");
    String lastFour = digits.substring(digits.length() - 4);
    // Build and validate the whole batch before publishing any part of it.
    List<Map<String, Object>> events = new ArrayList<>();
    for (int index = 0; index < request.count(); index++)
      events.add(TestEventFactory.create(request, accountReference, lastFour, index));
    List<Published> accepted = new ArrayList<>();
    for (int index = 0; index < events.size(); index++) {
      try {
        var metadata =
            kafka
                .send(
                    request.source().topic(),
                    accountReference,
                    json.writeValueAsString(events.get(index)))
                .get(20, TimeUnit.SECONDS)
                .getRecordMetadata();
        accepted.add(
            new Published(
                "test-" + request.requestId() + "-" + index,
                metadata.topic(),
                metadata.partition(),
                metadata.offset(),
                events.get(index)));
      } catch (Exception exception) {
        if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
        return new Receipt(
            request.requestId(),
            request.count(),
            accepted,
            "Publication interrupted. Check results before retrying the same request; broker acknowledgement may be uncertain.");
      }
    }
    return new Receipt(request.requestId(), request.count(), accepted, null);
  }

  synchronized ResetResult reset(String actor) throws Exception {
    sources.configureAll(true, 5000);
    return gate.exclusive(
        () -> {
          Map<String, Long> cutoffs = endOffsets();
          Long removed =
              transaction.execute(
                  status -> {
                    gate.persistCutoffs(cutoffs);
                    fraudReset.clear();
                    long count = transactionReset.clear();
                    repository.audit(UUID.randomUUID(), actor, clock.instant(), count);
                    return count;
                  });
          gate.installCutoffs(cutoffs);
          return new ResetResult(removed, true);
        });
  }

  private Map<String, Long> endOffsets() throws Exception {
    var topics =
        new ArrayList<>(
            Arrays.stream(MockSources.Source.values()).map(MockSources.Source::topic).toList());
    topics.add("transactions.categorized.v1");
    try (var client = Admin.create(admin.getConfigurationProperties())) {
      var descriptions = client.describeTopics(topics).allTopicNames().get(10, TimeUnit.SECONDS);
      Map<TopicPartition, OffsetSpec> requests = new HashMap<>();
      descriptions.forEach(
          (topic, description) ->
              description
                  .partitions()
                  .forEach(
                      partition ->
                          requests.put(
                              new TopicPartition(topic, partition.partition()),
                              OffsetSpec.latest())));
      var offsets = client.listOffsets(requests).all().get(10, TimeUnit.SECONDS);
      Map<String, Long> result = new HashMap<>();
      offsets.forEach(
          (partition, value) ->
              result.put(partition.topic() + ":" + partition.partition(), value.offset()));
      return result;
    }
  }
}
