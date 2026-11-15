--liquibase formatted sql
--changeset finance:007
create table processing_checkpoint (
  partition_key varchar(240) primary key,
  next_offset bigint not null
);

create table demo_reset_audit (
  id uuid primary key,
  reset_by varchar(100) not null,
  reset_at timestamptz not null,
  removed_transactions bigint not null
);
