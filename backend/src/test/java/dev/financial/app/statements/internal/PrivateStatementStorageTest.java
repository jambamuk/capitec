package dev.financial.app.statements.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.financial.app.platform.AppProperties;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

class PrivateStatementStorageTest {
  @TempDir Path directory;

  @Test
  void validatesBeforePublicationAndDetectsChangedDocumentBytes() throws Exception {
    var storage = storage();
    byte[] content;
    try (var document = new PDDocument();
        var bytes = new ByteArrayOutputStream()) {
      document.addPage(new PDPage());
      document.save(bytes);
      content = bytes.toByteArray();
    }
    var staged =
        storage.stage(new MockMultipartFile("file", "statement.pdf", "application/pdf", content));
    assertThat(Files.exists(storage.resolve(staged.key()))).isFalse();
    storage.publish(staged);
    assertThat(storage.matches(staged.key(), staged.checksum())).isTrue();
    Files.writeString(storage.resolve(staged.key()), "changed bytes");
    assertThat(storage.matches(staged.key(), staged.checksum())).isFalse();
  }

  @Test
  void invalidPdfLeavesNoTemporaryFileAndPathsCannotEscapeStorage() throws Exception {
    var storage = storage();
    assertThatThrownBy(
            () ->
                storage.stage(
                    new MockMultipartFile(
                        "file", "fake.pdf", "application/pdf", new byte[] {1, 2, 3})))
        .isInstanceOf(ResponseStatusException.class);
    try (var files = Files.list(directory)) {
      assertThat(files).isEmpty();
    }
    assertThatThrownBy(() -> storage.resolve("../secret.pdf"))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void cleanupRemovesOnlyStaleTemporaryFiles() throws Exception {
    var storage = storage();
    var cutoff = Instant.parse("2026-11-10T10:00:00Z");
    Path abandoned = Files.writeString(directory.resolve("old.part"), "temporary");
    Path active = Files.writeString(directory.resolve("active.part"), "temporary");
    Path published = Files.writeString(directory.resolve("published.pdf"), "document");
    Files.setLastModifiedTime(abandoned, FileTime.from(cutoff.minusSeconds(1)));
    Files.setLastModifiedTime(active, FileTime.from(cutoff.plusSeconds(1)));
    Files.setLastModifiedTime(published, FileTime.from(cutoff.minusSeconds(1)));
    storage.removeAbandonedUploads(cutoff);
    assertThat(abandoned).doesNotExist();
    assertThat(active).exists();
    assertThat(published).exists();
  }

  private PrivateStatementStorage storage() throws Exception {
    return new PrivateStatementStorage(
        new AppProperties(directory, Duration.ofMinutes(5), true, true, "Africa/Johannesburg"));
  }
}
