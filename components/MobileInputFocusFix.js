import { useEffect } from "react";

function isEditableField(element) {
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
}

export default function MobileInputFocusFix() {
  useEffect(() => {
    let keyboardOpen = false;
    let initialViewportHeight = window.innerHeight;

    function setViewportVars() {
      const visualViewport = window.visualViewport;
      const viewportHeight = visualViewport?.height || window.innerHeight;
      const viewportOffsetTop = visualViewport?.offsetTop || 0;

      document.documentElement.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
      document.documentElement.style.setProperty("--app-viewport-offset-top", `${viewportOffsetTop}px`);

      const heightDifference = initialViewportHeight - viewportHeight;
      keyboardOpen = heightDifference > 140;
      document.documentElement.dataset.keyboardOpen = keyboardOpen ? "true" : "false";
    }

    function handleResize() {
      if (!keyboardOpen) {
        initialViewportHeight = Math.max(initialViewportHeight, window.innerHeight);
      }

      setViewportVars();
    }

    function handleFocusIn(event) {
      if (!isEditableField(event.target)) return;

      window.setTimeout(() => {
        setViewportVars();
        event.target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });
      }, 120);
    }

    function handleFocusOut() {
      window.setTimeout(setViewportVars, 120);
    }

    setViewportVars();

    window.addEventListener("resize", handleResize, { passive: true });
    window.visualViewport?.addEventListener("resize", handleResize, { passive: true });
    window.visualViewport?.addEventListener("scroll", setViewportVars, { passive: true });
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", setViewportVars);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
    };
  }, []);

  return null;
}
