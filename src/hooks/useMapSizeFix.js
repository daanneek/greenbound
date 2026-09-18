import { useLayoutEffect } from "react";

export default function useMapSizeFix(map) {
  useLayoutEffect(() => {
    map.invalidateSize();
    map.setMinZoom(6);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(map.getContainer());
    return () => resizeObserver.disconnect();
  }, [map]);
}
