package dev.financial.app.ingestion.internal;

import dev.financial.app.platform.ProcessingGate;
import dev.financial.app.transactions.TransactionWriter;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
class TransactionListener {
  private final ProcessingGate gate;
  private final SourceNormalizer normalizer;
  private final TransactionWriter writer;

  TransactionListener(SourceNormalizer normalizer, TransactionWriter writer, ProcessingGate gate) {
    this.normalizer = normalizer;
    this.writer = writer;
    this.gate = gate;
  }

  @KafkaListener(
      topics = {
        "mock.bank.transactions.v1",
        "mock.card.transactions.v1",
        "mock.wallet.transactions.v1"
      },
      groupId = "aggregation-v1")
  void receive(ConsumerRecord<String, String> record) throws Exception {
    // The transaction commits inside the service proxy before the RECORD acknowledgement.
    gate.consume(
        record,
        () ->
            writer.accept(
                normalizer.normalize(
                    record.topic(), record.partition(), record.offset(), record.value())));
  }
}
