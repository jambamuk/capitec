package dev.financial.app.statements.internal;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@ConditionalOnProperty(name = "app.statements-enabled", havingValue = "true")
class StatementController {
  private final StatementService statements;

  private final DownloadLinkService links;

  StatementController(StatementService statements, DownloadLinkService links) {
    this.links = links;
    this.statements = statements;
  }

  @GetMapping("/api/v1/statements")
  StatementService.Page list(
      @RequestParam(required = false) UUID accountId,
      @RequestParam(defaultValue = "25") int limit,
      @RequestParam(required = false) String cursor,
      Authentication auth) {
    return statements.list(accountId, limit, cursor, auth);
  }

  @PostMapping(value = "/api/v1/statements", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  StatementService.Document upload(
      @RequestParam UUID accountId, @RequestPart MultipartFile file, Authentication auth)
      throws IOException {
    return statements.upload(accountId, file, auth);
  }

  @PostMapping("/api/v1/statements/{id}/download-links")
  ResponseEntity<DownloadLinkService.Grant> issue(@PathVariable UUID id, Authentication auth) {
    return ResponseEntity.status(201)
        .cacheControl(CacheControl.noStore())
        .body(links.issue(id, auth));
  }

  @GetMapping("/api/v1/statements/{id}/download-links")
  ResponseEntity<DownloadLinkService.ActiveLinks> activeLinks(
      @PathVariable UUID id, @RequestParam(required = false) String cursor, Authentication auth) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(links.active(id, cursor, auth));
  }

  @DeleteMapping("/api/v1/download-links/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void revoke(@PathVariable UUID id, Authentication auth) {
    links.revoke(id, auth);
  }

  @GetMapping("/downloads/{token}")
  ResponseEntity<Resource> download(@PathVariable String token, HttpServletRequest request) {
    var file = links.download(token, request.getRemoteAddr());
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_PDF)
        .contentLength(file.size())
        .cacheControl(CacheControl.noStore())
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment()
                .filename(file.filename(), StandardCharsets.UTF_8)
                .build()
                .toString())
        .body(new FileSystemResource(file.path()));
  }
}
