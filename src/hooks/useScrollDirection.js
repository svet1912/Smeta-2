import { useState, useEffect } from 'react';

const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState(null);
  const [prevOffset, setPrevOffset] = useState(0);

  useEffect(() => {
    const threshold = 0;
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;

      if (Math.abs(scrollY - prevOffset) < threshold) {
        ticking = false;
        return;
      }

      setScrollDirection(scrollY > prevOffset ? "down" : "up");
      setPrevOffset(scrollY > 0 ? scrollY : 0);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, [prevOffset]);

  return scrollDirection;
};

export default useScrollDirection;