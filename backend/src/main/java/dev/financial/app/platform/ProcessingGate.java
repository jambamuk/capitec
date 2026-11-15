package dev.financial.app.platform;

import dev.financial.app.platform.internal.CheckpointRepository;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.stream.Collectors;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.stereotype.Component;

/** Coordinates single-instance demo resets with in-flight event processing. */
@Component
public class ProcessingGate {
  @FunctionalInterface
  public interface Work {
    void run() throws Exception;
  }

  private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock(true);
  private final CheckpointRepository repository;
  private volatile Map<String, Long> cutoffs;

  public ProcessingGate(CheckpointRepository repository) {
    this.repository = repository;
    cutoffs =
        repository.findAll().stream()
            .collect(
                Collectors.toUnmodifiableMap(row -> row.partitionKey(), row -> row.nextOffset()));
  }

  public void consume(ConsumerRecord<String, String> record, Work work) throws Exception {
    shared(
        () -> {
          if (record.offset()
              >= cutoffs.getOrDefault(record.topic() + ":" + record.partition(), 0L)) work.run();
        });
  }

  public void shared(Work work) throws Exception {
    lock.readLock().lock();
    try {
      work.run();
    } finally {
      lock.readLock().unlock();
    }
  }

  public <T> T exclusive(Callable<T> work) throws Exception {
    if (!lock.writeLock().tryLock(15, TimeUnit.SECONDS))
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
          "Processing is still busy. Sources are paused; retry the reset shortly.");
    try {
      return work.call();
    } finally {
      lock.writeLock().unlock();
    }
  }

  public void persistCutoffs(Map<String, Long> offsets) {
    requireExclusive();
    offsets.forEach(repository::store);
  }

  public void installCutoffs(Map<String, Long> offsets) {
    requireExclusive();
    cutoffs = Map.copyOf(offsets);
  }

  private void requireExclusive() {
    if (!lock.isWriteLockedByCurrentThread())
      throw new IllegalStateException("Reset requires exclusive processing access");
  }
}
