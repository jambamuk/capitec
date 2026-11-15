package dev.financial.app.platform;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
class WebRoutes {
  @GetMapping({"/overview", "/testing", "/transactions", "/fraud", "/fraud-rules", "/statements"})
  String application() {
    return "forward:/index.html";
  }
}
