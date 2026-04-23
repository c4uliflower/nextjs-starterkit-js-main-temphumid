"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";

import {
  DAILY_LIMIT_LL_COLOR,
  DAILY_LIMIT_UL_COLOR,
  getCSSVar,
} from "@/utils/daily";

export const DailyLineChart = memo(function DailyLineChart({
  id,
  title,
  subtitle,
  datasets,
  labels,
  yLabel,
  limitProfiles,
  limitKeyUL,
  limitKeyLL,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!window.Chart || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const mutedForeground = getCSSVar("--muted-foreground");
    const borderColor = getCSSVar("--border");

    const limitDatasets = limitProfiles.flatMap((profile) => {
      const ul = profile[limitKeyUL];
      const ll = profile[limitKeyLL];
      const suffix = limitProfiles.length > 1 ? ` (${profile.location})` : "";

      return [
        {
          label: `UL ${ul}${suffix}`,
          data: labels.map(() => ul),
          borderColor: DAILY_LIMIT_UL_COLOR,
          borderDash: [8, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 0,
        },
        {
          label: `LL ${ll}${suffix}`,
          data: labels.map(() => ll),
          borderColor: DAILY_LIMIT_LL_COLOR,
          borderDash: [8, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 0,
        },
      ];
    });

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets: [...datasets, ...limitDatasets] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 24, boxHeight: 4, font: { size: 11 }, padding: 14 },
          },
          zoom: {
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              pinch: { enabled: true },
              mode: "x",
            },
            pan: {
              enabled: true,
              mode: "x",
              onPanStart: () => setDragging(true),
              onPanComplete: () => setDragging(false),
            },
          },
          tooltip: {
            backgroundColor: "rgba(33,37,41,.93)",
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 12,
              font: { size: 10 },
              color: mutedForeground,
              maxRotation: 30,
            },
            grid: { color: borderColor },
          },
          y: {
            title: {
              display: true,
              text: yLabel,
              font: { size: 11 },
              color: mutedForeground,
            },
            ticks: { font: { size: 10 }, color: mutedForeground },
            grid: { color: borderColor },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [datasets, labels, limitProfiles, limitKeyLL, limitKeyUL, yLabel]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  return (
    <div>
      <h6>{title}</h6>
      <p className="mt-1 ml-3 text-xs text-muted-foreground">{subtitle}</p>
      <div
        onMouseDown={() => setDragging(true)}
        onMouseUp={handleMouseUp}
        style={{
          height: 320,
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          id={id}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
});
