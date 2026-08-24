/* v0.13: deterministic record routing plus seven-layer core-specialty workflows */
const specialtyDeepModesV13=['evidence','treatment','followup'];
const specialtyDeepRoutesV13=specialtyKeys.flatMap(key=>specialtyDeepModesV13.map(mode=>`${key}-${mode}`));
specialtyRoutes.push(...specialtyDeepRoutesV13);

const specialtyExpansionV13={
  obgyn:{
    evidence:[['胎心监护 CTG','CTG-260820-031','基线 145 bpm · 变异正常','已由助产士确认'],['产科超声','US-OB-260820-118','单胎头位 · EFW 1420g','报告 v2'],['高危妊娠评估','MAT-RISK-09','子痫前期风险高','动态升级'],['产程/出血事件','DEL-EVT-031','产程未开始 · 备血已核','待产房接管']],
    treatment:[['高危孕产妇管理方案','产科医师','孕周/血压/蛋白尿/胎监联合核验','进行中'],['硫酸镁预案','产科医师+护士','适应证、剂量、呼吸/反射监测','待触发'],['备血与产后出血预案','产科+输血科','血型复核、用血授权、失血量闭环','已准备'],['分娩/手术安全核查','产科+麻醉+新生儿科','孕妇、胎儿、术式、团队四方确认','待执行']],
    followup:[['产房接管','助产士','母体风险、胎心、知情同意、未完检查'],['母婴交接','产科护士+新生儿科','母婴腕带、出生事件、Apgar、去向'],['产后 24h 复评','产科医师','出血量、血压、疼痛、血栓风险'],['42 天随访','产科/妇保','产后恢复、喂养、心理与避孕指导']]
  },
  reproductive:{
    evidence:[['激素监测','LIS-ART-0820','E2 1860 pg/ml · LH 3.2','周期 D10'],['生殖超声','US-ART-442','双侧卵泡 14–18mm 共 11 枚','医师确认'],['配子/胚胎台账','EMB-LEDGER-18','当前库存 6 · 载杆 3','双人对账'],['实验室环境','LAB-ENV-0820','温湿度/气体连续记录','无中断']],
    treatment:[['促排方案执行','生殖医师+护士','方案版本、体重、药品批号与注射时间','进行中'],['取卵触发','生殖医师','激素/卵泡/知情同意满足后双确认','待审批'],['受精培养操作','胚胎师双人','配子身份、培养皿、操作台与时钟','待前置'],['冷冻/移植','胚胎师+生殖医师','胚胎、载杆、位置、去向永久追溯','待前置']],
    followup:[['临床到取卵室','生殖护士','夫妇身份、周期、方案、触发时间'],['取卵室到胚胎实验室','双胚胎师','配子容器、数量、时间、操作人'],['实验室到移植室','胚胎师+医师','胚胎评级、载杆、移植计划、同意'],['妊娠后转产科','生殖医师','周期结局、用药、超声与高危信息']]
  },
  pediatrics:{
    evidence:[['生长曲线','WHO-CURVE-57M','身高 P42 · 体重 P38','月龄自动换算'],['当前体重证据','SCALE-PED-07','18.2 kg · 10:12','设备已校准'],['儿童剂量计算','DOSE-CALC-882','10 mg/kg · 单日上限校验','存在越界候选'],['疫苗/接触史','IMM-PH-2608','流感疫苗待核 · 园内暴露','公卫来源']],
    treatment:[['退热与补液方案','儿科医师','月龄、体重、脱水分级','执行中'],['抗感染候选审查','医师+药师','mg/kg、频次、最大单次/单日剂量','硬阻断'],['雾化/治疗执行','护士','监护人、药品、剂量、设备核对','待执行'],['危重升级','儿科急诊团队','复评时限、生命体征、转运资源','预案就绪']],
    followup:[['门诊到儿童急诊','儿科医师','分诊等级、体重时间、已用药剂量'],['急诊到病区','医护交接','监护人授权、隔离、未完结果'],['病区到儿童保健','责任医师','生长发育、疫苗、营养与康复'],['监护人随访','儿保护士','危险信号、用药、复诊时间与渠道']]
  },
  neonatal:{
    evidence:[['母婴身份链','BAND-NB-26082009','母婴双腕带 + 分娩事件','一致'],['监护/呼吸机','NICU-MON-19','HR 148 · SpO₂ 94% · CPAP','连续来源'],['黄疸趋势','TCB-NB-09','10.6 → 12.1 mg/dL','需复评'],['筛查标本','NBS-SPM-551','听力待做 · 遗传代谢已采','链路完整']],
    treatment:[['保温与呼吸支持','新生儿医师+护士','胎龄、体重、设备参数与告警','执行中'],['喂养计划','医师+护士','ml/kg、途径、耐受与出入量','进行中'],['黄疸处置','新生儿医师','小时龄曲线、血型、胆红素来源','待复评'],['筛查与免疫','筛查人员','腕带、标本、采集时间、去向','部分完成']],
    followup:[['产房到 NICU','产科+新生儿科','出生事件、Apgar、复苏、双腕带'],['NICU 班次交接','责任医护','呼吸参数、喂养、出入量、告警'],['NICU 到母婴同室','医护+监护人','风险稳定、喂养能力、身份复核'],['出院到儿童保健','新生儿医师','筛查结论、早产随访、喂养与复诊']]
  },
  mental:{
    evidence:[['精神检查','MSE-260820-17','意识清 · 情绪低落 · 定向完整','医师记录'],['自杀风险量表','C-SSRS-17','中危 · 需 4h 复评','动态版本'],['药物监测','LIS-PSY-882','锂浓度/肝肾功能','结果已确认'],['授权与隐私','AUTH-PSY-17','本人同意 · 姐姐应急联系人','最小披露']],
    treatment:[['危机安全计划','精神科医师+患者','危险工具、联系人、求助路径','已建立'],['药物治疗','医师+药师','相互作用、实验室监测、依从性','进行中'],['心理治疗','治疗师','目标、频次、授权范围','已预约'],['保护性措施','医师+护士','适应证、最短时限、复核与解除','当前未启用']],
    followup:[['门诊到危机处置','精神科医师','风险等级、计划、可获得工具、责任人'],['危机到精神病区','医护交接','非自愿依据、授权、观察级别、药物'],['病区到社区精防','授权人员','最小必要风险与随访任务'],['患者/监护人随访','责任治疗师','危机计划、依从性、复评时间']]
  },
  ophthalmology:{
    evidence:[['验光/视力','REF-EYE-041','OD 0.3→0.8 · OS 0.6→1.0','设备来源'],['眼压','IOP-EYE-041','OD 26 · OS 18 mmHg','校准有效'],['OCT/眼底照相','OCT-260820-221','视盘 C/D 0.7/0.5','Study v2'],['手术侧别证据','SIDE-EYE-041','计划右眼 · 同意书右眼','待三方核查']],
    treatment:[['降眼压方案','眼科医师','OD/OS、禁忌、目标眼压','执行中'],['散瞳检查','眼科医师+护士','眼压/前房/过敏禁忌','已完成'],['日间手术计划','术者+护士','患者、右眼、术式、人工晶体','待核查'],['术后用药与复诊','眼科医师','眼别、频次、感染警示','待手术']],
    followup:[['检查中心回门诊','验光师/技师','双眼测量、设备、时间、图像版本'],['门诊到日间手术','术者','眼别、术式、同意、植入物型号'],['手术到病区/离院','护士','眼罩侧别、用药、疼痛与警示'],['术后随访','眼科医师','视力、眼压、切口、植入物与并发症']]
  },
  ent:{
    evidence:[['纯音测听','AUD-260820-018','右耳 45 dB HL','听力师确认'],['声导抗','TYM-260820-018','右耳 B 型','设备校准有效'],['鼻/咽喉内镜','SCOPE-ENT-018','下鼻甲肥大 · 声带活动对称','图像 v1'],['病理标本链','SPM-ENT-018','右侧声带病灶','待送检']],
    treatment:[['气道风险处置','耳鼻喉医师+急诊','血氧、喉镜、插管/气切资源','预案就绪'],['耳科治疗','耳科医师','右耳侧别、鼓膜、听力结果','进行中'],['内镜操作','医师+技师','部位、授权、图像与器械批次','已完成'],['手术/标本送检','术者+护士','侧别、部位、容器与病理申请','待前置']],
    followup:[['门诊到听力/内镜中心','专科医师','侧别、部位、问题与禁忌'],['检查到急诊气道处置','医师','血氧、风险等级、图像、已用药'],['手术到病理','手术护士','部位、容器、数量、离体/固定时间'],['治疗后随访','专科医师','听力/发音、创面、报告与复诊']]
  },
  dental:{
    evidence:[['FDI 牙位图','TOOTH-CHART-033','46 远中邻面龋','版本 v3'],['牙周检查','PERIO-260820-033','46MB 5 mm','六点记录'],['全景片/CBCT','CBCT-260820-033','46 根尖区低密度影','Study v1'],['材料/植入物','MAT-DEN-033','全冠材料待选','未扫码']],
    treatment:[['根管治疗阶段 1','口腔医师+护士','患者、46牙、麻醉、器械计数','进行中'],['根管治疗阶段 2','口腔医师','工作长度、冲洗、充填影像','待前置'],['全冠修复','修复医师+技师','牙位、预备体、材料与色号','待计划'],['材料结算','护士+收费','材料批次、实际操作、收费项目','待执行']],
    followup:[['检查到 CBCT','口腔医师','FDI 牙位、区域、妊娠与影像理由'],['分期治疗交接','治疗医师','已完成步骤、暂封、用药、下次计划'],['治疗到修复技师','修复医师','牙位、印模/扫描、材料与色号'],['术后复诊','口腔医师','疼痛、咬合、影像与材料追溯']]
  },
  dermatology:{
    evidence:[['皮损图谱','MAP-DERM-021','躯干/双上肢 · BSA 12%','位置版本 v4'],['PASI/SCORAD','PASI-260820-021','PASI 14.6','计算可回放'],['皮肤镜/摄影','DERM-SCOPE-021','Study 21 · 诊疗授权','用途受限'],['病理/感染筛查','PATH-DERM-021','结核待回 · 乙肝阴性','用药前门禁']],
    treatment:[['外用治疗','皮肤科医师','部位、面积、剂量与疗程','执行中'],['光疗疗程','医师+治疗护士','皮型、累计剂量、设备校准','待筛查'],['皮肤活检','医师+护士','部位图、容器、摄影授权','已计划'],['生物制剂','医师+药师','感染筛查、疫苗、剂量与冷链','硬阻断']],
    followup:[['门诊到皮肤影像','皮肤科医师','部位、用途授权、前次版本'],['影像/活检到病理','医护交接','部位图、容器、离体/固定时间'],['门诊到光疗中心','治疗护士','处方、剂量、累计量与不良反应'],['疗效随访','皮肤科医师','PASI/BSA、同部位图像、筛查与药物']]
  },
  tcm:{
    evidence:[['四诊记录','TCM-4D-012','舌淡胖苔白腻 · 脉沉细','采集时间一致'],['病名证候','TCM-CODE-012','眩晕病 / 气血亏虚证','术语 v2026.2'],['中药审方','RX-TCM-012','归脾汤加减 · 附子候选','毒性门禁'],['饮片追溯','HERB-LOT-012','产地/炮制/批次可追溯','库存已锁定']],
    treatment:[['辨证论治方案','中医医师','四诊、病名、证候、治法一致','待确认'],['中药处方审方','中医师+中药师','剂量、炮制、煎法、配伍禁忌','硬阻断'],['针灸治疗','医师+治疗师','穴位、侧别、深度、禁忌与针具','已预约'],['中西医联合用药','中医师+药师','相互作用、肝肾功能与疗效','待复核']],
    followup:[['病历到中药房','中医师+中药师','证候版本、方剂、加减、煎服法'],['中药房到患者','中药师','饮片批次、煎煮、服法与警示'],['病历到针灸推拿','治疗师','穴位/部位、疗程、禁忌与知情'],['证候疗效随访','中医医师','四诊变化、证候转归、方药调整']]
  }
};

