// 첫 그리기 전에 <head>에서 실행되는 인라인 스크립트. React가 뜨기 전에 두 가지를 정한다.
// 1) 로딩 화면 생략(같은 세션 재방문·움직임 줄이기·캡처 모드) → <html class="no-loader">
// 2) 3D 판정 대기(<html data-3d="pending">) → 대체 이미지를 숨겨, 곧 3D로 바뀔 첫 화면 이미지가
//    LCP가 되거나 받아지지 않게 한다. 움직임 줄이기면 3D를 안 쓰므로 대기 없이 이미지를 곧바로 보인다.
// 문자열로 넣으므로 옛 문법만 쓴다(var, function). tests/unit/boot.test.ts가 이 문자열을 그대로 실행해 본다.
export const PENDING_TIMEOUT_MS = 6000; // 3D 코드가 실패해 판정이 끝나지 않아도 이 시간 뒤에는 대체 화면을 보인다

export const BOOT_SCRIPT = `(function (w) {
  var d = w.document.documentElement;
  var reduced = false;
  try { reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try {
    if (reduced || /[?&]capture=/.test(w.location.search) || w.sessionStorage.getItem('signal.loaded')) d.classList.add('no-loader');
    else w.sessionStorage.setItem('signal.loaded', '1');
  } catch (e) { d.classList.add('no-loader'); }
  if (!reduced) {
    d.setAttribute('data-3d', 'pending');
    w.setTimeout(function () { if (d.getAttribute('data-3d') === 'pending') d.setAttribute('data-3d', 'off'); }, ${PENDING_TIMEOUT_MS});
  }
})(window);`;
