-- 知识中心核心表（医院维护知识场景首版：来源登记 -> 只读选择性导入 -> 文档/版本维护 -> 评审发布 -> FTS 检索 -> 图谱/反馈）
-- 注：语义检索（pgvector）留待后续迁移 V352+；首版检索为 FTS + 精确/编码 + 图 depth<=2。

create table knowledge_source_registry (
  tenant_id uuid not null,
  source_id uuid not null,
  source_code varchar(128) not null,
  source_name varchar(256) not null check (length(trim(source_name)) >= 2),
  source_kind varchar(32) not null check (source_kind in ('OBSIDIAN_VAULT', 'MANUAL', 'UPLOAD')),
  source_path varchar(1024),
  license varchar(256),
  allowed_use text,
  sensitivity varchar(16) not null check (sensitivity in ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED')),
  update_frequency varchar(32),
  checksum varchar(64),
  status varchar(16) not null check (status in ('REGISTERED', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, source_id),
  unique (tenant_id, source_code)
);

create table knowledge_import_batch (
  tenant_id uuid not null,
  batch_id uuid not null,
  source_id uuid not null,
  source_root varchar(1024) not null,
  selection_matrix_version varchar(64) not null,
  source_manifest_hash varchar(64) not null,
  mode varchar(16) not null check (mode in ('READ_ONLY')),
  imported_row_count bigint not null default 0,
  skipped_row_count bigint not null default 0,
  status varchar(16) not null check (status in ('RUNNING', 'COMPLETED', 'FAILED')),
  imported_at timestamptz not null default now(),
  operator uuid not null,
  primary key (tenant_id, batch_id),
  foreign key (tenant_id, source_id) references knowledge_source_registry(tenant_id, source_id),
  foreign key (tenant_id, operator) references app_user(tenant_id, user_id)
);

create table knowledge_source_file (
  tenant_id uuid not null,
  file_id uuid not null,
  batch_id uuid not null,
  source_path varchar(1024) not null,
  source_content_hash varchar(64) not null,
  entity_category varchar(64),
  system varchar(64),
  table_name varchar(128),
  included boolean not null,
  primary key (tenant_id, file_id),
  unique (tenant_id, batch_id, source_path),
  foreign key (tenant_id, batch_id) references knowledge_import_batch(tenant_id, batch_id)
);

create table knowledge_document (
  tenant_id uuid not null,
  document_id uuid not null,
  document_code varchar(128) not null,
  content_type varchar(32) not null check (content_type in
    ('GUIDELINE', 'DRUG_LEAFLET', 'PATHWAY', 'QC_BASIS', 'GRAPH_ENTITY', 'CATALOG', 'TERMINOLOGY')),
  title varchar(512) not null check (length(trim(title)) >= 2),
  source_authority varchar(256),
  license varchar(256),
  classification varchar(16) not null check (classification in ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED')),
  effective_from timestamptz,
  effective_to timestamptz,
  row_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, document_id),
  unique (tenant_id, document_code)
);

create table knowledge_document_version (
  tenant_id uuid not null,
  doc_version_id uuid not null,
  document_id uuid not null,
  version varchar(64) not null,
  content_hash varchar(64) not null,
  markdown text not null check (length(trim(markdown)) >= 1),
  metadata jsonb not null default '{}'::jsonb,
  status varchar(16) not null check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED')),
  effective_from timestamptz,
  effective_to timestamptz,
  published_by uuid,
  row_version bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (tenant_id, doc_version_id),
  unique (tenant_id, document_id, version),
  check (effective_to is null or effective_to >= effective_from),
  foreign key (tenant_id, document_id) references knowledge_document(tenant_id, document_id),
  foreign key (tenant_id, published_by) references app_user(tenant_id, user_id)
);

create unique index knowledge_doc_version_one_active_idx
  on knowledge_document_version (tenant_id, document_id) where status = 'ACTIVE';

create index knowledge_doc_version_document_idx
  on knowledge_document_version (tenant_id, document_id, created_at desc);

create function prevent_knowledge_version_content_mutation() returns trigger language plpgsql as $$
begin
  if new.content_hash <> old.content_hash or new.markdown <> old.markdown
     or new.version <> old.version or new.document_id <> old.document_id then
    raise exception 'knowledge document version content and identity are immutable once created';
  end if;
  return new;
end $$;

create trigger knowledge_version_content_immutable
  before update of content_hash, markdown, version, document_id on knowledge_document_version
  for each row execute function prevent_knowledge_version_content_mutation();

create table knowledge_chunk (
  tenant_id uuid not null,
  chunk_id uuid not null,
  doc_version_id uuid not null,
  section_path varchar(256),
  section_title varchar(512),
  text text not null,
  token_count int not null default 0,
  language varchar(16) not null default 'zh-CN',
  clinical_tags jsonb not null default '[]'::jsonb,
  content_hash varchar(64) not null,
  source_locator jsonb not null default '{}'::jsonb,
  primary key (tenant_id, chunk_id),
  foreign key (tenant_id, doc_version_id) references knowledge_document_version(tenant_id, doc_version_id)
);

create index knowledge_chunk_doc_version_idx on knowledge_chunk (tenant_id, doc_version_id);
create index knowledge_chunk_fts_idx on knowledge_chunk using gin (to_tsvector('simple', text));

create table knowledge_concept (
  tenant_id uuid not null,
  concept_id uuid not null,
  source_type varchar(16) not null check (source_type in ('DICTIONARY', 'EXTRACTED')),
  source_id varchar(128),
  system varchar(64),
  code varchar(128),
  display varchar(512) not null,
  primary key (tenant_id, concept_id),
  unique (tenant_id, source_type, system, code)
);

create table knowledge_relation (
  tenant_id uuid not null,
  relation_id uuid not null,
  from_concept uuid not null,
  to_concept uuid not null,
  rel_type varchar(32) not null check (rel_type in ('MAPS_TO', 'MENTIONS', 'SUPPORTED_BY', 'CONSTRAINS')),
  version varchar(64),
  primary key (tenant_id, relation_id),
  foreign key (tenant_id, from_concept) references knowledge_concept(tenant_id, concept_id),
  foreign key (tenant_id, to_concept) references knowledge_concept(tenant_id, concept_id)
);

create index knowledge_relation_from_idx on knowledge_relation (tenant_id, from_concept);
create index knowledge_relation_to_idx on knowledge_relation (tenant_id, to_concept);

create table knowledge_retrieval_log (
  tenant_id uuid not null,
  log_id uuid not null,
  use_case varchar(64),
  query_hash varchar(64) not null,
  version_ref uuid,
  result_hash varchar(64),
  actor_user_id uuid,
  authorization_watermark varchar(256),
  retrieved_at timestamptz not null default now(),
  primary key (tenant_id, log_id)
);

create table knowledge_feedback (
  tenant_id uuid not null,
  feedback_id uuid not null,
  use_case varchar(64),
  doc_version_id uuid,
  source_ref varchar(256),
  disposition varchar(16) not null check (disposition in ('ACCEPTED', 'REJECTED', 'CORRECTION')),
  comment text,
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, feedback_id),
  foreign key (tenant_id, doc_version_id) references knowledge_document_version(tenant_id, doc_version_id)
);
