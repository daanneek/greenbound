import L from "leaflet";
import { useEffect } from "react";
import simpleMapStyle from "../map-style.json";

const getStyle = (isDark) =>
  isDark
    ? {
        ...simpleMapStyle,
        layers: simpleMapStyle.layers.map((layer) => ({
          ...layer,
          paint: Object.fromEntries(
            Object.entries(layer.paint || {}).map(([property, value]) => [
              property,
              typeof value === "string"
                ? value
                    .replaceAll("#f3f0e8", "#18231f")
                    .replaceAll("#b0c9ac", "#294438")
                    .replaceAll("#d8e2c2", "#3b5140")
                    .replaceAll("#b9d2c5", "#284a49")
                    .replaceAll("#a9c99f", "#31533d")
                    .replaceAll("#b9d9df", "#1e3d47")
                    .replaceAll("#83b8c4", "#4e8991")
                    .replaceAll("#5f6d5c", "#a5b8a5")
                    .replaceAll("#4e5d50", "#b4c4b4")
                    .replaceAll("#8d9d83", "#799278")
                    .replaceAll("#58645d", "#879b8d")
                    .replaceAll("#39433e", "#d1ddd3")
                    .replaceAll("#657068", "#adbbb0")
                : value,
            ]),
          ),
        })),
      }
    : simpleMapStyle;

export default function useVectorMapStyle(map, onTilesError, retryKey) {
  const isDark = document.documentElement.dataset.theme === "dark";
  useEffect(() => {
    const vectorLayer = L.maplibreGL({
      style: getStyle(isDark),
      attribution:
        'OpenFreeMap <a href="https://openmaptiles.org/">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright">Data from OpenStreetMap</a>',
    }).addTo(map);
    const glMap = vectorLayer.getMaplibreMap();
    const handleError = () => onTilesError?.(true);
    const handleLoad = () => onTilesError?.(false);
    glMap.on("error", handleError);
    glMap.on("load", handleLoad);
    map.invalidateSize();
    return () => {
      glMap.off("error", handleError);
      glMap.off("load", handleLoad);
      map.removeLayer(vectorLayer);
    };
  }, [isDark, map, onTilesError, retryKey]);
}
