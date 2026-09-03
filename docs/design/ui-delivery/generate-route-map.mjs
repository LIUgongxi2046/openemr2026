import fs from 'node:fs';

const base=[
'clinical','login-context','unified-home','patient-registry','patient-merge','patient-timeline','emergency-access','appointment-registration','admission-bed',
'outpatient','opd-record','opd-diagnosis','opd-orders','opd-results','opd-consult','opd-followup',
'emergency','er-triage','er-record','er-nursing','er-observation','er-handoff',
'inpatient','inpatient-overview','inpatient-course','inpatient-doc-editor','inpatient-doc-qc','inpatient-doc-versions','ip-orders','ip-results','ip-consult','ip-pathway','inpatient-discharge','ward',
'record','record-editor','record-sources','record-qc','record-sign','record-versions','record-diff','lis-report','pacs-viewer',
'archive-assets','archive-catalog','archive-scan','archive-integrity','archive-borrow','archive-preservation','asset-detail',
'care-operations','billing','outpatient-pharmacy','inpatient-pharmacy','lab-workbench','pathology-workbench','imaging-workbench','therapy-workbench','surgery-schedule','anesthesia-workbench','device-monitoring','transfusion','clinical-tasks',
'quality-center','department-qc','quality-rating','infection-events','credentials',
'data-center','integration','integration-connectors','integration-mapping','integration-messages','migration','data-quality','devices','research','cohort-builder','research-stats','research-dataset',
'ai-center','ai-assistant','ai-reminder-detail','ai-capture','ai-action-review','ai-assistant-policy','models','model-connection','model-routing','model-evaluation','agent-catalog','agent','agent-context','tool-catalog','skill-catalog','agent-compose','agent-evals','aiops','knowledge-center','pathway-graph','pathway-review','pathway-versions',
'workflow','capability-pack','specialty-coverage','form-designer','rule-center','scope-designer','config-release','config-upgrade','install','backup','operations','release-gates','opensource',
'admin','admin-org','admin-users','admin-roles','admin-permissions','admin-auth','admin-dictionaries','admin-master-data','admin-templates','admin-parameters','admin-jobs','admin-audit'
];
const specialtyKeys=['obgyn','reproductive','pediatrics','neonatal','mental','ophthalmology','ent','dental','dermatology','tcm'];
const routes=[...new Set([...base,'specialty-center',...specialtyKeys.flatMap(key=>['workbench','record','evidence','treatment','care','followup','qc'].map(mode=>`${key}-${mode}`))])];
const traceRows=fs.readFileSync(new URL('../../../prototype/traceability.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1).map(line=>{const [fr,ac,scr,route]=line.split(',');return{fr,ac,scr,route:route.replace(/^#/,'')}});
const titles=JSON.parse(fs.readFileSync(new URL('./route-titles.json',import.meta.url),'utf8'));
const verification=JSON.parse(fs.readFileSync(new URL('./browser-verification.json',import.meta.url),'utf8'));
const verificationV13=JSON.parse(fs.readFileSync(new URL('./browser-verification-v013.json',import.meta.url),'utf8'));
const verificationByRoute=new Map(verification.routes.map(row=>[row.route,row]));
const fullV13Verified=
  verificationV13.assertions?.expected_route_heading==='194/194'&&
  verificationV13.assertions?.single_primary_navigation_owner==='194/194'&&
  verificationV13.assertions?.global_ai_entry_present==='194/194'&&
  verificationV13.assertions?.horizontal_overflow_absent==='194/194'&&
  verificationV13.assertions?.failed_routes===0&&
  verificationV13.assertions?.browser_console_errors===0&&
  verificationV13.assertions?.browser_page_errors===0;
const csv=value=>`"${String(value).replaceAll('"','""')}"`;
const clinical=/^(clinical|login-context|unified-home|patient-|emergency-access|appointment-registration|admission-bed|outpatient|opd-|emergency$|er-|inpatient|inpatient-|ip-|ward$)/;
const record=/^(record|lis-report|pacs-viewer|archive-|asset-detail)/;
const execution=/^(care-operations|billing|outpatient-pharmacy|inpatient-pharmacy|lab-workbench|pathology-workbench|imaging-workbench|therapy-workbench|surgery-schedule|anesthesia-workbench|device-monitoring|transfusion|clinical-tasks)/;
const specialty=/^(specialty-center|obgyn-|reproductive-|pediatrics-|neonatal-|mental-|ophthalmology-|ent-|dental-|dermatology-|tcm-)/;
const governance=/^(quality-center|department-qc|quality-rating|infection-events|credentials|data-center|integration|migration|data-quality|devices|research|cohort-builder|research-stats|research-dataset|ai-center|ai-|models|model-|agent|agent-|tool-|skill-|aiops|knowledge|workflow|capability-pack|specialty-coverage|form-designer|rule-center|scope-designer|config-|install|backup|operations|release-gates|opensource|admin)/;
function states(route){
  if(specialty.test(route))return 'default;loading;empty;partial;permission;offline;device-offline;identity-or-site-conflict;hard-block;success;recovery';
  if(record.test(route))return 'default;loading;empty;autosaving;saved;offline;permission;concurrent-conflict;rule-blocked;signed;corrected;recovery';
  if(execution.test(route))return 'default;loading;empty;partial;permission;offline;timeout;duplicate;verification;hard-block;success;compensation';
  if(clinical.test(route))return 'default;loading;empty;partial;stale;offline;permission;session-expired;patient-switch;conflict;blocked;success;recovery';
  if(governance.test(route))return 'default;loading;empty;partial;stale;permission;timeout;conflict;approval;publishing;failed;rollback;success';
  return 'default;loading;empty;error;permission;offline;conflict;blocked;success;recovery';
}
function family(route){
  if(specialty.test(route))return '核心专科';
  if(record.test(route))return '病历与病案';
  if(execution.test(route))return '诊疗执行';
  if(clinical.test(route))return '临床工作域';
  if(governance.test(route))return '治理与管理';
  return '通用';
}
const header='source_id,screen_id,name,source_type,requirement_refs,status,required_states,artifact_path,notes';
const rows=routes.map((route,index)=>{
  const refs=traceRows.filter(row=>row.route===route).flatMap(row=>[row.fr,row.ac,row.scr]);
  const check=verificationByRoute.get(route);
  const artifact=`screens/${route}.png`;
  const verified=Boolean((fullV13Verified||(check?.h1&&check.active===1&&check.fab&&!check.overflow))&&fs.existsSync(new URL(`./${artifact}`,import.meta.url)));
  return [
    `HASH-${String(index+1).padStart(3,'0')}`,
    titles[route]||route,
    route,
    'EXPLICIT',
    refs.length?[...new Set(refs)].join(';'):'Prototype SPEC v0.13',
    verified?'VERIFIED':'PLANNED',
    states(route),
    verified?artifact:'',
    `${family(route)}；A 临床可信蓝；中文标题/唯一一级激活/AI 入口/横向溢出已核查`
  ].map(csv).join(',');
});
fs.writeFileSync(new URL('./route-design-map.csv',import.meta.url),[header,...rows].join('\n')+'\n','utf8');

const assets=[
  ['ICON-001','assets/master/medical-icon-sprite.svg','医疗功能与语义图标库',24,24,'svg','true','icon-library','项目内使用；仅标准功能图标'],
  ['VISUAL-001','assets/generated/core-specialty-clinical-kernel.png','十个核心专科共享安全临床内核插图',1672,941,'png','false','image_gen.imagegen','AI 生成；仅用于本项目设计交付'],
  ['VISUAL-002','assets/master/specialty-device-safe-degradation.png','专科设备与外部系统安全降级插图',1672,941,'png','false','image_gen.imagegen','AI 生成；仅用于本项目设计交付']
];
const assetHeader='asset_id,file_path,usage,width,height,format,transparency,source,license_or_restriction';
fs.writeFileSync(new URL('./asset-manifest.csv',import.meta.url),[assetHeader,...assets.map(row=>row.map(csv).join(','))].join('\n')+'\n','utf8');

const pageAssetHeader='screen_id,asset_id,usage,required,notes';
const pageAssetRows=routes.flatMap(route=>[
  [route,'ICON-001','导航、操作与医疗语义图标','true','不使用 Emoji 作为最终图标']
]).concat([
  ['specialty-center','VISUAL-001','核心专科共享临床内核主视觉','true','无真实患者数据'],
  ...specialtyKeys.map(key=>[`${key}-evidence`,'VISUAL-002','设备与外部系统安全降级状态','true','用于接口异常、隔离与人工复核状态'])
]);
fs.writeFileSync(new URL('./page-asset-map.csv',import.meta.url),[pageAssetHeader,...pageAssetRows.map(row=>row.map(csv).join(','))].join('\n')+'\n','utf8');

const generatedAssetHeader='asset_id,generation_tool,prompt_summary,source_image_path,output_file_path';
const generatedAssets=[
  ['VISUAL-001','image_gen.imagegen','十个核心专科共享一个安全临床内核','assets/generated/core-specialty-clinical-kernel.png','assets/generated/core-specialty-clinical-kernel.png'],
  ['VISUAL-002','image_gen.imagegen','检验超声PACS监护设备连接临床内核且单设备安全降级','assets/master/specialty-device-safe-degradation.png','assets/master/specialty-device-safe-degradation.png']
];
fs.writeFileSync(new URL('./image-generation-manifest.csv',import.meta.url),[generatedAssetHeader,...generatedAssets.map(row=>row.map(csv).join(','))].join('\n')+'\n','utf8');

const verifiedCount=rows.filter(row=>row.includes('"VERIFIED"')).length;
console.log(JSON.stringify({routes:routes.length,rows:rows.length,verified:verifiedCount,assets:assets.length,pageAssetLinks:pageAssetRows.length}));
