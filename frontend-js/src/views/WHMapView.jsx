"use client";

import { FloorMapLayout } from "@/components/custom/temphumid/components/FloorMapLayout";
import { useFloorMapData } from "@/hooks/temphumid/use-floor-map-data";
import { FLOOR_MAP_CONFIGS } from "@/utils/floor-map-configs";

export default function WHMapView() {
  const config = FLOOR_MAP_CONFIGS.wh;
  const floorMap = useFloorMapData("wh");

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