function specialtySubNavV13(key,active){
  const d=specialtyDefinitions[key];
  const modes=[['workbench','工作台'],['record','专科病历'],['evidence','检查与设备'],['treatment','诊疗执行'],['care','关键流程'],['followup','随访交接'],['qc','质控安全']];
  return `<div class="subpage-nav specialty-subnav-v13"><b>${d.label}</b>${modes.map(([mode,label])=>`<button class="${active===`${key}-${mode}`?'active':''}" data-jump="${key}-${mode}">${label}</button>`).join('')}</div>`;
}
specialtySubNav=specialtySubNavV13;

function specialtyEvidencePageV13(key){
  const d=specialtyDefinitions[key],p=specialtyProfilesV12[key],x=specialtyExpansionV13[key];
  return pageHead(`${d.label}检查、设备与来源证据`,`专业结果先形成可追溯业务对象，再由医生确认引用到病历`,`<button class="btn" data-prototype-action="刷新来源">刷新来源</button><button class="btn primary" data-jump="${key}-treatment">进入诊疗执行</button>`)+specialtyPatientStripV12(p)+
    `<div class="grid specialty-evidence-layout"><section class="card"><div class="card-head">当前专业对象与版本 <span class="status green">来源链完整</span></div><table class="table"><thead><tr><th>对象</th><th>来源/业务号</th><th>结果或状态</th><th>确认状态</th><th></th></tr></thead><tbody>${x.evidence.map((row,index)=>`<tr><td><b>${row[0]}</b></td><td>${row[1]}</td><td>${row[2]}</td><td><span class="status ${index===2?'amber':'green'}">${row[3]}</span></td><td><button class="btn sm" data-prototype-action="打开${row[0]}证据">证据</button></td></tr>`).join('')}</tbody></table><div class="card-body"><div class="notice info"><div class="notice-title">来源契约</div>每个对象保留患者、就诊、专业对象、设备/系统、采集时间、单位、版本、确认人和更正链；厂商字段不会直接写入核心病历。</div></div></section><aside class="card"><div class="card-head">接口健康与降级</div><div class="card-body">${p.integrations.map((item,index)=>`<div class="folder-row">${item}<span class="status ${index===2?'amber':'green'}">${index===2?'延迟 2m':'正常'}</span></div>`).join('')}<div class="notice rule"><div class="notice-title">外部系统不可用</div>进入人工采集/复核队列，保留来源缺失标记；恢复后逐对象对账，不自动补写病历或覆盖人工事实。</div><button class="btn full-btn" data-prototype-action="打开接口消息链">查看消息与对账链</button></div></aside></div>`;
}

