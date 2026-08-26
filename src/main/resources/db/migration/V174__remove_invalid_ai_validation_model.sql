-- 清理仅供旧验收使用、不可进入业务选择的假模型及其配套假评测。
-- 模型评测表平时保持不可修改；迁移在受控窗口内临时解除触发器，删除明确 UUID 后立即恢复。

drop trigger if exists model_evaluation_immutable on model_evaluation;

delete from model_evaluation
where model_evaluation_id = '018f0000-0000-7000-8000-00000000f404'::uuid
   or model_deployment_id = '018f0000-0000-7000-8000-00000000f004'::uuid;

delete from model_deployment
where model_deployment_id = '018f0000-0000-7000-8000-00000000f004'::uuid
   or model_code = 'DETERMINISTIC-CLINICAL-FAKE';

create trigger model_evaluation_immutable
  before update or delete on model_evaluation
  for each row execute function prevent_model_evaluation_mutation();
