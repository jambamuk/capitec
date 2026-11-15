package dev.financial.app.platform;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import dev.financial.app.platform.internal.CheckpointRepository;
import dev.financial.app.platform.internal.ProcessingCheckpoint;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

class ProcessingGateTest {
  @Test
  void storedCutoffsSkipOldRecordsIncludingAfterRestart() throws Exception {
    var repository = mock(CheckpointRepository.class);
    when(repository.findAll()).thenReturn(List.of(new ProcessingCheckpoint("topic:0", 5)));
    var gate = new ProcessingGate(repository);
    var calls = new AtomicInteger();
    gate.consume(
        new ConsumerRecord<>("topic", 0, 4, "key", "value"), () -> calls.incrementAndGet());
    gate.consume(
        new ConsumerRecord<>("topic", 0, 5, "key", "value"), () -> calls.incrementAndGet());
    gate.consume(
        new ConsumerRecord<>("other", 0, 0, "key", "value"), () -> calls.incrementAndGet());
    assertThat(calls.get()).isEqualTo(2);
    assertThatThrownBy(() -> gate.installCutoffs(Map.of()))
        .isInstanceOf(IllegalStateException.class);
    gate.exclusive(
        () -> {
          gate.persistCutoffs(Map.of("topic:0", 10L));
          gate.installCutoffs(Map.of("topic:0", 10L));
          return null;
        });
    verify(repository).store("topic:0", 10L);
    gate.consume(
        new ConsumerRecord<>("topic", 0, 9, "key", "value"), () -> calls.incrementAndGet());
    assertThat(calls.get()).isEqualTo(2);
  }
}
