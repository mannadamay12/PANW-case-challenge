import { useState, useEffect } from "react";

/**
 * Hook for animating mount/unmount transitions.
 * Returns shouldRender (whether to render the element) and isAnimating (whether entrance animation should play).
 */
export function useAnimatedPresence(isOpen: boolean, duration = 250) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  return { shouldRender, isAnimating };
}
