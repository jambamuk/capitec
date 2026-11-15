package dev.financial.app.platform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.JdbcUserDetailsManager;

@Configuration
@Profile("demo")
class DemoUsers {
  @Bean
  ApplicationRunner seedUsers(
      JdbcUserDetailsManager users,
      PasswordEncoder encoder,
      @Value("${app.demo.operator-password}") String operatorPassword,
      @Value("${app.demo.customer-password}") String customerPassword) {
    return args -> {
      if (!users.userExists("operator"))
        users.createUser(
            User.withUsername("operator")
                .password(encoder.encode(operatorPassword))
                .roles("OPERATOR")
                .build());
      for (String name : new String[] {"amina", "ben"}) {
        if (!users.userExists(name))
          users.createUser(
              User.withUsername(name)
                  .password(encoder.encode(customerPassword))
                  .roles("CUSTOMER")
                  .build());
      }
    };
  }
}
