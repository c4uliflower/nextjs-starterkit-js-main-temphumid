// Copied from the current temp/humid route pages as an additive scaffold.

export const API_BASE = "/api/temphumid";

export const FLOORS = [
  { slug: "p1f1", label: "Plant 1 · Floor 1", subLabel: "P1F1" },
  { slug: "p1f2", label: "Plant 1 · Floor 2", subLabel: "P1F2" },
  { slug: "p2f1", label: "Plant 2 · Floor 1", subLabel: "P2F1" },
  { slug: "p2f2", label: "Plant 2 · Floor 2", subLabel: "P2F2" },
  { slug: "p12f2", label: "Plant 1 & 2 · Floor 2", subLabel: "Bridge" },
  { slug: "wh", label: "Warehouse", subLabel: "WH" },
];

export const WH_AREA_IDS = new Set([
  "P2F1-08",
  "P2F1-09",
  "P2F1-10",
  "P2F1-11",
  "P2F1-12",
  "P2F1-13",
  "P2F1-14",
  "P2F1-15",
]);

export const P1F1_EXCLUDED_AREA_IDS = new Set(["P1F1-16"]);

export const ALL_FLOORS = [
  {
    id: "p1f1",
    label: "Plant 1 · Floor 1",
    image: "/logo/assets/P1F1-6.png",
    href: "/temphumid-p1f1",
    sensors: [
      { id: "aoi", areaId: "P1F1-04", name: "AOI" },
      { id: "dipping2", areaId: "P1F1-06", name: "Dipping 2" },
      { id: "dipping", areaId: "P1F1-01", name: "Dipping" },
      { id: "server-room", areaId: "P1F1-03", name: "Server Room" },
      { id: "smt", areaId: "P1F1-02", name: "SMT" },
      { id: "smt-cs", areaId: "P1F1-10", name: "SMT - Cold Storage" },
      { id: "smt-mh", areaId: "P1F1-05", name: "SMT MH" },
      { id: "smt-mh-rcv", areaId: "P1F1-14", name: "SMT MH Receiving" },
      { id: "bga-r", areaId: "P1F1-15", name: "BGA Rework" },
      { id: "coating", areaId: "P1F1-17", name: "Coating Area" },
      { id: "dess-1", areaId: "P1F1-09", name: "SMT MH Dessicator 1" },
      { id: "dess-2", areaId: "P1F1-07", name: "SMT MH Dessicator 2" },
      { id: "dess-3", areaId: "P1F1-11", name: "SMT MH Dessicator 3" },
      { id: "dess-4", areaId: "P1F1-12", name: "SMT MH Dessicator 4" },
      { id: "dess-5", areaId: "P1F1-13", name: "SMT MH Dessicator 5" },
    ],
  },
  {
    id: "p1f2",
    label: "Plant 1 · Floor 2",
    image: "/logo/assets/P1F2-1.png",
    href: "/temphumid-p1f2",
    sensors: [
      { id: "brother-assy-1", areaId: "P1F2-03", name: "Brother Assy 1" },
      { id: "brother-assy-2", areaId: "P1F2-02", name: "Brother Assy 2" },
      { id: "jcm-pcba", areaId: "P1F2-01", name: "JCM PCBA" },
      { id: "mh-brother-pkg", areaId: "P1F2-05", name: "MH Brother Packaging" },
    ],
  },
  {
    id: "p2f1",
    label: "Plant 2 · Floor 1",
    image: "/logo/assets/P2F1-1.png",
    href: "/temphumid-p2f1",
    sensors: [
      { id: "fg", areaId: "P2F1-03", name: "FG" },
      { id: "warehouse-office", areaId: "P2F1-01", name: "Warehouse Office" },
      { id: "wh-cs", areaId: "P2F1-16", name: "WH - Cold Storage" },
      { id: "wh-cs2", areaId: "P2F1-17", name: "WH - Cold Storage 2" },
      { id: "wo-north", areaId: "P2F1-18", name: "WO-North" },
      { id: "wo-south-ha", areaId: "P2F1-07", name: "WO-South Holding Area" },
      { id: "wo-sw-iqc", areaId: "P2F1-04", name: "WO-S-West-IQC" },
      { id: "wo-w-south-qa", areaId: "P2F1-05", name: "WO-W South-QA" },
    ],
  },
  {
    id: "p2f2",
    label: "Plant 2 · Floor 2",
    image: "/logo/assets/P2F2-1.png",
    href: "/temphumid-p2f2",
    sensors: [
      { id: "calibration-room", areaId: "P2F2-04", name: "Calibration Room" },
      { id: "jcm-assy", areaId: "P2F2-01", name: "JCM Assy" },
      { id: "wh-brother-pkg", areaId: "P2F2-02", name: "WH Brother Packaging" },
      { id: "wh-mh-jcm-assy", areaId: "P2F2-03", name: "WH-MH JCM Assy" },
      { id: "cis", areaId: "P1F1-16", name: "CIS" },
    ],
  },
  {
    id: "wh",
    label: "Warehouse",
    image: "/logo/assets/WH.png",
    href: "/temphumid-wh",
    sensors: [
      { id: "wh-a", areaId: "P2F1-08", name: "WH-A" },
      { id: "wh-b", areaId: "P2F1-09", name: "WH-B" },
      { id: "wh-c", areaId: "P2F1-10", name: "WH-C" },
      { id: "wh-d", areaId: "P2F1-11", name: "WH-D" },
      { id: "wh-e", areaId: "P2F1-12", name: "WH-E" },
      { id: "wh-f", areaId: "P2F1-13", name: "WH-F" },
      { id: "wh-g", areaId: "P2F1-14", name: "WH-G" },
      { id: "wh-h", areaId: "P2F1-15", name: "WH-H" },
    ],
  },
  {
    id: "p1and2f2",
    label: "Bridge",
    image: "/logo/assets/P1-P2F2-1.png",
    href: "/temphumid-p12f2",
    sensors: [{ id: "p1p2-bridge", areaId: "P1F2-06", name: "P1P2 Bridge" }],
  },
];

export const FLOOR_SLUG = {
  p1f1: "p1f1",
  p1f2: "p1f2",
  p2f1: "p2f1",
  p2f2: "p2f2",
  wh: "wh",
  p1and2f2: "p12f2",
};
