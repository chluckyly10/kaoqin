import { useEffect, useRef, useState } from 'react';

/**
 * 自适应表格高度：监听容器尺寸变化，返回可直接用于 Table.scroll.y 的像素值
 * @param reserveHeight 额外预留高度（分页器/工具栏等），默认 56px（分页高度）
 */
export function useAutoTableHeight<T extends HTMLElement = HTMLDivElement>(
  reserveHeight: number = 56,
) {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState<number>(400);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const calc = () => {
      const h = el.clientHeight;
      if (h > 0) {
        const scrollY = Math.max(100, h - reserveHeight);
        setHeight(scrollY);
      }
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener('resize', calc);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calc);
    };
  }, [reserveHeight]);

  return { ref, height };
}

export default useAutoTableHeight;
