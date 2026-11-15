package dev.financial.app.platform.internal;

import java.util.List;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface CheckpointRepository extends Repository<ProcessingCheckpoint, String> {
  @Query("select * from processing_checkpoint")
  List<ProcessingCheckpoint> findAll();

  @Modifying
  @Query(
      "insert into processing_checkpoint(partition_key,next_offset) values(:key,:offset) on conflict(partition_key) do update set next_offset=excluded.next_offset")
  void store(String key, long offset);
}
