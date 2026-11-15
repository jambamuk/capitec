package dev.financial.app.statements.internal;

import dev.financial.app.platform.AppProperties;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.apache.pdfbox.Loader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Component
public class PrivateStatementStorage {
  public record StagedFile(UUID id, String key, String filename, long size, String checksum) {}

  private final Path root;

  public PrivateStatementStorage(AppProperties properties) throws IOException {
    root = properties.storage().toAbsolutePath().normalize();
    Files.createDirectories(root);
  }

  public StagedFile stage(MultipartFile file) throws IOException {
    if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Choose a non-empty PDF up to 10 MB.");
    String original =
        file.getOriginalFilename() == null ? "statement.pdf" : file.getOriginalFilename();
    String filename = original.replaceAll("[^a-zA-Z0-9._-]", "_");
    if (filename.length() > 100) filename = filename.substring(filename.length() - 100);
    if (!filename.toLowerCase(Locale.ROOT).endsWith(".pdf"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files are accepted.");
    UUID id = UUID.randomUUID();
    String key = id + ".pdf";
    Path staging = root.resolve(id + ".part");
    try {
      try (InputStream in = file.getInputStream();
          OutputStream out = Files.newOutputStream(staging, StandardOpenOption.CREATE_NEW)) {
        byte[] buffer = new byte[8192];
        long total = 0;
        int count;
        while ((count = in.read(buffer)) != -1) {
          total += count;
          if (total > 10 * 1024 * 1024)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "PDF is too large.");
          out.write(buffer, 0, count);
        }
      }
      try (var pdf = Loader.loadPDF(staging.toFile())) {
        if (pdf.isEncrypted() || pdf.getNumberOfPages() < 1)
          throw new IOException("Unsupported PDF");
      } catch (IOException ex) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "File must be a readable, unencrypted PDF.");
      }
      String checksum = fileHash(staging);
      long size = Files.size(staging);
      return new StagedFile(id, key, filename, size, checksum);
    } catch (IOException | RuntimeException ex) {
      try {
        Files.deleteIfExists(staging);
      } catch (IOException cleanupFailure) {
        ex.addSuppressed(cleanupFailure);
      }
      throw ex;
    }
  }

  public void publish(StagedFile file) throws IOException {
    Files.move(
        root.resolve(file.id() + ".part"), resolve(file.key()), StandardCopyOption.ATOMIC_MOVE);
  }

  public void discard(StagedFile file) throws IOException {
    Files.deleteIfExists(root.resolve(file.id() + ".part"));
  }

  public boolean matches(String key, String checksum) throws IOException {
    Path file = resolve(key);
    return Files.isRegularFile(file) && fileHash(file).equals(checksum);
  }

  public void removeAbandonedUploads(Instant cutoff) throws IOException {
    try (var files = Files.newDirectoryStream(root, "*.part")) {
      for (Path file : files) {
        if (Files.getLastModifiedTime(file).toInstant().isBefore(cutoff))
          Files.deleteIfExists(file);
      }
    }
  }

  public Path resolve(String key) {
    if (!key.matches("[0-9a-f-]{36}\\.pdf")) throw unavailable();
    Path p = root.resolve(key).normalize();
    if (!p.startsWith(root)) throw unavailable();
    return p;
  }

  public static ResponseStatusException unavailable() {
    return new ResponseStatusException(
        HttpStatus.NOT_FOUND, "Document or download link unavailable.");
  }

  private static String fileHash(Path path) throws IOException {
    try (InputStream in = Files.newInputStream(path)) {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] buffer = new byte[8192];
      int count;
      while ((count = in.read(buffer)) != -1) digest.update(buffer, 0, count);
      return HexFormat.of().formatHex(digest.digest());
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
