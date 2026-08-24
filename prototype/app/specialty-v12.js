/* v0.12: explicit outpatient/global-record routing and production-depth core specialty prototypes */
const specialtyProfilesV12={
  obgyn:{patient:['王静','女 · 32岁 · 孕产妇号 MAT26081403','产科门诊 PN20260814-031','29+4周 · 高危妊娠 · 诊疗中'],roles:['产科医师','助产士','产科护士','新生儿科医师'],scopes:['妇科门诊','产前门诊','产房','产科病区'],integrations:['胎心监护 CTG','产科超声/PACS','LIS/输血','出生医学证明'],checkpoints:['高危妊娠动态分层','产程异常升级','母婴双身份建链','产后出血量闭环'],handoff:'产房→产科病区→新生儿科/儿童保健，交接母婴身份、分娩事件、风险与未完筛查',consent:'分娩方式、手术/麻醉、输血及新生儿处置分别版本化签署',capacity:'门诊+住院+产房并发'},
  reproductive:{patient:['李妍','女 · 31岁 · 夫妇档案 CPL260018','生殖周期 ART2026-0814','IVF-ET · D10 · 促排监测中'],roles:['生殖医师','生殖护士','胚胎师','伦理管理员'],scopes:['不孕门诊','周期管理','取卵/移植室','胚胎实验室'],integrations:['生殖超声','激素 LIS','胚胎实验室','冷冻存储设备'],checkpoints:['夫妇双人身份核验','方案与用药审批','配子胚胎双核对','库存与去向对账'],handoff:'临床→取卵室→胚胎实验室→移植室→孕早期/产科，所有载杆与操作人逐级确认',consent:'周期、取卵、受精、培养、冷冻、移植及遗传学项目分别校验有效期',capacity:'周期+实验室批次并发'},
  pediatrics:{patient:['赵晨','男 · 4岁9月 · 患儿号 PED260943','儿科门诊 PEDOP260814-22','发热第2天 · 监护人已核验'],roles:['儿科医师','儿科护士','临床药师','监护人'],scopes:['儿科门诊','儿童急诊','儿科病区','儿童保健'],integrations:['生长曲线','儿童剂量引擎','疫苗/公卫','LIS/PACS'],checkpoints:['监护人关系与授权','月龄/体重时效','按体重/体表面积剂量','危重分诊与复评'],handoff:'门诊/急诊→病区或儿童保健，交接监护人、体重时间、剂量依据、传染病风险',consent:'监护人签署与具备表达能力患儿共同参与，紧急情形保留事后补证',capacity:'门急住与保健并发'},
  neonatal:{patient:['新生儿李某女','女 · 出生6小时 · 新生儿号 NB26081409','NICU NEO20260814-09','34+2周 · 2180g · 早产儿'],roles:['新生儿科医师','NICU护士','产科/助产士','儿童保健人员'],scopes:['产房接收','NICU','母婴同室','新生儿随访'],integrations:['母婴腕带','监护/呼吸机','床旁检验','新生儿筛查'],checkpoints:['出生事件与母婴关联','胎龄/Apgar一致','喂养出入量','筛查标本全链'],handoff:'产房→NICU/母婴同室→儿童保健，腕带、足印、出生事件与监护人四点核验',consent:'监护人授权、抢救例外、筛查与高风险操作分别留痕',capacity:'NICU高频事件流'},
  mental:{patient:['陈晓（隐私保护）','女 · 27岁 · 特殊隐私病历','精神科门诊 PSY20260814-17','抑郁发作 · 自杀风险中危'],roles:['精神科医师','心理治疗师','精神科护士','授权监护人'],scopes:['精神门诊','心理治疗','精神病区','危机干预'],integrations:['量表平台','药物监测 LIS','随访平台','区域精防（按授权）'],checkpoints:['特殊隐私最小访问','自杀/暴力风险动态评估','保护措施复核','危机计划与随访'],handoff:'普通门诊→危机处置/病区/社区随访，最小披露风险等级、保护措施和责任人',consent:'本人能力评估、监护关系、非自愿医疗依据和保护措施时限分别记录',capacity:'门诊+病区+危机队列'},
  ophthalmology:{patient:['周国强','男 · 64岁 · 眼科患者号 EYE260318','眼科门诊 EYEOP260814-41','右眼视力下降 · 眼压升高'],roles:['眼科医师','验光师','眼科技师','手术护士'],scopes:['眼科门诊','检查中心','日间手术','眼科病区'],integrations:['验光/眼压设备','OCT/眼底照相','眼科 PACS','手术排程'],checkpoints:['OD/OS全链一致','设备测量来源','散瞳禁忌','手术眼别三方核查'],handoff:'门诊检查→手术/病区→术后随访，交接眼别、测量设备、图像版本和植入物',consent:'散瞳、侵入性检查、手术眼别、人工晶体型号分别确认',capacity:'检查设备+日间手术并发'},
  ent:{patient:['刘敏','女 · 42岁 · 耳鼻喉患者号 ENT260522','耳鼻喉门诊 ENTOP260814-18','右耳听力下降 · 待内镜'],roles:['耳鼻喉医师','听力师','内镜技师','手术护士'],scopes:['耳科门诊','鼻科门诊','咽喉门诊','听力/内镜中心'],integrations:['纯音测听/声导抗','耳鼻喉内镜','专科影像','病理标本'],checkpoints:['部位与侧别一致','气道风险升级','内镜图像追溯','标本部位核对'],handoff:'门诊→检查/急诊气道处置/手术→听力语言随访，交接侧别、气道和设备报告',consent:'内镜、局麻操作、手术及医学图像使用分项授权',capacity:'多检查室并发'},
  dental:{patient:['王强','男 · 36岁 · 口腔患者号 DEN260731','口腔门诊 DENOP260814-33','FDI 46疼痛 · 根管计划'],roles:['口腔医师','口腔护士','影像技师','修复/种植技师'],scopes:['综合口腔','牙周/牙体','颌面外科','种植修复'],integrations:['牙位图','全景片/CBCT','治疗椅设备','材料/植入物追溯'],checkpoints:['FDI牙位一致','麻醉与过敏','材料批次扫码','操作收费对账'],handoff:'检查→影像→分期治疗→修复/种植→复诊，牙位、阶段、材料和未完治疗不可丢失',consent:'每次侵入操作、麻醉、拔牙、种植与材料方案按牙位签署',capacity:'诊椅+分期疗程并发'},
  dermatology:{patient:['孙悦','女 · 29岁 · 皮肤科患者号 DER260621','皮肤科门诊 DEROP260814-21','银屑病 · PASI 14.6'],roles:['皮肤科医师','皮肤科技师','治疗护士','病理医师'],scopes:['皮肤门诊','皮肤影像','光疗中心','日间治疗'],integrations:['皮损图谱/摄影','皮肤镜','病理系统','光疗/生物制剂管理'],checkpoints:['摄影授权与用途','皮损位置版本','用药前筛查','病理部位一致'],handoff:'门诊→影像/病理→光疗/生物制剂→随访，交接图像授权、累计剂量和筛查结果',consent:'医学摄影、皮肤活检、光疗及生物制剂分别授权并可撤回未来使用',capacity:'图像+疗程并发'},
  tcm:{patient:['张桂芳','女 · 58岁 · 中医患者号 TCM260112','中医门诊 TCMOP260814-12','眩晕病 · 气血亏虚证'],roles:['中医医师','中医护士','中药师','针灸推拿治疗师'],scopes:['中医门诊','中医病区','中药房','针灸推拿'],integrations:['中医术语库','中药审方','饮片追溯','治疗执行'],checkpoints:['四诊时间序列','病名证候双编码','理法方药一致','毒性饮片/配伍禁忌'],handoff:'门诊/病区→中药房或治疗室→疗效随访，交接证候版本、方药、煎法和穴位疗程',consent:'毒性饮片、特殊煎服、针刺高风险部位与中西医联合用药分别告知',capacity:'处方+调剂+疗程并发'}
};

