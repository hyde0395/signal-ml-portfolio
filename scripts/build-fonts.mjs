// npm run fonts: 사이트에 실제로 나오는 글자만 남긴 글꼴 셋을 만든다(src/styles/font-files/, 커밋한다). 계획 2026-10-08 성능.
// 왜: Pretendard 동적 서브셋(92조각)은 페이지 전체 글자 때문에 첫 배치에서 25~40조각(650~850KB)을 받아 LCP를 늘렸다.
// 문구가 바뀌어 새 글자가 생기면 tests/unit/font-subset.test.ts가 실패한다 → 이 스크립트를 다시 돌리고 결과를 커밋한다.
// 원본: Pretendard(node_modules/pretendard), Noto Sans JP(google/fonts 고정 커밋, scripts/.cache/fonts에 받아 둔다). 둘 다 OFL.
import subsetFont from 'subset-font';
import { Blob, Face } from 'harfbuzzjs';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FONT_FILES, requestedChars } from './font-chars.mjs';

const OUT = 'src/styles/font-files';
const CACHE = 'scripts/.cache/fonts';
const NOTO_COMMIT = '66a36c8c94b1a5d992ee4e7f392fccfe4945767c'; // google/fonts ofl/notosansjp 최신(2026-03-25)
const NOTO_URL = `https://raw.githubusercontent.com/google/fonts/${NOTO_COMMIT}/ofl/notosansjp`;
const PRETENDARD = 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';

async function cached(name, url) {
  const p = `${CACHE}/${name}`;
  if (!existsSync(p)) {
    mkdirSync(CACHE, { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(p);
}

// 굵기 축은 CSS에서 쓰는 범위만 남긴다: Pretendard 400~700, Noto Sans JP 400~600(지금 Google 글꼴과 같은 두 굵기)
const SOURCES = {
  'pretendard-ko.woff2': { load: async () => readFileSync(PRETENDARD), wght: [400, 700] },
  'pretendard-latin.woff2': { load: async () => readFileSync(PRETENDARD), wght: [400, 700] },
  'noto-sans-jp.woff2': { load: () => cached('NotoSansJP[wght].ttf', `${NOTO_URL}/NotoSansJP%5Bwght%5D.ttf`), wght: [400, 600] },
};

mkdirSync(OUT, { recursive: true });
const manifest = {};
for (const file of FONT_FILES) {
  const { load, wght } = SOURCES[file];
  const src = await load();
  const text = [...requestedChars(file)].sort().join('');
  const opts = { variationAxes: { wght: { min: wght[0], max: wght[1] } } };
  // 원본에 없는 글자를 알리려고 sfnt로 한 번 더 잘라 실제로 담긴 글자를 센다(harfbuzz)
  const sfnt = await subsetFont(src, text, { ...opts, targetFormat: 'sfnt' });
  const covered = new Set([...new Face(new Blob(sfnt), 0).collectUnicodes()].map((u) => String.fromCodePoint(u)));
  const woff2 = await subsetFont(src, text, { ...opts, targetFormat: 'woff2' });
  writeFileSync(`${OUT}/${file}`, woff2);
  const missing = [...text].filter((c) => !covered.has(c)).join('');
  manifest[file] = { requested: text, missing };
  console.log(`${file}: 글자 ${[...text].length}개 → ${(woff2.length / 1024).toFixed(1)}KB${missing ? ` (원본에 없음: ${missing})` : ''}`);
}
writeFileSync(`${OUT}/subset.json`, `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync('node_modules/pretendard/dist/LICENSE.txt', `${OUT}/OFL-Pretendard.txt`);
writeFileSync(`${OUT}/OFL-NotoSansJP.txt`, await cached('OFL-NotoSansJP.txt', `${NOTO_URL}/OFL.txt`));
