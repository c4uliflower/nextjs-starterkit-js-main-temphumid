import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

// ── Component ──────────────────────────────────────
export function Combobox(props) {
  const {
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyMessage = "No results found.",
    className,
    disabled = false,
    multiple = false,
  } = props;
  const [open, setOpen] = useState(false);

  // ── Single select ────────────────────────────────
  if (!multiple) {
    const { value = "", onValueChange } = props;
    const selectedOption = options.find((o) => o.value === value);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal cursor-pointer",
              !value && "text-muted-foreground",
              className,
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    disabled={option.disabled}
                    className="cursor-pointer"
                    onSelect={() => {
                      onValueChange?.(option.value === value ? "" : option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // ── Multi select ─────────────────────────────────
  const { value: values = [], onValueChange } = props;

  const enabledOptions  = options.filter((o) => !o.disabled);
  const allSelected     = enabledOptions.length > 0 && enabledOptions.every((o) => values.includes(o.value));
  const someSelected    = !allSelected && enabledOptions.some((o) => values.includes(o.value));

  const toggleSelectAll = () => {
    if (allSelected) {
      // Deselect all enabled options (keep any disabled ones that were somehow selected)
      onValueChange?.(values.filter((v) => !enabledOptions.find((o) => o.value === v)));
    } else {
      // Select all enabled options, merging with any already-selected values
      const enabledValues = enabledOptions.map((o) => o.value);
      onValueChange?.([...new Set([...values, ...enabledValues])]);
    }
  };

  const toggleValue = (val) => {
    const next = values.includes(val) ? values.filter((v) => v !== val) : [...values, val];
    onValueChange?.(next);
  };
  const removeValue = (val) => {
    onValueChange?.(values.filter((v) => v !== val));
  };

  const selectedLabels = values.map((v) => options.find((o) => o.value === v)).filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-10 cursor-pointer",
            values.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedLabels.length > 0 ? (
              selectedLabels.map((opt) => (
                <Badge key={opt.value} variant="secondary" className="gap-1 text-xs">
                  {opt.label}
                  <div
                    type="button"
                    className="rounded-full outline-none hover:bg-muted-foreground/20 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(opt.value);
                    }}
                  >
                    <X className="size-3" />
                  </div>
                </Badge>
              ))
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {/* ── Select All row ── */}
              {enabledOptions.length > 1 && (
                <CommandItem
                  key="__select_all__"
                  value="__select_all__"
                  className="cursor-pointer border-b border-border/50 mb-1 font-medium"
                  onSelect={toggleSelectAll}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      allSelected ? "opacity-100" : someSelected ? "opacity-40" : "opacity-0",
                    )}
                  />
                  {allSelected ? "Deselect All" : "Select All"}
                </CommandItem>
              )}

              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  disabled={option.disabled}
                  className="cursor-pointer"
                  onSelect={() => toggleValue(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      values.includes(option.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}