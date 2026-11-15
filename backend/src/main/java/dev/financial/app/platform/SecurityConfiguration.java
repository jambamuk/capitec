package dev.financial.app.platform;

import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.JdbcUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class SecurityConfiguration {
  @Bean
  JdbcUserDetailsManager users(DataSource dataSource) {
    return new JdbcUserDetailsManager(dataSource);
  }

  @Bean
  PasswordEncoder passwords() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
  }

  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    return http.authorizeHttpRequests(
            a ->
                a.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR)
                    .permitAll()
                    .requestMatchers(
                        "/",
                        "/index.html",
                        "/assets/**",
                        "/favicon.ico",
                        "/capitec-logo.svg",
                        "/transactions",
                        "/overview",
                        "/fraud",
                        "/fraud-rules",
                        "/statements",
                        "/api/csrf",
                        "/api/session",
                        "/downloads/**",
                        "/actuator/health",
                        "/actuator/health/**")
                    .permitAll()
                    .requestMatchers(
                        "/actuator/**", "/api-docs/**", "/swagger-ui/**", "/v3/api-docs/**")
                    .hasRole("OPERATOR")
                    .requestMatchers("/api/v1/testing/**")
                    .hasRole("OPERATOR")
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .formLogin(
            f ->
                f.loginProcessingUrl("/api/session")
                    .successHandler(
                        (req, res, auth) -> {
                          res.setStatus(204);
                        })
                    .failureHandler((req, res, err) -> res.sendError(401, "Invalid credentials")))
        .logout(
            l ->
                l.logoutUrl("/api/session/logout")
                    .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint((req, res, err) -> res.sendError(401))
                    .accessDeniedHandler((req, res, err) -> res.sendError(403)))
        .headers(
            h ->
                h.contentTypeOptions(c -> {})
                    .referrerPolicy(
                        r ->
                            r.policy(
                                org.springframework.security.web.header.writers
                                    .ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                    .contentSecurityPolicy(
                        c ->
                            c.policyDirectives(
                                "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'")))
        .build();
  }
}
