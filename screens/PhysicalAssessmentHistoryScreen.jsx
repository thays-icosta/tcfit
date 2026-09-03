import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, Switch } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';

const SEGMENT_META = {
  braco_direito: { label: 'Braço Direito', area: 'armr' },
  braco_esquerdo: { label: 'Braço Esquerdo', area: 'arml' },
  tronco: { label: 'Tronco', area: 'trunk' },
  perna_direita: { label: 'Perna Direita', area: 'legr' },
  perna_esquerda: { label: 'Perna Esquerda', area: 'legl' },
};

const CLASS_META = {
  abaixo: { label: 'Abaixo', color: '#3b82f6' },
  padrao: { label: 'Padrão', color: '#22c55e' },
  acima: { label: 'Acima', color: '#f97316' },
};

function withTimeout(promise, ms, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
  ]);
}

function Delta({ current, previous, unit, invertColor }) {
  if (previous == null || current == null) return null;
  const diff = current - previous;
  if (diff === 0) return <Text style={styles.deltaNeutral}>= sem mudança</Text>;
  const isPositive = diff > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  return (
    <Text style={[styles.delta, isGood ? styles.deltaGood : styles.deltaBad]}>
      {isPositive ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}{unit}
    </Text>
  );
}

function SimpleBarChart({ data, valueKey, label, color, unit }) {
  const validPoints = data.filter((d) => d[valueKey] != null).slice(0, 8).reverse();
  if (validPoints.length < 2) return null;

  const values = validPoints.map((d) => d[valueKey]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{label}</Text>
      <View style={styles.chartBarsRow}>
        {validPoints.map((point, i) => {
          const heightPct = 20 + ((point[valueKey] - min) / range) * 70;
          return (
            <View key={i} style={styles.chartBarColumn}>
              <Text style={styles.chartBarValue}>{point[valueKey]}{unit}</Text>
              <View style={styles.chartBarTrack}>
                <View style={[styles.chartBarFill, { height: `${heightPct}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.chartBarDate}>
                {new Date(point.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function extractPerimeterPoint(a) {
  const p = a.perimeters;
  if (!p) return null;
  const bracos = (p.braco_direito != null && p.braco_esquerdo != null)
    ? (p.braco_direito + p.braco_esquerdo) / 2
    : (p.braco_direito ?? p.braco_esquerdo ?? null);
  const coxas = (p.coxa_direita != null && p.coxa_esquerda != null)
    ? (p.coxa_direita + p.coxa_esquerda) / 2
    : (p.coxa_direita ?? p.coxa_esquerda ?? null);
  return {
    date: a.created_at,
    cintura: p.cintura ?? null,
    quadril: p.quadril ?? null,
    peitoral: p.torax ?? null,
    bracos,
    coxas,
  };
}

function buildPerimeterChartHtml(rawPoints) {
  const points = rawPoints.filter((p) => p.cintura != null && p.quadril != null && p.peitoral != null && p.bracos != null && p.coxas != null);
  if (points.length < 2) return null;

  const metrics = [
    { key: 'cintura', label: 'Cintura', color: '#3b82f6' },
    { key: 'quadril', label: 'Quadril', color: '#a855f7' },
    { key: 'peitoral', label: 'Peitoral', color: '#f97316' },
    { key: 'bracos', label: 'Braços', color: '#22c55e' },
    { key: 'coxas', label: 'Coxas', color: '#ef4444' },
  ];

  const width = 680, height = 280, padL = 20, padR = 20, padT = 20, padB = 30;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const n = points.length;
  const xFor = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  let svgLines = '';
  let legendRows = '';

  metrics.forEach((m) => {
    const values = points.map((p) => p[m.key]);
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max - min) || 1;
    const yFor = (v) => padT + plotH - ((v - min) / range) * plotH;

    const pathD = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
    const dots = values.map((v, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="3" fill="${m.color}" /><text x="${xFor(i).toFixed(1)}" y="${(yFor(v) - 7).toFixed(1)}" font-size="9" fill="${m.color}" text-anchor="middle">${v}</text>`).join('');

    svgLines += `<path d="${pathD}" fill="none" stroke="${m.color}" stroke-width="2" />${dots}`;

    const diff = values[values.length - 1] - values[0];
    const diffColor = diff < 0 ? '#22c55e' : diff > 0 ? '#ef4444' : '#737373';
    legendRows += `
      <div class="legend-row">
        <span class="legend-dot" style="background:${m.color}"></span>
        <span class="legend-label">${m.label}</span>
        <span class="legend-value">${values[values.length - 1]}cm</span>
        <span class="legend-delta" style="color:${diffColor}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}cm</span>
      </div>`;
  });

  const dateLabels = points.map((p, i) => `<text x="${xFor(i).toFixed(1)}" y="${height - 8}" font-size="8" fill="#888" text-anchor="middle">${new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</text>`).join('');

  return `
    <svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${svgLines}
      ${dateLabels}
    </svg>
    <div class="legend-box">${legendRows}</div>
  `;
}

function buildSkinfoldChartHtml(current, previous, brandColor) {
  if (!current || !current.skinfold_values || !current.skinfold_values.labels) return null;
  const curLabels = current.skinfold_values.labels || [];
  const curValues = current.skinfold_values.values || [];
  const prevMap = {};
  if (previous && previous.skinfold_values && previous.skinfold_values.labels) {
    previous.skinfold_values.labels.forEach((l, i) => { prevMap[l] = previous.skinfold_values.values[i]; });
  }

  const width = 680, height = 260, padL = 20, padR = 20, padT = 20, padB = 55;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const n = curLabels.length;
  if (n === 0) return null;
  const groupW = plotW / n;
  const barW = Math.min(22, groupW / 3);

  const allValues = [...curValues, ...Object.values(prevMap)].filter((v) => v != null);
  const max = Math.max(...allValues, 1);

  let bars = '';
  curLabels.forEach((label, i) => {
    const groupX = padL + i * groupW + groupW / 2;
    const curV = curValues[i];
    const prevV = prevMap[label];

    if (prevV != null) {
      const prevH = (prevV / max) * plotH;
      bars += `<rect x="${(groupX - barW - 2).toFixed(1)}" y="${(padT + plotH - prevH).toFixed(1)}" width="${barW}" height="${prevH.toFixed(1)}" fill="#a3a3a3" rx="2" />`;
      bars += `<text x="${(groupX - barW / 2 - 2).toFixed(1)}" y="${(padT + plotH - prevH - 4).toFixed(1)}" font-size="8" fill="#737373" text-anchor="middle">${prevV}</text>`;
    }
    if (curV != null) {
      const curH = (curV / max) * plotH;
      bars += `<rect x="${(groupX + 2).toFixed(1)}" y="${(padT + plotH - curH).toFixed(1)}" width="${barW}" height="${curH.toFixed(1)}" fill="${brandColor}" rx="2" />`;
      bars += `<text x="${(groupX + barW / 2 + 2).toFixed(1)}" y="${(padT + plotH - curH - 4).toFixed(1)}" font-size="8" fill="${brandColor}" text-anchor="middle" font-weight="700">${curV}</text>`;
    }

    const shortLabel = label.replace(' (mm)', '');
    bars += `<text x="${groupX.toFixed(1)}" y="${height - 20}" font-size="8" fill="#888" text-anchor="middle" transform="rotate(-30 ${groupX.toFixed(1)} ${height - 20})">${shortLabel}</text>`;
  });

  return `
    <svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>
    <div class="legend-box">
      <div class="legend-row"><span class="legend-dot" style="background:#a3a3a3"></span><span class="legend-label">Avaliação Anterior</span></div>
      <div class="legend-row"><span class="legend-dot" style="background:${brandColor}"></span><span class="legend-label">Avaliação Atual</span></div>
    </div>
  `;
}

function buildSegmentalMapHtml(segmental) {
  if (!segmental) return null;
  const keys = Object.keys(segmental).filter((k) => SEGMENT_META[k] && segmental[k]);
  if (keys.length === 0) return null;

  const cell = (key) => {
    const meta = SEGMENT_META[key];
    const seg = segmental[key];
    if (!seg) return `<div class="seg-cell seg-${meta.area} seg-empty"></div>`;
    const classMeta = CLASS_META[seg.classification] || null;
    return `
      <div class="seg-cell seg-${meta.area}" style="${classMeta ? `border-color:${classMeta.color};` : ''}">
        <div class="seg-name">${meta.label}</div>
        ${seg.muscle_kg != null ? `<div class="seg-value">${seg.muscle_kg}kg <span class="seg-value-label">massa musc.</span></div>` : ''}
        ${seg.fat_pct != null ? `<div class="seg-value">${seg.fat_pct}% <span class="seg-value-label">gordura</span></div>` : ''}
        ${classMeta ? `<div class="seg-badge" style="background:${classMeta.color}">${classMeta.label}</div>` : ''}
      </div>
    `;
  };

  return `
    <div class="seg-map">
      ${cell('braco_esquerdo')}
      ${cell('tronco')}
      ${cell('braco_direito')}
      ${cell('perna_esquerda')}
      <div class="seg-cell seg-spacer"></div>
      ${cell('perna_direita')}
    </div>
  `;
}

function buildReportHtml(studentName, assessments, branding) {
  const latest = assessments[0];
  const previous = assessments[1];
  const brandColor = branding?.brandColor || '#f97316';

  const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const row = (label, value, unit) => value != null
    ? `<tr><td class="label">${label}</td><td class="value">${value}${unit || ''}</td></tr>`
    : '';

  const deltaRow = (label, current, previous, unit, invert) => {
    if (current == null || previous == null) return '';
    const diff = current - previous;
    const isPositive = diff > 0;
    const isGood = invert ? !isPositive : isPositive;
    const color = diff === 0 ? '#737373' : (isGood ? '#22c55e' : '#ef4444');
    const arrow = diff === 0 ? '=' : (isPositive ? '▲' : '▼');
    return `<tr><td class="label">${label}</td><td class="value" style="color:${color}">${arrow} ${Math.abs(diff).toFixed(1)}${unit}</td></tr>`;
  };

  const headerBlock = branding?.useLogo && branding?.logoUrl
    ? `<div class="header-with-logo"><img src="${branding.logoUrl}" class="logo" /><div><h1 style="color:${brandColor}">Relatório de Avaliação Física</h1><div class="subtitle">${studentName} · Gerado em ${formatDate(new Date().toISOString())}</div></div></div>`
    : `<h1 style="color:${brandColor}">Relatório de Avaliação Física</h1><div class="subtitle">${studentName} · Gerado em ${formatDate(new Date().toISOString())}</div>`;

  const footerParts = [];
  if (branding?.professionalRegister) footerParts.push(branding.professionalRegister);
  if (branding?.phone) footerParts.push(`WhatsApp: ${branding.phone}`);
  if (branding?.contactInstagram) footerParts.push(branding.contactInstagram);
  if (branding?.contactEmail) footerParts.push(branding.contactEmail);
  const footerText = footerParts.length > 0
    ? footerParts.join(' · ')
    : 'Gerado pelo NutriTreino · Este relatório é uma referência de acompanhamento e não substitui avaliação médica.';

  const chronological = [...assessments].reverse();
  const perimeterPoints = chronological
    .map(extractPerimeterPoint)
    .filter((p) => p && (p.cintura != null || p.quadril != null || p.peitoral != null || p.bracos != null || p.coxas != null));
  const perimeterChartHtml = buildPerimeterChartHtml(perimeterPoints);

  const dobrasAssessments = assessments.filter((a) => a.mode === 'dobras' && a.skinfold_values);
  const currentDobras = dobrasAssessments[0];
  const previousDobras = dobrasAssessments[1];
  const skinfoldChartHtml = currentDobras ? buildSkinfoldChartHtml(currentDobras, previousDobras, brandColor) : null;
  const sumFolds = currentDobras?.skinfold_values?.values ? currentDobras.skinfold_values.values.reduce((a, b) => a + b, 0) : null;

  const bioRows = [
    { label: 'Massa Magra', value: latest.skeletal_muscle_kg, unit: 'kg' },
    { label: 'Massa Gorda', value: latest.fat_mass_kg, unit: 'kg' },
    { label: '% Gordura', value: latest.body_fat_pct, unit: '%' },
    { label: 'Água Corporal', value: latest.body_water_pct, unit: '%' },
    { label: 'Água Corporal', value: latest.body_water_kg, unit: 'kg' },
    { label: 'Proteína', value: latest.protein_kg, unit: 'kg' },
    { label: 'Sal Inorgânico', value: latest.inorganic_salt_kg, unit: 'kg' },
    { label: 'Gordura Subcutânea', value: latest.subcutaneous_fat_pct, unit: '%' },
    { label: 'Gordura Visceral', value: latest.visceral_fat, unit: '' },
    { label: 'Taxa Metabólica Basal', value: latest.bmr_kcal, unit: ' kcal' },
  ].filter((r) => r.value != null);

  const bioimpedanciaBlock = latest.mode === 'bioimpedancia' && bioRows.length > 0 ? `
    <h2>Dados de Bioimpedância</h2>
    <div class="bio-box">
      ${bioRows.map((r) => `
        <div class="bio-item">
          <div class="bio-value">${r.value}${r.unit}</div>
          <div class="bio-label">${r.label}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const segmentalMapHtml = buildSegmentalMapHtml(latest.segmental_analysis);

  const isPdfAttachment = latest.report_url && latest.report_url.toLowerCase().split('?')[0].endsWith('.pdf');
  const isImageAttachment = latest.report_url && !isPdfAttachment;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .header-with-logo { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
          .logo { width: 60px; height: 60px; object-fit: contain; }
          .subtitle { color: #737373; font-size: 12px; margin-bottom: 24px; }
          h2 { font-size: 15px; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid ${brandColor}; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
          .label { color: #555; }
          .value { text-align: right; font-weight: 700; }
          .footer { margin-top: 32px; color: #a3a3a3; font-size: 10px; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
          .page-break { page-break-before: always; }
          .chart-page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid ${brandColor}; }
          .chart-page-header .logo-mini { width: 40px; height: 40px; object-fit: contain; }
          .chart-page-header .chart-page-title { font-size: 18px; font-weight: 800; color: ${brandColor}; }
          .badges-row { display: flex; gap: 16px; margin-bottom: 8px; }
          .badge-box { flex: 1; text-align: center; border: 1px solid #eee; border-radius: 10px; padding: 14px; }
          .badge-value { font-size: 24px; font-weight: 800; color: ${brandColor}; }
          .badge-label { font-size: 10px; color: #737373; margin-top: 2px; text-transform: uppercase; }
          .legend-box { margin-top: 6px; }
          .legend-row { display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 4px; }
          .legend-dot { width: 8px; height: 8px; border-radius: 4px; display: inline-block; flex-shrink: 0; }
          .legend-label { flex: 1; color: #333; }
          .legend-value { font-weight: 700; width: 50px; text-align: right; }
          .legend-delta { width: 60px; text-align: right; font-weight: 700; }
          .muted { color: #a3a3a3; font-size: 12px; font-style: italic; }
          .bio-box { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; background: #f9f9f9; border-radius: 10px; padding: 14px; border: 1px solid #eee; }
          .bio-item { width: 30%; text-align: center; padding: 6px 0; }
          .bio-value { font-size: 16px; font-weight: 800; color: ${brandColor}; }
          .bio-label { font-size: 9px; color: #737373; margin-top: 2px; text-transform: uppercase; }
          .parecer-box { background: #f9f9f9; border: 1px solid #eee; border-left: 4px solid ${brandColor}; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
          .parecer-title { font-size: 11px; font-weight: 800; color: ${brandColor}; text-transform: uppercase; margin-bottom: 8px; }
          .parecer-text { font-size: 12px; color: #333; white-space: pre-wrap; line-height: 18px; }
          .report-image-full { width: 100%; border-radius: 10px; border: 1px solid #eee; }
          .pdf-note-box { background: #f9f9f9; border: 1px dashed #ccc; border-radius: 10px; padding: 16px; text-align: center; font-size: 12px; color: #555; }
          .seg-map { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-areas: "arml trunk armr" "legl spacer legr"; gap: 10px; margin-bottom: 16px; }
          .seg-cell { border: 2px solid #eee; border-radius: 10px; padding: 10px; text-align: center; }
          .seg-arml { grid-area: arml; } .seg-armr { grid-area: armr; } .seg-trunk { grid-area: trunk; }
          .seg-legl { grid-area: legl; } .seg-legr { grid-area: legr; } .seg-spacer { grid-area: spacer; border: none; }
          .seg-name { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 6px; }
          .seg-value { font-size: 11px; color: #333; }
          .seg-value-label { color: #999; font-size: 9px; }
          .seg-badge { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 6px; color: #fff; font-size: 9px; font-weight: 800; }
        </style>
      </head>
      <body>
        ${headerBlock}

        <h2>Avaliação atual (${formatDate(latest.created_at)})</h2>
        <table>
          ${row('Modo', latest.mode === 'bioimpedancia' ? 'Bioimpedância' : `Dobras Cutâneas (${latest.protocol || ''})`)}
          ${row('Peso', latest.weight_kg, 'kg')}
        </table>

        ${bioimpedanciaBlock}

        ${segmentalMapHtml ? `<h2>Análise Segmentada / Equilíbrio Muscular</h2>${segmentalMapHtml}` : ''}

        ${previous ? `
          <h2>Comparação com avaliação anterior (${formatDate(previous.created_at)})</h2>
          <table>
            ${deltaRow('Peso', latest.weight_kg, previous.weight_kg, 'kg', false)}
            ${deltaRow('% Gordura', latest.body_fat_pct, previous.body_fat_pct, '%', true)}
            ${deltaRow('Massa Magra', latest.skeletal_muscle_kg, previous.skeletal_muscle_kg, 'kg', false)}
          </table>
        ` : ''}

        ${latest.notes ? `
          <div class="parecer-box">
            <div class="parecer-title">Parecer Técnico & Recomendações</div>
            <div class="parecer-text">${latest.notes}</div>
          </div>
        ` : ''}

        <div class="page-break"></div>
        <div class="chart-page-header">
          ${branding?.useLogo && branding?.logoUrl ? `<img src="${branding.logoUrl}" class="logo-mini" />` : ''}
          <span class="chart-page-title">Composição Corporal Detalhada</span>
        </div>

        ${currentDobras ? `
          <div class="badges-row">
            <div class="badge-box"><div class="badge-value">${sumFolds != null ? sumFolds.toFixed(1) : '—'}mm</div><div class="badge-label">Σ Dobras</div></div>
            <div class="badge-box"><div class="badge-value">${currentDobras.body_fat_pct != null ? currentDobras.body_fat_pct : '—'}%</div><div class="badge-label">BF% Estimado</div></div>
          </div>
        ` : ''}

        <h2>Evolução de Perímetros (cm)</h2>
        ${perimeterChartHtml || '<p class="muted">Dados insuficientes de perímetros pra montar o gráfico (precisa de pelo menos 2 avaliações no modo Dobras Cutâneas com cintura, quadril, peitoral, braços e coxas preenchidos).</p>'}

        <h2>Comparativo de Dobras Cutâneas (mm)</h2>
        ${skinfoldChartHtml || '<p class="muted">Sem dados de dobras cutâneas suficientes pra comparar (precisa de pelo menos uma avaliação no modo Dobras Cutâneas).</p>'}

        ${latest.report_url ? `
          <div class="page-break"></div>
          <div class="chart-page-header">
            ${branding?.useLogo && branding?.logoUrl ? `<img src="${branding.logoUrl}" class="logo-mini" />` : ''}
            <span class="chart-page-title">Laudo Anexado</span>
          </div>
          ${isImageAttachment ? `<img src="${latest.report_url}" class="report-image-full" />` : ''}
          ${isPdfAttachment ? `<div class="pdf-note-box">📎 Um laudo em PDF foi anexado a essa avaliação. Como é um arquivo PDF separado, ele não pode ser incorporado dentro deste relatório — acesse-o diretamente pelo app, na tela de detalhe dessa avaliação.</div>` : ''}
        ` : ''}

        <div class="footer">${footerText}</div>
      </body>
    </html>
  `;
}

export default function PhysicalAssessmentHistoryScreen({ studentId, studentName, personalId, onClose }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportWithBranding, setExportWithBranding] = useState(true);
  const [exportWithAttachment, setExportWithAttachment] = useState(true);
  const [branding, setBranding] = useState(null);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const loadBranding = async () => {
    let pid = personalId;
    if (!pid) {
      const { data: selfRow } = await supabase.from('users').select('personal_id').eq('id', studentId).single();
      pid = selfRow?.personal_id;
    }
    if (!pid) { setBranding(null); return; }
    const { data } = await supabase
      .from('users')
      .select('logo_url, brand_color, professional_register, phone, contact_instagram, contact_email')
      .eq('id', pid)
      .single();
    if (data) {
      setBranding({
        logoUrl: data.logo_url,
        brandColor: data.brand_color,
        professionalRegister: data.professional_register,
        phone: data.phone,
        contactInstagram: data.contact_instagram,
        contactEmail: data.contact_email,
      });
      setExportWithBranding(!!data.logo_url);
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('physical_assessments')
        .select('id, assessment_date, mode, weight_kg, body_fat_pct, skeletal_muscle_kg, fat_mass_kg, body_water_pct, body_water_kg, protein_kg, inorganic_salt_kg, subcutaneous_fat_pct, visceral_fat, bmr_kcal, protocol, perimeters, skinfold_values, segmental_analysis, report_url, notes, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      setAssessments(data || []);
      await loadBranding();
      setLoading(false);
    })();
  }, [studentId]);

  const handleGeneratePdf = async () => {
    setShowExportModal(false);
    if (assessments.length === 0) return;
    setGeneratingPdf(true);
    try {
      const brandingToUse = exportWithBranding ? { ...branding, useLogo: true } : null;
      const assessmentsForPdf = exportWithAttachment
        ? assessments
        : assessments.map((a, i) => (i === 0 ? { ...a, report_url: null } : a));

      const html = buildReportHtml(studentName, assessmentsForPdf, brandingToUse);
      const { uri } = await withTimeout(
        Print.printToFileAsync({ html }),
        25000,
        'O PDF demorou demais pra gerar. Se você anexou uma foto de laudo, tente sem anexo — ou tente novamente com internet mais estável.'
      );
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório' });
      } else {
        showAlert('PDF gerado', 'O compartilhamento não está disponível nesse dispositivo, mas o PDF foi criado.');
      }
    } catch (e) {
      showAlert('Erro ao gerar PDF', e.message);
    }
    setGeneratingPdf(false);
  };

  const latest = assessments[0];
  const previous = assessments[1];

  return (
    <View style={styles.container}>
      <HeaderBack title={studentName} onBack={onClose} />

      <Text style={styles.title}>Evolução Física</Text>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
      ) : assessments.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma avaliação registrada ainda.</Text>
      ) : (
        <>
          <TouchableOpacity style={styles.pdfButton} onPress={() => setShowExportModal(true)} disabled={generatingPdf}>
            {generatingPdf ? (
              <ActivityIndicator color="#0a0a0a" size="small" />
            ) : (
              <Text style={styles.pdfButtonText}>📄 Gerar PDF e Compartilhar</Text>
            )}
          </TouchableOpacity>

          <ScrollView style={{ flex: 1 }}>
            {latest && previous && (
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonTitle}>Última avaliação vs anterior</Text>
                <Text style={styles.comparisonDates}>
                  {formatDate(previous.created_at)} → {formatDate(latest.created_at)}
                </Text>

                <View style={styles.comparisonRow}>
                  <Text style={styles.comparisonLabel}>Peso</Text>
                  <Text style={styles.comparisonValue}>{latest.weight_kg}kg</Text>
                  <Delta current={latest.weight_kg} previous={previous.weight_kg} unit="kg" />
                </View>

                {latest.body_fat_pct != null && (
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>% Gordura</Text>
                    <Text style={styles.comparisonValue}>{latest.body_fat_pct}%</Text>
                    <Delta current={latest.body_fat_pct} previous={previous.body_fat_pct} unit="%" invertColor />
                  </View>
                )}

                {latest.skeletal_muscle_kg != null && (
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>Massa Magra</Text>
                    <Text style={styles.comparisonValue}>{latest.skeletal_muscle_kg}kg</Text>
                    <Delta current={latest.skeletal_muscle_kg} previous={previous.skeletal_muscle_kg} unit="kg" />
                  </View>
                )}
              </View>
            )}

            {latest?.report_url && (
              <TouchableOpacity
                style={styles.attachmentLink}
                onPress={() => showAlert('Laudo anexado', 'Abra o link a seguir no navegador do celular: ' + latest.report_url)}
              >
                <Text style={styles.attachmentLinkText}>📎 Ver laudo anexado da última avaliação</Text>
              </TouchableOpacity>
            )}

            <SimpleBarChart data={assessments} valueKey="weight_kg" label="Evolução de Peso" color="#f97316" unit="kg" />
            <SimpleBarChart data={assessments} valueKey="body_fat_pct" label="Evolução de % Gordura" color="#ef4444" unit="%" />
            <SimpleBarChart data={assessments} valueKey="skeletal_muscle_kg" label="Evolução de Massa Magra" color="#22c55e" unit="kg" />

            <Text style={styles.sectionTitle}>Histórico completo ({assessments.length})</Text>
            {assessments.map((a) => (
              <View key={a.id} style={styles.assessmentCard}>
                <View style={styles.assessmentHeaderRow}>
                  <Text style={styles.assessmentDate}>{formatDate(a.created_at)}</Text>
                  <Text style={styles.assessmentMode}>{a.mode === 'bioimpedancia' ? 'Bioimpedância' : `Dobras (${a.protocol})`}</Text>
                </View>
                <View style={styles.assessmentStatsRow}>
                  <Text style={styles.assessmentStat}>{a.weight_kg}kg</Text>
                  {a.body_fat_pct != null && <Text style={styles.assessmentStat}>{a.body_fat_pct}% gordura</Text>}
                  {a.skeletal_muscle_kg != null && <Text style={styles.assessmentStat}>{a.skeletal_muscle_kg}kg magra</Text>}
                  {a.bmr_kcal != null && <Text style={styles.assessmentStat}>{a.bmr_kcal}kcal TMB</Text>}
                </View>
                {a.notes ? <Text style={styles.assessmentNotes} numberOfLines={2}>📝 {a.notes}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Exportar PDF</Text>
            <View style={styles.brandingToggleRow}>
              <Text style={styles.brandingToggleLabel}>Gerar com minha marca personalizada</Text>
              <Switch
                value={exportWithBranding}
                onValueChange={setExportWithBranding}
                trackColor={{ false: '#292524', true: '#22c55e' }}
                thumbColor="#f5f5f5"
                disabled={!branding?.logoUrl}
              />
            </View>
            {!branding?.logoUrl && (
              <Text style={styles.brandingToggleHint}>Cadastre sua logo no Perfil pra habilitar essa opção.</Text>
            )}

            {latest?.report_url && (
              <View style={[styles.brandingToggleRow, { marginTop: 16 }]}>
                <Text style={styles.brandingToggleLabel}>Incluir imagem do laudo anexado</Text>
                <Switch
                  value={exportWithAttachment}
                  onValueChange={setExportWithAttachment}
                  trackColor={{ false: '#292524', true: '#22c55e' }}
                  thumbColor="#f5f5f5"
                />
              </View>
            )}
            <Text style={styles.brandingToggleHint}>Se o PDF estiver demorando demais pra gerar, desmarque essa opção e tente de novo.</Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowExportModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleGeneratePdf}>
                <Text style={styles.modalConfirmButtonText}>Gerar PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  title: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  pdfButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  pdfButtonText: { color: '#f97316', fontSize: 14, fontWeight: '700' },
  attachmentLink: { alignItems: 'center', marginBottom: 16 },
  attachmentLinkText: { color: '#3b82f6', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  comparisonCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, padding: 14, marginBottom: 16 },
  comparisonTitle: { color: '#f97316', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  comparisonDates: { color: '#525252', fontSize: 10, marginBottom: 10, marginTop: 2 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  comparisonLabel: { color: '#a3a3a3', fontSize: 12, flex: 1 },
  comparisonValue: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', marginRight: 10 },
  delta: { fontSize: 12, fontWeight: '700', width: 70, textAlign: 'right' },
  deltaGood: { color: '#22c55e' },
  deltaBad: { color: '#ef4444' },
  deltaNeutral: { color: '#525252', fontSize: 11, width: 90, textAlign: 'right' },
  chartCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 12 },
  chartTitle: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  chartBarsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 },
  chartBarColumn: { alignItems: 'center', flex: 1 },
  chartBarValue: { color: '#a3a3a3', fontSize: 9, marginBottom: 4 },
  chartBarTrack: { width: 18, height: 90, backgroundColor: '#0a0a0a', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBarFill: { width: '100%', borderRadius: 4 },
  chartBarDate: { color: '#525252', fontSize: 8, marginTop: 4 },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 6 },
  assessmentCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 8 },
  assessmentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  assessmentDate: { color: '#f5f5f5', fontSize: 12, fontWeight: '700' },
  assessmentMode: { color: '#f97316', fontSize: 10 },
  assessmentStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assessmentStat: { color: '#a3a3a3', fontSize: 11 },
  assessmentNotes: { color: '#525252', fontSize: 10, marginTop: 6, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#171717', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  brandingToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandingToggleLabel: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  brandingToggleHint: { color: '#525252', fontSize: 10, marginTop: 8, lineHeight: 14 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});