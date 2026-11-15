package dev.financial.app.platform.internal;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("processing_checkpoint")
public record ProcessingCheckpoint(@Id String partitionKey, long nextOffset) {}
