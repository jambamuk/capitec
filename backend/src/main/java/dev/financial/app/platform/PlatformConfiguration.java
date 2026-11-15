package dev.financial.app.platform;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class PlatformConfiguration {
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }
}
