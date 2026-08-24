alter table research_dataset_request
  drop constraint research_dataset_request_check1;

alter table research_dataset_request
  add constraint research_dataset_request_check1
    check ((status in ('EXPORTED', 'DESTROYED')) = (exported_at is not null));
