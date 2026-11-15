package dev.financial.sources;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SourceApplication {
  public static void main(String[] args) {
    SpringApplication.run(SourceApplication.class, args);
  }

  @Bean
  ApplicationRunner seed(SourcePublisher publisher) {
    return args -> publisher.seed();
  }
}
