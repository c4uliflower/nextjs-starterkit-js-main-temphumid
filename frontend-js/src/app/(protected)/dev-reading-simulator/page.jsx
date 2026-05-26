import { notFound } from "next/navigation";

import { DevReadingSimulatorView } from "@/features/temphumid/dev/views/DevReadingSimulatorView";

export default function DevReadingSimulatorPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DevReadingSimulatorView />;
}
