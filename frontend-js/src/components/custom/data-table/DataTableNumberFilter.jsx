import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DataTableNumberFilter({ column, title, prefix = "" }) {
  const filterValue = column?.getFilterValue();
  const min = filterValue?.[0];
  const max = filterValue?.[1];
  const hasFilter = min != null || max != null;
  const label = hasFilter
    ? `${prefix}${min ?? "0"} – ${prefix}${max ?? "∞"}`
    : (title ?? "Number range");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 border-dashed", hasFilter && "border-solid")}
        >
          <SlidersHorizontal className="mr-2 size-4" />
          <span className="max-w-[160px] truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] space-y-3 p-4" align="start">
        <p className="text-sm font-medium">{title ?? "Number range"}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Min</Label>
            <Input
              type="number"
              placeholder="Min"
              className="h-8"
              value={min ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;

                column?.setFilterValue([val, max]);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Max</Label>
            <Input
              type="number"
              placeholder="Max"
              className="h-8"
              value={max ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;

                column?.setFilterValue([min, val]);
              }}
            />
          </div>
        </div>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => column?.setFilterValue(undefined)}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
// Custom filter function for number range columns
export function numberRangeFilterFn(row, columnId, filterValue) {
  if (!filterValue) return true;
  const [min, max] = filterValue;

  if (min == null && max == null) return true;
  const value = row.getValue(columnId);

  if (min != null && value < min) return false;
  if (max != null && value > max) return false;

  return true;
}
