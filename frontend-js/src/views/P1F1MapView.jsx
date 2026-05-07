"use client";

import { P1F1MapLayout } from "@/components/custom/temphumid/components/P1F1MapLayout";
import { useP1F1MapData } from "@/hooks/temphumid/use-p1f1-map-data";
import { FLOOR_MAP_CONFIGS } from "@/utils/floor-map-configs";

export default function P1F1MapView() {
  const config = FLOOR_MAP_CONFIGS.p1f1;
  const floorMap = useP1F1MapData();

  return (
    <P1F1MapLayout
      title={config.pageTitle}
      subtitle={config.pageSubtitle}
      floorPlanImage={config.floorPlanImage}
      imageAlt={config.imageAlt}
      dessicatorZone={config.dessicatorZone}
      {...floorMap}
    />
  );
}
