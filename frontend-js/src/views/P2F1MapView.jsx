"use client";

import { FloorMapLayout } from "@/components/custom/temphumid/components/FloorMapLayout";
import { useFloorMapData } from "@/hooks/temphumid/use-floor-map-data";
import { FLOOR_MAP_CONFIGS } from "@/utils/floor-map-configs";

export default function P2F1MapView() {
  const config = FLOOR_MAP_CONFIGS.p2f1;
  const floorMap = useFloorMapData("p2f1");

  return (
    <FloorMapLayout
      title={config.pageTitle}
      subtitle={config.pageSubtitle}
      floorPlanImage={config.floorPlanImage}
      imageAlt={config.imageAlt}
      {...floorMap}
    />
  );
}
