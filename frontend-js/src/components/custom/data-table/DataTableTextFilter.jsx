import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DataTableTextFilter({ column, title, placeholder }) {
  const filterValue = column?.getFilterValue() ?? "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 border-dashed", filterValue && "border-solid")}
        >
          <Search className="mr-2 size-4" />
          {filterValue ? (
            <span className="max-w-[120px] truncate">{filterValue}</span>
          ) : (
            <span>{title ?? "Text filter"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] space-y-3 p-3" align="start">
        <p className="text-sm font-medium">{title ?? "Text filter"}</p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={placeholder ?? `Filter ${title?.toLowerCase() ?? "column"}...`}
            value={filterValue}
            onChange={(e) => column?.setFilterValue(e.target.value || undefined)}
            className="h-8 pl-8"
          />
          {filterValue && (
            <button
              type="button"
              onClick={() => column?.setFilterValue(undefined)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {filterValue && (
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
