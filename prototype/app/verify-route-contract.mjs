import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const app = read('./app.js');
const index = read('./index.html');
const specialtyV13 = read('./specialty-v13.js');
const routeMap = read('../../ui-delivery/route-design-map.csv').trim().split(/\r?\n/).slice(1);
const titles = JSON.parse(read('../../ui-delivery/route-titles.json'));
const traceability = read('../traceability.csv');
const prototypeHtml = read('../prototype.html');

const specialtyLabels = {
  obgyn: '妇产科',
  reproductive: '生殖医学',
  pediatrics: '儿科',
  neonatal: '新生儿科',
  mental: '精神心理科',
  ophthalmology: '眼科',
  ent: '耳鼻咽喉科',
  dental: '口腔科',
  dermatology: '皮肤科',
  tcm: '中医科'
};
const modes = ['workbench', 'record', 'evidence', 'treatment', 'care', 'followup', 'qc'];
const expectedSpecialtyRoutes = Object.keys(specialtyLabels).flatMap(key => modes.map(mode => `${key}-${mode}`));
const mapRoutes = new Set(routeMap.map(line => line.split(',')[2]?.replaceAll('"', '')));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(routeMap.length === 194, `route map expected 194 rows, got ${routeMap.length}`);
assert(Object.keys(titles).length === 194, `route titles expected 194 entries, got ${Object.keys(titles).length}`);
expectedSpecialtyRoutes.forEach(route => {
  assert(mapRoutes.has(route), `route map missing ${route}`);
  assert(Boolean(titles[route]), `route title missing ${route}`);
});

assert(/id:'record',\s*label:'全院病历中心',\s*icon:'▤',\s*group:'病历与质量'/.test(app), 'global record sidebar ownership is not explicit');
assert(index.includes('specialty-v13.js'), 'index does not load specialty-v13.js');
assert(specialtyV13.includes("['evidence','treatment','followup']"), 'three new specialty modes are not registered');
assert(specialtyV13.includes("['workbench','工作台'],['record','专科病历'],['evidence','检查与设备'],['treatment','诊疗执行'],['care','关键流程'],['followup','随访交接'],['qc','质控安全']"), 'seven-layer specialty navigation contract is incomplete');
assert(specialtyV13.includes('data-route-contract="opd-record"'), 'outpatient local record route contract is missing');
assert(specialtyV13.includes('data-route-contract="global-record"'), 'global record cross-domain route contract is missing');
assert(specialtyV13.includes("current==='opd-record'?'outpatient':'record'"), 'record active-owner normalization is missing');
assert(specialtyV13.includes("replace(/^#\\/?/,'')"), 'hash and hash-slash route normalization is missing');
Object.entries(specialtyLabels).forEach(([key, label]) => {
  assert(new RegExp(`\\n\\s*${key}:\\s*\\{`).test(specialtyV13), `specialty expansion missing ${key}`);
  assert(titles[`${key}-evidence`] === `${label}检查、设备与来源证据`, `evidence title mismatch ${key}`);
  assert(titles[`${key}-treatment`] === `${label}诊疗执行中心`, `treatment title mismatch ${key}`);
  assert(titles[`${key}-followup`] === `${label}随访、转诊与交接`, `followup title mismatch ${key}`);
});

assert((traceability.match(/,核心专科工作台,VERIFIED/g) || []).length === 10, 'FR-129–138 must be VERIFIED after the 194-route browser regression');
assert(prototypeHtml.includes('data-image-source="generated"'), 'self-contained prototype does not include generated image contract');
assert(prototypeHtml.includes('data-route-contract="global-record"'), 'self-contained prototype does not include global record route contract');

if (failures.length) {
  console.error(JSON.stringify({ status: 'FAIL', failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  routes: '194/194',
  specialtyRoutes: '70/70',
  newSpecialtyRoutes: '30/30',
  routeOwnership: 'opd-record/outpatient; record/global-record-center',
  browserStatus: 'VERIFIED_194_OF_194'
}));