function specialtyTreatmentPageV13(key){
  const d=specialtyDefinitions[key],p=specialtyProfilesV12[key],x=specialtyExpansionV13[key];
  return pageHead(`${d.label}诊疗执行中心`,`医嘱、操作、治疗、材料与结果共享临床内核，专业门禁在执行前重新校验`,`<button class="btn" data-prototype-action="查看医嘱集版本">医嘱集版本</button><button class="btn primary" data-jump="${key}-care">查看完整状态机</button>`)+specialtyPatientStripV12(p)+
    `<div class="grid specialty-treatment-layout"><section class="card"><div class="card-head">本次诊疗任务 <span class="sub">状态来自服务端执行对象</span></div><table class="table"><thead><tr><th>任务/方案</th><th>责任角色</th><th>执行前核查</th><th>状态</th><th></th></tr></thead><tbody>${x.treatment.map((row,index)=>`<tr><td><b>${row[0]}</b></td><td>${row[1]}</td><td>${row[2]}</td><td><span class="status ${row[3]==='硬阻断'?'red':index===0?'blue':'amber'}">${row[3]}</span></td><td><button class="btn sm ${row[3]==='硬阻断'?'danger':''}" data-prototype-action="${row[3]==='硬阻断'?'查看阻断证据':`打开${row[0]}`}">${row[3]==='硬阻断'?'不可执行':'处理'}</button></td></tr>`).join('')}</tbody></table></section><aside class="card"><div class="card-head">最高风险与人工控制</div><div class="card-body"><div class="notice hard"><div class="notice-title">不可绕过</div>${d.risk}</div>${p.checkpoints.map(item=>`<div class="folder-row">${item}<span>执行前重检</span></div>`).join('')}<div class="notice ai"><div class="notice-title">AI 边界</div>AI 只能解释和生成候选，不得创建真实测量、放行专业硬规则、自动签署或回传执行成功。</div></div></aside></div>`;
}

