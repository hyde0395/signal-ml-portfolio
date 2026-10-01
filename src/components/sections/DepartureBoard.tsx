// ② 공항 출발 안내판(설계 2026-09-25 §3.2). 서버가 완성된 글자로 그려 두어 JS가 없거나 움직임 줄이기여도 그대로
// 읽힌다. 화면에 들어오면 src/motion/board.ts가 칸마다 글자를 넘긴다(run.ts가 연결).
// 칸 하나 = 위·아래 반쪽(정지) + 접히는 위 날개 + 펴지는 아래 날개. 화면 낭독기는 칸 대신 sr-only 완성값을 읽는다.
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

const DEST: Record<string, string> = { NRT: 'NARITA', KIX: 'KANSAI', HND: 'HANEDA' };
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

function Flaps({ text }: { text: string }) {
  return (
    <span className="flaps" aria-hidden="true">
      {[...text].map((c, i) => (
        <span key={i} className="flap" data-c={c}>
          <span className="flap-half flap-top"><span>{c}</span></span>
          <span className="flap-half flap-bot"><span>{c}</span></span>
          <span className="flap-half flap-top flap-fold"><span>{c}</span></span>
          <span className="flap-half flap-bot flap-unfold"><span>{c}</span></span>
        </span>
      ))}
    </span>
  );
}

function Cell({ text, read }: { text: string; read?: string }) {
  return <><span className="sr-only">{read ?? text}</span><Flaps text={text} /></>;
}

export function DepartureBoard({ locale }: { locale: Locale }) {
  const t = getT(locale);
  // 보드는 걸러내기 판보다 먼저 나오므로(2026-10-01 순서 변경) 걸러내기 전 "모은" 행을 보여 준다.
  // TOTAL(rawRows)에서 바로 아래 걸러내기 판이 시작해 filteredRows로 줄인다
  const { rawByRoute, rawRows, collectStart, collectEnd, collectDays } = facts.data;
  // 행 수 칸 너비를 맞춘다(오른쪽 정렬, 앞을 빈칸으로). 실제 보드처럼 칸 개수가 줄마다 같아야 한다
  const width = Math.max(fmt(rawRows).length, ...rawByRoute.map((r) => fmt(r.rows).length));
  const pad = (n: number) => fmt(n).padStart(width, ' ');
  return (
    <div className="board-housing">
      {/* overflow-x:auto인 스크롤 영역은 키보드로 닿아야 axe scrollable-region-focusable을 통과한다.
          CSS로 화면 너비마다 스크롤이 안 생기게 맞췄지만, 혹시 남는 경우를 대비한 안전망이다.
          라벨은 table caption(data.board.caption, "노선"/"route"/"路線" 포함)을 그대로 쓰면 데모 섹션의
          getByLabel('노선') 같은 부분일치 찾기와 충돌한다(e2e 실측). 이미 화면에 보이는 제목 줄(DEPARTURES +
          수집 현황)을 aria-labelledby로 가리켜 새 문구 없이 충돌 없는 이름을 만든다 */}
      <div className="board" data-board tabIndex={0} role="region" aria-labelledby="board-caption">
        <div className="board-head">
          <p id="board-caption"><span className="board-title mono">DEPARTURES</span> <span className="board-sub">{t('data.board.sub')}</span></p>
          <p className="board-range mono">{collectStart} → {collectEnd} · {collectDays} DAYS</p>
        </div>
        <table className="board-table">
          <caption className="sr-only">{t('data.board.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">ROUTE<small>{t('data.board.route')}</small></th>
              <th scope="col" className="board-dest">DESTINATION<small>{t('data.board.destination')}</small></th>
              <th scope="col">ROWS<small>{t('data.board.rows')}</small></th>
              <th scope="col" className="board-status">STATUS<small>{t('data.board.status')}</small></th>
            </tr>
          </thead>
          <tbody>
            {rawByRoute.map(({ pair, rows }) => {
              const [a, b] = pair.split('_');
              return (
                <tr key={pair}>
                  <th scope="row"><Cell text={`${a}⇄${b}`} read={`${a} ⇄ ${b}`} /></th>
                  <td className="board-dest"><Cell text={DEST[b]} /></td>
                  <td><Cell text={pad(rows)} read={fmt(rows)} /></td>
                  <td className="board-status"><span className="board-lamp" aria-hidden="true" /><Cell text="DAILY" read={t('data.board.daily')} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row"><Cell text="TOTAL" read={t('data.board.total')} /></th>
              <td className="board-dest" />
              <td><Cell text={pad(rawRows)} read={fmt(rawRows)} /></td>
              <td className="board-status" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
