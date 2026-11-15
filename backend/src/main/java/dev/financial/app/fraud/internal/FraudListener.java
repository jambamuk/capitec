package dev.financial.app.fraud.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.platform.ProcessingGate;
import dev.financial.app.transactions.CategorizedTransaction;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
class FraudListener {
  private final ProcessingGate gate;
  private final ObjectMapper json;
  private final FraudProcessor processor;

  FraudListener(ObjectMapper json, FraudProcessor processor, ProcessingGate gate) {
    this.json = json;
    this.processor = processor;
    this.gate = gate;
  }

  @KafkaListener(topics = "transactions.categorized.v1", groupId = "fraud-engine-v1")
  void receive(ConsumerRecord<String, String> record) throws Exception {
    gate.consume(record, () -> evaluate(record.value()));
  }

  private void evaluate(String raw) throws Exception {
    CategorizedTransaction event;
    try {
      event = json.readValue(raw, CategorizedTransaction.class);
    } catch (Exception ex) {
      throw new IllegalArgumentException("Invalid categorized event");
    }
    processor.evaluate(event);
  }
}