function specialtyFollowupPageV13(key){
  const d=specialtyDefinitions[key],p=specialtyProfilesV12[key],x=specialtyExpansionV13[key];
  return pageHead(`${d.label}随访、转诊与交接`,`诊疗结局、未完任务、风险、专业对象和责任人跨场景连续`,`<button class="btn" data-prototype-action="生成交接预览">交接预览</button><button class="btn primary" data-prototype-action="创建受控交接">创建受控交接</button>`)+specialtyPatientStripV12(p)+
    `<div class="grid specialty-followup-layout"><section class="card"><div class="card-head">交接与随访计划</div><div class="specialty-handoff-list">${x.followup.map((row,index)=>`<article><span>${String(index+1).padStart(2,'0')}</span><div><b>${row[0]}</b><small>${row[1]}</small><p>${row[2]}</p></div><em class="status ${index===0?'green':index===1?'blue':'amber'}">${index===0?'已完成':index===1?'当前':'待计划'}</em></article>`).join('')}</div></section><aside class="card"><div class="card-head">当前交接包</div><div class="card-body"><div class="notice info"><div class="notice-title">跨场景摘要</div>${p.handoff}</div>${[['身份与对象','患者/关系对象/专业对象不可重建'],['风险与门禁',p.checkpoints.slice(0,2).join('；')],['未完任务','2 项 · 均有责任人与时限'],['知情授权',p.consent],['恢复点','流程版本与最后成功节点已固化']].map(row=>`<div class="folder-row">${row[0]}<span>${row[1]}</span></div>`).join('')}<button class="btn primary full-btn" data-prototype-action="确认接收并留痕">确认接收并留痕</button></div></aside></div>`;
}

