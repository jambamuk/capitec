package dev.financial.app.platform;

import java.nio.file.Path;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(
    Path storage,
    Duration linkTtl,
    boolean fraudEnabled,
    boolean statementsEnabled,
    String clockZone) {}
