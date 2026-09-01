-- Governed outpatient baseline for the active ICD-10-CN clinical release.
-- This is production reference data, not patient or scenario fixture data.
insert into diagnosis_terminology_entry(
  terminology_system, terminology_release, code, display_name,
  lifecycle_status, effective_from, effective_to)
values
  ('ICD-10-CN','2026B','E11.9','2型糖尿病，不伴有并发症','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','E78.5','高脂血症，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','I20.9','心绞痛，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','I25.1','动脉粥样硬化性心脏病','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','I48.9','心房颤动和心房扑动，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','I50.9','心力衰竭，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','I63.9','脑梗死，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','J06.9','急性上呼吸道感染，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','J18.9','肺炎，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','J44.9','慢性阻塞性肺病，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','J45.9','哮喘，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','K21.9','胃食管反流病，不伴食管炎','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','K29.7','胃炎，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','K76.0','脂肪（变）性肝病，不可归类在他处者','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','N18.9','慢性肾脏病，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','N39.0','泌尿道感染，部位未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','G43.9','偏头痛，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','F32.9','抑郁发作，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','F41.9','焦虑障碍，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','M54.5','下背痛','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','R05','咳嗽','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','R07.4','胸痛，未特指','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','R10.4','其他和未特指的腹痛','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','R42','头晕和眩晕','ACTIVE',date '2026-07-01',null),
  ('ICD-10-CN','2026B','R50.9','发热，未特指','ACTIVE',date '2026-07-01',null)
on conflict (terminology_system, terminology_release, code) do update
set display_name=excluded.display_name, lifecycle_status='ACTIVE',
  effective_from=excluded.effective_from, effective_to=null;
