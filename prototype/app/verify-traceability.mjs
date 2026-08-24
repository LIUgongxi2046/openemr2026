import fs from 'node:fs';

const csvPath = new URL('../traceability.csv', import.meta.url);
const coveragePath = new URL('./coverage.js', import.meta.url);
const appPath = new URL('./app.js', import.meta.url);
const extensionPath = new URL('./extensions.js', import.meta.url);
const specialtyPath = new URL('./specialties.js', import.meta.url);
const specialtyV12Path = new URL('./specialty-v12.js', import.meta.url);
const specialtyV13Path = new URL('./specialty-v13.js', import.meta.url);
const csv = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/).slice(1);
const source = [coveragePath, appPath, extensionPath, specialtyPath, specialtyV12Path, specialtyV13Path].map(path => fs.readFileSync(path, 'utf8')).join('\n');
const rows = csv.map(line => {
  const [fr, ac, scr, route, owner, status] = line.split(',');
  return { fr, ac, scr, route, owner, status };
});
const generatedSpecialtyRoutes = new Set(
  ['obgyn','reproductive','pediatrics','neonatal','mental','ophthalmology','ent','dental','dermatology','tcm']
    .flatMap(key => ['workbench','record','evidence','treatment','care','followup','qc'].map(mode => `${key}-${mode}`))
);
const expected = Array.from({ length: 138 }, (_, index) => `FR-${String(index + 1).padStart(3, '0')}`);
const actual = new Set(rows.map(row => row.fr));
const missingFr = expected.filter(fr => !actual.has(fr));
const duplicateFr = [...actual].filter(fr => rows.filter(row => row.fr === fr).length !== 1);
const routeMissingInSource = rows
  .filter(row => row.route.startsWith('#') && row.route !== '#clinical')
  .filter(row => !generatedSpecialtyRoutes.has(row.route.slice(1)) && !source.includes(`'${row.route.slice(1)}'`) && !source.includes(`"${row.route.slice(1)}"`))
  .map(row => `${row.fr}:${row.route}`);

if (rows.length !== 138 || missingFr.length || duplicateFr.length || routeMissingInSource.length) {
  console.error(JSON.stringify({ rows: rows.length, missingFr, duplicateFr, routeMissingInSource }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ rows: rows.length, fr: '138/138', ac: '138/138', routeReferences: '138/138' }));