specialtyKeys.forEach(key=>{
  renderers[`${key}-evidence`]=()=>specialtyEvidencePageV13(key);
  renderers[`${key}-treatment`]=()=>specialtyTreatmentPageV13(key);
  renderers[`${key}-followup`]=()=>specialtyFollowupPageV13(key);
});

const specialtyCenterBeforeV13=renderers['specialty-center'];
renderers['specialty-center']=()=>specialtyCenterBeforeV13()
  .replace('<div class="hub-hero">',`<figure class="specialty-generated-hero"><img src="../assets/generated/core-specialty-clinical-kernel.png" alt="十个核心专科共享临床内核示意图" data-image-source="generated"><figcaption>十个核心专科共享患者、就诊、病历、医嘱、结果、签署、审计和 AI 安全内核。</figcaption></figure><div class="hub-hero">`)
  .replace('独立工作台、病历、关键流程与质控安全页面','工作台、专科病历、检查设备、诊疗执行、关键流程、随访交接与质控安全七层页面')
  .replace('40 个专业深页','70 个专业深页');

function normalizePrototypeRouteV13(hash){
  return String(hash||'').replace(/^#\/?/,'').split(/[?&]/)[0]||'clinical';
}

function showPrototypeToastV13(message){
  let toast=document.getElementById('prototypeToastV13');
  if(!toast){
    toast=document.createElement('div');
    toast.id='prototypeToastV13';
    toast.className='prototype-toast-v13';
    toast.setAttribute('role','status');
    document.body.appendChild(toast);
  }
  toast.textContent=`原型反馈：${message}`;
  toast.classList.add('show');
  clearTimeout(showPrototypeToastV13.timer);
  showPrototypeToastV13.timer=setTimeout(()=>toast.classList.remove('show'),2200);
}

function bindPrototypeActionsV13(){
  document.querySelectorAll('[data-prototype-action]').forEach(button=>{
    button.onclick=()=>showPrototypeToastV13(button.dataset.prototypeAction||'操作已记录');
  });
  document.querySelectorAll('button:not([data-page]):not([data-jump]):not([data-prototype-action]):not([data-ai-toggle]):not([data-ai-close]):not([data-ai-dismiss]):not(:disabled)').forEach(button=>{
    button.onclick=()=>showPrototypeToastV13((button.textContent||'操作').trim());
  });
}

const renderBeforeV13=render;
render=function(){
  renderBeforeV13();
  const main=document.querySelector('.main');
  if(main)main.dataset.screenId=current;
  const recordEntry=document.querySelector('[data-page="record"]');
  if(recordEntry){
    const label=recordEntry.querySelector('span:nth-child(2)');
    if(label)label.textContent='全院病历中心';
    recordEntry.setAttribute('title','跨门诊、急诊、住院的全院病历任务中心');
  }
  if(current==='outpatient'){
    const actions=document.querySelector('.page-head .head-actions');
    if(actions&&!actions.querySelector('[data-route-contract="opd-record"]')){
      actions.insertAdjacentHTML('afterbegin','<button class="btn" data-jump="opd-record" data-route-contract="opd-record">本次门诊病历</button><button class="btn" data-jump="record" data-route-contract="global-record">跨域：全院病历中心</button>');
    }
  }
  if(current==='opd-record'||current==='record'){
    document.querySelectorAll('.nav-item.active').forEach(item=>item.classList.remove('active'));
    document.querySelector(`[data-page="${current==='opd-record'?'outpatient':'record'}"]`)?.classList.add('active');
  }
  document.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>{
    current=button.dataset.jump;
    location.hash=current;
    render();
  });
  bindPrototypeActionsV13();
};

window.addEventListener('hashchange',()=>{
  const normalized=normalizePrototypeRouteV13(location.hash);
  if(current!==normalized&&renderers[normalized]){
    current=normalized;
    render();
  }
});

const initialRouteV13=normalizePrototypeRouteV13(location.hash);
if(renderers[initialRouteV13])current=initialRouteV13;
render();
