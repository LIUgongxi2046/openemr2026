# C01-A1 属性授权、患者关系与紧急访问测试报告

日期：2026-08-20  
阶段：S008 实施 + S009 `IMPLEMENT/EXECUTE/REPORT`  
结论：`LOCAL_VERIFIED`；真实医院 IdP step-up、外部 SIEM/通知通道和远程 CI 尚未联调。

## 1. 验收范围

| test_id | 风险/需求 | 预期 | 证据 |
|---|---|---|---|
| AUTH-001 | 仅按粗粒度角色放行 | 主体、资源、动作、组织、科室/病区、岗位任期、患者关系、用途、资源状态和有效期联合计算 | V26 + `AuthorizationAdministrationApiTest` |
| AUTH-002 | 显式拒绝被允许或紧急授权覆盖 | DENY 优先，模拟与运行时使用同一 PDP | 策略模拟和 ContextLease 集成断言 |
| AUTH-003 | 配置者自批提权 | 创建者发布自己的策略失败关闭 | 独立审批 409 断言 |
| AUTH-004 | 患者关系终止后旧页面继续写 | 每次临床命令重算授权，旧租约实时 403 | 关系终止后的诊断 API 断言 |
| EMG-001 | 紧急授权成为长期通配权限 | 最小资源/动作、1–60 分钟、具体理由和风险确认 | 请求校验与运行时授权测试 |
| EMG-002 | 伪造二次认证 | prod 只信任已验签 JWT `auth_time`，超过五分钟或缺失时失败关闭 | `EmergencyReauthenticationVerifierTest` |
| EMG-003 | 请求人自复核 | 独立管理员复核；复核后授权立即失效 | API 集成测试 |
| EMG-004 | 到期静默、无取证 | V28 扫描器以锁定方式关闭授权，写哈希审计和 Outbox 告警事件 | 到期扫描集成断言 |
| ARCH-001 | authorization/security 相互依赖 | PDP 归属 security，配置模块只单向依赖安全内核 | `ModularityTest` |

## 2. 实现证据

- V26 建立 `authorization_policy`、`patient_care_relationship` 和 `emergency_access_grant`，策略采用版本、效果、优先级、范围、条件和独立审批。
- V27 用前向迁移修正策略生命周期约束；已执行的 V26 保持不可变，避免 Flyway 校验和漂移。
- V28 移除静默到期触发器，由 `EmergencyAccessExpirySweeper` 生成 `EMERGENCY_ACCESS_EXPIRED` 审计和 Outbox 事件。
- ContextLease 签发和每次临床命令使用均调用同一 PDP；住院范围从当前入院病区/科室解析，门诊可使用唯一有效岗位范围，范围歧义默认拒绝。
- 生产紧急访问二次认证读取资源服务器已验签 JWT 的 `auth_time`；浏览器自报头只存在于 `dev-synthetic`，生产实现不会信任该头。
- `#/admin-permissions` 支持策略台账、草案、独立发布、访问模拟和紧急复核；`#/emergency-access` 支持最小授权申请、剩余时限和本人历史。

## 3. 实际执行

```text
scripts/verify.sh: PASS
Java: 27 suites / 69 tests / 0 failure / 0 skipped
Web: 4 files / 13 tests; production build PASS; no React PASS
Contract: 3/3; 98 schemas / 106 generated outputs / 77 operations
Database: V1-V28 transaction migration + isolated restore fingerprint PASS
Physical field dictionary: 810 fields
AI eval: 100/100; security red-team: 15 payloads / 12 surfaces
Traceability: 138/138; route design map: 194/194
Browser: 194/194, zero route/console/HTTP/overflow failures; unknown route fail-closed
```

## 4. 兼容、回滚与未关闭风险

- 数据库只使用前向迁移；策略和紧急访问事实不物理删除。应用可暂停到期扫描器后回滚代码，但不能回滚已写审计/Outbox，恢复后扫描器可重入补处理。
- 紧急授权过期即使扫描器暂时不可用，PDP 仍以 `expires_at > now()` 失败关闭；扫描器负责状态持久化和取证，不是安全边界的唯一执行点。
- 当前告警证据为管理员复核队列和 Outbox 安全事件，尚未连接医院 SIEM、短信或企业协同渠道。
- 尚未验证真实医院 IdP 的 step-up 流程、NTP 偏差、海量策略性能、远程 CI，以及 FR-112 的策略版本差异可视化；这些边界不因本地纵切通过而宣称完成。
