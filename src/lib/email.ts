// 이메일 주소를 뒤집어서 저장해 두고 이 함수로 되돌린다. 정적 export한 HTML 소스에 온전한 주소가
// 연속 문자열로 나타나지 않게 해서, 소스를 긁어가는 주소 수집 봇을 피하려는 것이다.
export function revealEmail(reversed: string): string {
  return [...reversed].reverse().join('');
}