function hospitalRecordCenterV12(){
  const rows=[
    ['门诊','陈建国','心内科','门诊病历','草稿 v4','硬阻断 1','09:42','opd-record'],
    ['住院','李桂兰','心内科一病区','首次病程记录','待上级审签','逾期 18 分','09:39','inpatient-course'],
    ['急诊','王秀兰','抢救区','抢救记录','补录中','双时间待核','09:36','er-record'],
    ['住院','周海峰','神经内科二病区','转科记录','已退回','缺接收意见','09:31','inpatient-course'],
    ['门诊','孙文静','内分泌科','随访评估','待签署','提醒 2','09:28','opd-record']
  ];
  return pageHead('全院病历中心','跨门诊、急诊、住院的文书任务与质量工作队列；进入具体病历前重新建立患者和就诊上下文','<button class="btn">导出责任清单</button><button class="btn primary">创建病历抽查</button>')+
    `<div class="metric-grid record-metrics"><div class="metric"><div class="name">今日应有文书</div><div class="value">1,286</div><div class="trend">门诊 864 · 急诊 92 · 住院 330</div></div><div class="metric"><div class="name">待审签</div><div class="value">73</div><div class="trend">逾期 12</div></div><div class="metric"><div class="name">硬阻断</div><div class="value danger-text">18</div><div class="trend">必须回到业务域处理</div></div><div class="metric"><div class="name">归档准备度</div><div class="value">96.4%</div><div class="trend">较昨日 +0.7%</div></div></div><section class="card"><div class="toolbar record-center-filters"><select class="select"><option>全部业务域</option><option>门诊</option><option>急诊</option><option>住院</option></select><select class="select"><option>全部院区/科室</option></select><select class="select"><option>按风险与时限</option></select><input class="search" placeholder="患者、就诊号、病历类型或责任人"><button class="btn">保存视图</button></div><table class="table"><thead><tr><th>业务域</th><th>患者</th><th>科室/病区</th><th>文书</th><th>状态</th><th>质量/时限</th><th>更新时间</th><th></th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td><span class="status ${x[0]==='住院'?'blue':x[0]==='急诊'?'red':'green'}">${x[0]}</span></td><td><b>${x[1]}</b></td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td><span class="status ${i<3?'amber':'blue'}">${x[5]}</span></td><td>${x[6]}</td><td><button class="btn sm" data-jump="${x[7]}">进入${x[0]}业务域</button></td></tr>`).join('')}</tbody></table><div class="card-body"><div class="notice info"><div class="notice-title">路由与上下文边界</div>全院病历中心只聚合任务和证据，不直接复用某个门诊患者的编辑上下文。点击后进入对应门诊、急诊或住院工作域，并重新校验患者关系、岗位权限、未保存草稿和 AI 会话。</div></div></section>`;
}

function specialtyPatientStripV12(profile){return `<div class="patient-strip specialty-context-strip"><div><div class="patient-name">${profile.patient[0]}</div><div class="meta">${profile.patient[1]}</div></div><div class="divider"></div><div><b>${profile.patient[2]}</b><div class="meta">${profile.patient[3]}</div></div><div class="divider"></div><span class="risk red">专科风险已锁定</span><span class="risk blue">合成患者</span><button class="btn sm" style="margin-left:auto">切换专科患者</button></div>`}

function specialtyPageV12(key,mode){
  const d=specialtyDefinitions[key],p=specialtyProfilesV12[key];
  const scopeChips=`<div class="specialty-scope-bar"><b>业务场景</b>${p.scopes.map(x=>`<span>${x}</span>`).join('')}<em>${p.capacity}</em></div>`;
  if(mode==='workbench')return pageHead(`${d.label}工作台`,`${d.sub} · 多角色、多场景任务与风险总览`,`<button class="btn">交班与未完任务</button><button class="btn primary" data-jump="${key}-record">接诊当前患者</button>`)+scopeChips+`<div class="metric-grid compact-metrics">${d.metrics.map((x,i)=>`<div class="metric"><div class="name">${x[0]}</div><div class="value ${i===2?'danger-text':''}">${x[1]}</div><div class="trend">按患者、场景与责任人下钻</div></div>`).join('')}</div><div class="grid specialty-ops-grid"><section class="card"><div class="card-head">专科诊疗队列 <span class="sub">风险、时限、位置、责任人共同排序</span></div><table class="table"><thead><tr><th>对象</th><th>业务场景</th><th>当前阶段</th><th>责任角色</th><th>关键资料</th><th>状态</th></tr></thead><tbody>${[['当前高风险患者',p.scopes[0],d.flow[1],p.roles[0],d.fields[2][1],'立即处理','red'],['连续诊疗患者',p.scopes[2],d.flow[3],p.roles[1],d.fields[4][1],'待复核','amber'],['新接诊患者',p.scopes[0],d.flow[0],p.roles[0],'身份/授权已核验','可接诊','green'],['交接患者',p.scopes[3],d.flow[4],p.roles[2],'未完任务 2 项','待接手','blue']].map(x=>`<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td><span class="status ${x[6]}">${x[5]}</span></td></tr>`).join('')}</tbody></table><div class="coverage-flow">${d.flow.map((x,i)=>`<span><i>${i+1}</i>${x}</span>`).join('<b>›</b>')}</div></section><aside class="card"><div class="card-head">安全与协同</div><div class="card-body"><div class="notice hard"><div class="notice-title">专业硬阻断</div>${d.risk}</div><div class="section-title">协作角色</div><div class="specialty-role-chips">${p.roles.map(x=>`<span>${x}</span>`).join('')}</div><div class="section-title">专业接口</div>${p.integrations.map(x=>`<div class="folder-row">${x}<span>来源/版本可追溯</span></div>`).join('')}<button class="btn primary full-btn" data-jump="${key}-care">进入关键流程</button></div></aside></div>`;
  if(mode==='record')return pageHead(`${d.label}专科病历`,`${d.sub} · 通用法定病历与专科数据共同形成可签署版本`,`<button class="btn">历次专科记录</button><button class="btn" data-jump="${key}-qc">运行质控</button><button class="btn primary">提交审签</button>`)+specialtyPatientStripV12(p)+`<div class="grid specialty-record-layout"><section class="card"><div class="card-head">通用病历与专科结构化记录 <span class="status amber">草稿 v3</span></div><div class="card-body"><div class="specialty-general-record">${[['主诉/就诊原因',d.sub],['现病史/本次事件','当前风险与病程已由责任医师核验'],['既往史/过敏/用药','已核验 · 来源 4 条'],['诊断与鉴别','待责任医师确认'],['计划与随访',d.flow.slice(2).join(' → ')],['知情与授权',p.consent]].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div><div class="section-title">专科字段</div><div class="setting-grid">${d.fields.map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div><div class="section-title">文书与事件目录</div><table class="table"><thead><tr><th>文书/记录</th><th>触发</th><th>责任</th><th>状态</th></tr></thead><tbody>${d.docs.map((x,i)=>`<tr><td><b>${x}</b></td><td>${d.flow[Math.min(i,d.flow.length-1)]}</td><td>${p.roles[i%p.roles.length]}</td><td><span class="status ${i<2?'amber':'blue'}">${i<2?'草稿/待确认':'按事件创建'}</span></td></tr>`).join('')}</tbody></table></div></section><aside class="card"><div class="card-head">来源、AI 与签署门禁</div><div class="card-body"><div class="notice ai"><div class="notice-title">✦ ${d.label}病历助手</div>只能根据当前患者、当前就诊和已授权来源生成候选；设备测量、专科评分、身份核对和操作结果不得由模型补造。</div><div class="notice hard"><div class="notice-title">不可自动放行</div>${d.risk}</div>${p.integrations.map(x=>`<div class="folder-row">${x}<span>已关联版本</span></div>`).join('')}${d.qc.slice(0,4).map(x=>`<div class="folder-row">${x}<span>待核验</span></div>`).join('')}<div class="notice info"><div class="notice-title">访问与签署</div>${p.roles.join('、')}按职责分段记录；最终签署仍由具备资质的责任医务人员完成。</div></div></aside></div>`;
  if(mode==='care')return pageHead(`${d.label}关键诊疗流程`,`${d.flow.join(' → ')} · 在途实例绑定流程版本与责任人`,`<button class="btn">流程版本/差异</button><button class="btn primary">进入当前任务</button>`)+scopeChips+`<div class="grid specialty-care-layout"><section class="card"><div class="card-head">状态机、任务与专业核查</div><div class="card-body"><div class="coverage-flow">${d.flow.map((x,i)=>`<span><i>${i+1}</i>${x}</span>`).join('<b>›</b>')}</div><div class="specialty-task-grid">${d.care.map((x,i)=>`<div class="specialty-task ${i===1?'current':''}"><span>${String(i+1).padStart(2,'0')}</span><b>${x}</b><small>${p.roles[i%p.roles.length]} · ${i===0?'已完成':i===1?'进行中':'待前置条件'}</small><em>${p.integrations[i%p.integrations.length]}</em></div>`).join('')}</div></div></section><aside class="card"><div class="card-head">异常、交接与恢复</div><div class="card-body"><div class="notice hard"><div class="notice-title">当前阻断</div>${d.risk}</div>${p.checkpoints.map(x=>`<div class="folder-row">${x}<span>强制核验</span></div>`).join('')}<div class="notice info"><div class="notice-title">跨场景交接</div>${p.handoff}</div>${[['中断恢复','保留已完成节点、原始事实和流程版本'],['重复提交','幂等返回原业务结果'],['撤销/退回','反向状态留原因，不删除已执行事实'],['停机补录','同时记录事件时间与补录时间']].map(x=>`<div class="folder-row">${x[0]}<span>${x[1]}</span></div>`).join('')}</div></aside></div>`;
  return pageHead(`${d.label}质控与安全`,`书写中、签署前、运行病历、终末质量和科室改进闭环`,`<button class="btn">抽取质控样本</button><button class="btn primary">创建整改任务</button>`)+`<div class="metric-grid compact-metrics">${[['今日规则命中','38'],['硬阻断','3'],['待人工复核','12'],['整改闭环率','95.8%']].map((x,i)=>`<div class="metric"><div class="name">${x[0]}</div><div class="value ${i===1?'danger-text':''}">${x[1]}</div><div class="trend">可回到患者、字段、规则版本</div></div>`).join('')}</div><div class="grid specialty-qc-layout"><section class="card"><div class="card-head">专科质量规则与证据</div><table class="table"><thead><tr><th>规则</th><th>检查阶段</th><th>证据来源</th><th>严重度</th><th>处置</th></tr></thead><tbody>${d.qc.map((x,i)=>`<tr><td><b>${x}</b></td><td>${i<2?'书写中':i<4?'签署前':'终末质控'}</td><td>${p.integrations[i%p.integrations.length]} + 病历版本</td><td><span class="status ${i===0?'red':i<3?'amber':'blue'}">${i===0?'硬阻断':'人工复核'}</span></td><td>${i===0?'修正并重跑':'确认、整改或有权豁免'}</td></tr>`).join('')}</tbody></table></section><aside class="card"><div class="card-head">不可豁免与改进闭环</div><div class="card-body"><div class="notice hard"><div class="notice-title">专业安全不变量</div>${d.risk}</div>${p.checkpoints.map(x=>`<div class="folder-row">${x}<span>证据完整</span></div>`).join('')}${[['规则版本',`${key.toUpperCase()}-QC-2026.08`],['责任科室',d.label],['整改时限','业务终态前'],['复核角色',p.roles[0]],['审计证据','原值、修改、签署、规则水位']].map(x=>`<div class="folder-row">${x[0]}<span>${x[1]}</span></div>`).join('')}</div></aside></div>`;
}

renderers.record=hospitalRecordCenterV12;
specialtyKeys.forEach(key=>['workbench','record','care','qc'].forEach(mode=>{renderers[`${key}-${mode}`]=()=>specialtyPageV12(key,mode)}));
const renderBeforeV12=render;
render=function(){renderBeforeV12();const navTitle=document.querySelector('.subpage-nav>b');if(recordRoutes.includes(current)&&navTitle)navTitle.textContent=current==='record'?'全院病历中心':'当前患者病历';const specialtyKey=specialtyKeys.find(key=>current.startsWith(`${key}-`));if(specialtyKey){const p=specialtyProfilesV12[specialtyKey],d=specialtyDefinitions[specialtyKey];const context=document.querySelector('.domain-context');if(context)context.textContent=`${d.label} · ${p.roles[0]}⌄`;const aiContext=document.querySelector('.ai-panel-head small');if(aiContext)aiContext.textContent=`${p.patient[0]} · ${p.patient[2]} · 当前专科页面`}}
render();

const renderWithSpecialtyHierarchyV12=render;
render=function(){
  renderWithSpecialtyHierarchyV12();
  if(specialtyKeys.some(key=>current.startsWith(`${key}-`))){
    const main=document.querySelector('.main');
    const specialtyNavElement=main?.querySelector('.specialty-nav');
    const specialtySubNavElement=main?.querySelector('.subpage-nav');
    if(main&&specialtyNavElement&&specialtySubNavElement)main.insertBefore(specialtyNavElement,specialtySubNavElement);
  }
};
render();

const renderWithContextBoundaryV12=render;
render=function(){
  renderWithContextBoundaryV12();
  if(current==='record'){
    const context=document.querySelector('.domain-context');
    if(context)context.textContent='全院病历中心 · 跨域任务⌄';
    const search=document.querySelector('.top-search input');
    if(search)search.placeholder='搜索业务域、患者、就诊号、病历类型或责任人';
    const aiTitle=document.querySelector('.ai-panel-head b');
    const aiContext=document.querySelector('.ai-panel-head small');
    if(aiTitle)aiTitle.textContent='全院病历任务助手';
    if(aiContext)aiContext.textContent='未选择单一患者 · 不读取病历正文';
    const aiAlert=document.querySelector('.ai-alert-card');
    if(aiAlert)aiAlert.innerHTML='<b>现在提醒 · 全院任务</b><p>18 份病历存在硬阻断，12 份审签任务已经逾期。请选择任务并进入对应业务域处理。</p>';
    document.getElementById('aiNudge')?.remove();
  }
};
render();

const renderWithRouteGuardV12=render;
render=function(){
  renderWithRouteGuardV12();
  if(current==='clinical'){
    const outpatientRecordEntry=document.querySelector('.outpatient-domain .module-map button:nth-child(2)');
    if(outpatientRecordEntry)outpatientRecordEntry.dataset.jump='opd-record';
  }
};
render();

// 所有扩展路由注册完成后，恢复浏览器地址中的直达路由。
// 基础 app.js 在扩展脚本加载前会暂时回退门户页，这里必须以最终完整路由表重建页面。
const deepLinkRouteV12=location.hash.slice(1)||'clinical';
if(renderers[deepLinkRouteV12]){
  current=deepLinkRouteV12;
  render();
}
