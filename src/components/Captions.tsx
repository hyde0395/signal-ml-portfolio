'use client';
// 그림 판 블록의 자막 띠(설계 2026-09-28 §2)를 붙인다. Motion과 달리 움직임 줄이기에서도 붙인다 —
// 문단을 한 자리에서 바꿔 보여 주는 것은 연출이 아니라 배치라서, 끄면 문단이 겹친 채 하나만 보이게 된다.
import { useEffect } from 'react';
import { startCaptions } from '@/motion/caption';

export function Captions() {
  useEffect(() => startCaptions(document), []);
  return null;
}
