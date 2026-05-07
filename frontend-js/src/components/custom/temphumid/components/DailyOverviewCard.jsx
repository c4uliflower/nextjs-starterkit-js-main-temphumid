"use client";

import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/custom/Combobox";

import { DailyLineChart } from "@/components/custom/temphumid/components/DailyLineChart";
import { toLocationOptions, toSensorOptions } from "@/utils/daily";

export function DailyOverviewCard({
  apiError,
  applied,
  canApply,
  chartKey,
  chartReady,
  chartSubtitle,
  chartView,
  exporting,
  handleApply,
  handleClear,
  handleExport,
  handleLocationChange,
  handleRangeChange,
  handleSensorChange,
  handleSundayToggle,
  handleViewToggle,
  hintText,
  humidDS,
  includeSundays,
  labels,
  limitProfiles,
  loading,
  locationOptionsList,
  noData,
  range,
  selLocationValues,
  selSensorValues,
  sensorOptionsList,
  tempDS,
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-base">Overview</CardTitle>
          <CardDescription>Select location, sensor and date range.</CardDescription>
        </div>
        <div className="shrink-0 flex gap-2">
          {applied && !noData && !apiError && (
            <Button
              variant="outline"
              size="default"
              onClick={handleExport}
              disabled={exporting}
              className="cursor-pointer gap-1.5"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
          )}
          <Button variant="outline" size="default" onClick={handleClear} className="cursor-pointer">
            Clear
          </Button>
          <Button onClick={handleApply} disabled={!canApply || loading} className="cursor-pointer">
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3 border-b pb-4">
          <div className="min-w-45 flex-1 flex-col gap-1 [&_button]:cursor-pointer">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Location
            </label>
            <Combobox
              multiple
              options={toLocationOptions(locationOptionsList)}
              value={selLocationValues}
              onValueChange={handleLocationChange}
              placeholder="Select location..."
              searchPlaceholder="Search location..."
              emptyMessage="No locations found."
            />
          </div>
          <div className="min-w-45 flex-1 flex-col gap-1 [&_button]:cursor-pointer">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sensor
            </label>
            <Combobox
              multiple
              options={toSensorOptions(sensorOptionsList)}
              value={selSensorValues}
              onValueChange={handleSensorChange}
              placeholder="Select sensor..."
              searchPlaceholder="Search sensor..."
              emptyMessage="No sensors found."
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date Range
            </label>
            <DateRangePicker value={range} onChange={handleRangeChange} />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-3 pb-1">
          <p className="flex-1 text-xs text-muted-foreground">{hintText}</p>

          {applied && !noData && !apiError && (
            <>
              <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeSundays}
                  onChange={handleSundayToggle}
                  style={{ cursor: "pointer" }}
                />
                Include Sundays
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  border: "1px solid var(--border)",
                  background: "var(--muted)",
                  borderRadius: 8,
                  padding: 3,
                }}
              >
                {["daily", "monthly"].map((view) => (
                  <button
                    key={view}
                    onClick={() => handleViewToggle(view)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: chartView === view ? 600 : 400,
                      background: chartView === view ? "var(--card)" : "transparent",
                      color:
                        chartView === view ? "var(--foreground)" : "var(--muted-foreground)",
                      boxShadow:
                        chartView === view ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                      transition: "all .15s",
                    }}
                  >
                    {view === "daily" ? "Daily" : "Monthly"}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="shrink-0 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg width="24" height="10">
                <line
                  x1="0"
                  y1="5"
                  x2="24"
                  y2="5"
                  stroke="#c0392b"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                />
              </svg>
              Upper limit
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg width="24" height="10">
                <line
                  x1="0"
                  y1="5"
                  x2="24"
                  y2="5"
                  stroke="#2471a3"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                />
              </svg>
              Lower limit
            </span>
          </div>
        </div>

        <div className="pt-4">
          {!chartReady || loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {loading ? "Fetching sensor data..." : "Loading Chart.js..."}
            </div>
          ) : apiError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                style={{
                  background: "#ffe8e8",
                  border: "1.5px solid #dc3545",
                  borderRadius: 8,
                  padding: "12px 20px",
                }}
                className="max-w-md text-center text-sm text-destructive"
              >
                {apiError}
              </div>
            </div>
          ) : applied && noData ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
              <p className="mb-1 font-semibold text-foreground">No readings found</p>
              <p className="text-sm text-muted-foreground">
                No data exists for the selected sensor(s) in this date range.
                <br />
                Try a different date range - data may only exist for older dates.
              </p>
            </div>
          ) : !applied ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
              <span className="mb-3 text-4xl">
                <FileText />
              </span>
              <p className="mb-1 font-semibold text-foreground">No data to display</p>
              <p className="text-sm text-muted-foreground">
                Select location or sensor then click <strong>Apply</strong>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <DailyLineChart
                key={`temp-${chartKey}`}
                id="tempChart"
                title="Temperature"
                subtitle={chartSubtitle("Temperature (°C)")}
                datasets={tempDS}
                labels={labels}
                yLabel="Temperature (°C)"
                limitProfiles={limitProfiles}
                limitKeyUL="tempUL"
                limitKeyLL="tempLL"
              />
              <div className="border-t" />
              <DailyLineChart
                key={`humid-${chartKey}`}
                id="humidChart"
                title="Humidity"
                subtitle={chartSubtitle("Humidity (%)")}
                datasets={humidDS}
                labels={labels}
                yLabel="Humidity (%)"
                limitProfiles={limitProfiles}
                limitKeyUL="humidUL"
                limitKeyLL="humidLL"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
