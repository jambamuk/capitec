package dev.financial.app.testing.internal;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Component
@Profile("demo")
class MockSources {
  enum Source {
    CORE_BANK("bank"),
    CARD_PROCESSOR("card"),
    WALLET_PROVIDER("wallet");
    final String kind;

    Source(String kind) {
      this.kind = kind;
    }

    String topic() {
      return "mock." + kind + ".transactions.v1";
    }
  }

  record State(String source, Boolean paused, Long intervalMs, String error) {}

  private final RestClient client;

  MockSources(
      RestClient.Builder builder,
      @Value("${MOCK_CONTROL_KEY:local-demo-source-control-key-2026}") String key) {
    var factory =
        new JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
    factory.setReadTimeout(Duration.ofSeconds(12));
    client = builder.requestFactory(factory).defaultHeader("X-Mock-Control-Key", key).build();
  }

  List<State> states() {
    return java.util.Arrays.stream(Source.values()).map(this::state).toList();
  }

  private State state(Source source) {
    try {
      return client.get().uri(url(source)).retrieve().body(State.class);
    } catch (Exception exception) {
      return new State(source.name(), null, null, "Source unavailable");
    }
  }

  void configureAll(boolean paused, long intervalMs) {
    boolean failed = false;
    for (var source : Source.values()) {
      try {
        client
            .put()
            .uri(url(source))
            .body(Map.of("paused", paused, "intervalMs", intervalMs))
            .retrieve()
            .toBodilessEntity();
      } catch (Exception exception) {
        failed = true;
      }
    }
    if (failed)
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Some sources could not be updated. Check their status and retry. No transaction data was reset.");
  }

  private String url(Source source) {
    return "http://" + source.kind + "-source:8080/control";
  }
}
