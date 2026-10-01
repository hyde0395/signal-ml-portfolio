// 연락처 탑승권(설계 2026-10-01)의 노선 칸: 수집한 노선(facts.data.byRoute)에서 도착 공항 코드를 뽑는다.
// 노선이 늘거나 줄면(재수집) 탑승권의 TO 칸도 저절로 따라가게, 코드를 손으로 적지 않는다.
import type { Facts } from './facts';

// 'ICN_NRT' → 'NRT'. 순서는 byRoute 순서(행 수가 많은 순)를 지키고 같은 공항은 한 번만
export function destinationCodes(byRoute: Facts['data']['byRoute']): string[] {
  return [...new Set(byRoute.map((r) => r.pair.split('_')[1]))];
}
