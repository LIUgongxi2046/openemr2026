-- A retired fixture must not retain historical latency/timestamp values that can look like a live connection.
update model_deployment
set last_connection_tested_at = null,
    last_connection_latency_ms = null,
    last_connection_error_code = 'SYNTHETIC_CONFIGURATION_RETIRED',
    row_version = row_version + 1,
    updated_at = now()
where endpoint_url like 'https://%.example/%'
  and (last_connection_tested_at is not null
    or last_connection_latency_ms is not null
    or last_connection_error_code is distinct from 'SYNTHETIC_CONFIGURATION_RETIRED');
