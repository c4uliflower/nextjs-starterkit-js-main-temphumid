import { useCallback, useEffect, useRef } from "react";

/* ── Component ────────────────────────────────────── */
export function Scrollspy({
  children,
  targetRef,
  onUpdate,
  className,
  offset = 0,
  smooth = true,
  dataAttribute = "scrollspy",
  history = true,
}) {
  const selfRef = useRef(null);
  const anchorsRef = useRef([]);
  const prevIdRef = useRef(null);
  /* ── Mark the active anchor ────────── */
  const setActive = useCallback(
    (sectionId, force = false) => {
      if (!sectionId) return;
      anchorsRef.current.forEach((el) => {
        const id = el.getAttribute(`data-${dataAttribute}-anchor`);

        if (id === sectionId) {
          el.setAttribute("data-active", "true");
        } else {
          el.removeAttribute("data-active");
        }
      });
      onUpdate?.(sectionId);

      if (history && (force || prevIdRef.current !== sectionId)) {
        window.history.replaceState({}, "", `#${sectionId}`);
      }

      prevIdRef.current = sectionId;
    },
    [dataAttribute, history, onUpdate],
  );
  /* ── Scroll handler ────────────────── */
  const handleScroll = useCallback(() => {
    const anchorList = anchorsRef.current;

    if (anchorList.length === 0) return;
    let scrollEl = targetRef?.current === document ? document.documentElement : targetRef?.current;

    if (!scrollEl) return;
    // Support shadcn ScrollArea's inner viewport
    const viewport = scrollEl.querySelector('[data-slot="scroll-area-viewport"]');

    if (viewport instanceof HTMLElement) scrollEl = viewport;
    const scrollTop =
      scrollEl === document.documentElement
        ? window.scrollY || document.documentElement.scrollTop
        : scrollEl.scrollTop;
    let activeIdx = 0;
    let minDelta = Infinity;

    anchorList.forEach((anchor, idx) => {
      const sectionId = anchor.getAttribute(`data-${dataAttribute}-anchor`);
      const section = sectionId ? document.getElementById(sectionId) : null;

      if (!section) return;
      let localOffset = offset;
      const dataOffset = anchor.getAttribute(`data-${dataAttribute}-offset`);

      if (dataOffset) localOffset = parseInt(dataOffset, 10);
      const delta = Math.abs(section.offsetTop - localOffset - scrollTop);

      if (section.offsetTop - localOffset <= scrollTop && delta < minDelta) {
        minDelta = delta;
        activeIdx = idx;
      }
    });
    // If scrolled to the very bottom, force last anchor active
    const scrollHeight = scrollEl.scrollHeight;
    const clientHeight = scrollEl.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 2) {
      activeIdx = anchorList.length - 1;
    }

    const activeAnchor = anchorList[activeIdx];
    const sectionId = activeAnchor?.getAttribute(`data-${dataAttribute}-anchor`) ?? null;

    setActive(sectionId);
  }, [targetRef, dataAttribute, offset, setActive]);
  /* ── Click → scroll to section ─────── */
  const scrollTo = useCallback(
    (anchorEl) => (event) => {
      event?.preventDefault();
      const sectionId =
        anchorEl.getAttribute(`data-${dataAttribute}-anchor`)?.replace("#", "") ?? null;

      if (!sectionId) return;
      const section = document.getElementById(sectionId);

      if (!section) return;
      let scrollTarget = targetRef?.current === document ? window : targetRef?.current;

      if (scrollTarget instanceof HTMLElement) {
        const viewport = scrollTarget.querySelector('[data-slot="scroll-area-viewport"]');

        if (viewport instanceof HTMLElement) scrollTarget = viewport;
      }

      let localOffset = offset;
      const dataOffset = anchorEl.getAttribute(`data-${dataAttribute}-offset`);

      if (dataOffset) localOffset = parseInt(dataOffset, 10);
      const scrollTop = section.offsetTop - localOffset;

      if (scrollTarget && "scrollTo" in scrollTarget) {
        scrollTarget.scrollTo({
          top: scrollTop,
          left: 0,
          behavior: smooth ? "smooth" : "auto",
        });
      }

      setActive(sectionId, true);
    },
    [dataAttribute, offset, smooth, targetRef, setActive],
  );

  /* ── Setup: gather anchors, bind listeners ── */
  useEffect(() => {
    if (selfRef.current) {
      anchorsRef.current = Array.from(
        selfRef.current.querySelectorAll(`[data-${dataAttribute}-anchor]`),
      );
    }

    const currentAnchors = anchorsRef.current;

    currentAnchors.forEach((el) => {
      el.addEventListener("click", scrollTo(el));
    });

    const onScroll = () => {
      handleScroll();
    };

    window.addEventListener("scroll", onScroll, true);
    // Initial activation
    const timeout = setTimeout(() => {
      handleScroll();
    }, 100);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      currentAnchors.forEach((el) => {
        el.removeEventListener("click", scrollTo(el));
      });
      clearTimeout(timeout);
    };
  }, [targetRef, handleScroll, dataAttribute, scrollTo]);

  return (
    <div data-slot="scrollspy" className={className} ref={selfRef}>
      {children}
    </div>
  );
}
