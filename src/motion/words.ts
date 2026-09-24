// 텍스트 리빌(스펙 §4)용 단어 나누기. 공백을 따로 보존해 다시 이어 붙이면 원문과 같게 한다.
// 공백이 없는 일본어 제목은 한 덩어리로 떠오른다(글자 단위로 쪼개면 읽는 흐름이 끊겨 보인다).
export function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}
