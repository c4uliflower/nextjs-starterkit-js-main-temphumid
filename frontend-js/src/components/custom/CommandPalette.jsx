import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { resolveIcon } from "@/lib/resolve-icon";
import { useAuthContext } from "@/lib/auth/AuthHook";

function flattenMenuGroups(groups) {
  const results = [];

  function walk(items, group, parent) {
    for (const item of items) {
      if (item.href) {
        results.push({
          title: item.title,
          href: item.href,
          icon: resolveIcon(item.icon),
          group,
          parent,
        });
      }
      if (item.children) {
        walk(item.children, group, item.title);
      }
    }
  }
  for (const group of groups) {
    walk(group.items, group.label);
  }

  return results;
}
export default function CommandPalette({ open, onOpenChange }) {
  const router = useRouter();
  const { user } = useAuthContext();
  const items = useMemo(
    () => flattenMenuGroups(user?.data.sidebar ?? []),
    [user?.data.sidebar]
  );
  const grouped = useMemo(() => {
    const map = new Map();

    for (const item of items) {
      const existing = map.get(item.group);

      if (existing) {
        existing.push(item);
      } else {
        map.set(item.group, [item]);
      }
    }

    return map;
  }, [items]);

  function handleSelect(href) {
    router.push(href);
    onOpenChange(false);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search for pages and components"
      showCloseButton={false}
    >
      <CommandInput placeholder="Type to search pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Array.from(grouped.entries()).map(([group, groupItems]) => (
          <CommandGroup key={group} heading={group}>
            {groupItems.map((item) => (
              <CommandItem
                key={item.href}
                value={item.parent ? `${item.parent} ${item.title}` : item.title}
                onSelect={() => handleSelect(item.href)}
              >
                {item.icon && <item.icon className="mr-2 size-4" />}
                <span>
                  {item.parent && (
                    <span className="text-muted-foreground">{item.parent} &rsaquo; </span>
                  )}
                  {item.title}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
