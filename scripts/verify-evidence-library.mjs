// Re-checks every source in the AI copilot's evidence library against PubMed
// (NCBI E-utilities): title, first authors, journal, year, volume/pages and DOI
// must all match the record, so a typo or an invented reference can't sit in
// the list unnoticed. Run it whenever the library changes:
//
//   node scripts/verify-evidence-library.mjs
//
// Exits with code 1 if anything doesn't match.

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const logicPath = path.resolve(process.cwd(), 'supabase/functions/ai-copilot/logic.ts');
const { EVIDENCE_LIBRARY } = await import(pathToFileURL(logicPath).href);

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "1334-1359" (ours) vs "1334-59" (PubMed's abbreviated end page)
function pagesMatch(ours, theirs) {
  const [a1, a2] = String(ours).split('-');
  const [b1, b2] = String(theirs).split('-');
  if (a1 !== b1) return false;
  if (!a2 || !b2) return a2 === b2;
  return a2.endsWith(b2);
}

let failures = 0;
const fail = (id, msg) => { failures += 1; console.log(`  FAIL ${id}: ${msg}`); };

const ids = EVIDENCE_LIBRARY.map((s) => s.pmid).join(',');
const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids}`);
const data = await res.json();

console.log(`Checking ${EVIDENCE_LIBRARY.length} sources against PubMed...\n`);
for (const s of EVIDENCE_LIBRARY) {
  const r = data.result?.[s.pmid];
  console.log(`${s.id} (PMID ${s.pmid})`);
  if (!r || r.error) { fail(s.id, 'PMID not found on PubMed'); continue; }
  const cite = norm(s.citacao);
  let ok = true;
  const check = (cond, msg) => { if (!cond) { ok = false; fail(s.id, msg); } };

  check(cite.includes(norm(r.title)), `title differs. PubMed: "${r.title}"`);

  const authors = (r.authors || []).map((a) => a.name);
  const prefix = s.citacao.split('. ')[0];
  // Names the citation lists (before an optional "et al"): they must be the
  // record's first authors, in order; if the record has more, "et al." is required.
  const listed = prefix.replace(/,?\s*et al\.?$/i, '').split(/,\s*/).filter(Boolean);
  listed.forEach((name, i) => check(authors[i] === name, `author #${i + 1} is "${name}" but PubMed has "${authors[i]}"`));
  if (authors.length > listed.length) check(/et al/i.test(prefix), 'citation lists only some authors and should end with "et al."');

  check(s.citacao.includes(r.source), `journal differs. PubMed: "${r.source}"`);
  const year = (r.pubdate || '').slice(0, 4);
  check(s.citacao.includes(`${year};`) || s.citacao.includes(`${year}.`), `year differs. PubMed: ${year}`);

  const m = s.citacao.match(/;\s*(\d+)\((\d+)\):\s*([\d-]+)\.?$/);
  if (m) {
    check(m[1] === String(r.volume) && m[2] === String(r.issue), `volume/issue differ. PubMed: ${r.volume}(${r.issue})`);
    check(pagesMatch(m[3], r.pages), `pages differ. PubMed: ${r.pages}`);
  }

  const doi = (r.articleids || []).find((a) => a.idtype === 'doi')?.value || '';
  check(doi.toLowerCase() === s.doi.toLowerCase(), `DOI differs. PubMed: ${doi}`);

  if (ok) console.log(`  ok  — ${authors[0]} et al., ${r.source} ${r.pubdate}`);
  await sleep(50);
}

console.log(failures === 0 ? '\nAll sources match PubMed.' : `\n${failures} problem(s) found.`);
process.exit(failures === 0 ? 0 : 1);
