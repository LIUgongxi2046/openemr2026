export interface QualityOverviewMetric {
  label: string;
  value: string | number;
  hint: string;
}

export interface QualityOverviewRow {
  object: string;
  keyData: string;
  progress: string;
  status: string;
  tone: 'red' | 'yellow' | 'green' | 'blue';
}

export function downloadQualityCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatQualityDate(value?: string | null) {
  if (!value) return '长期';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value));
}
