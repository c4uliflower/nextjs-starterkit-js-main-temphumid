import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export function CodePreview({ children, code, title, className, defaultExpanded = false }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { theme } = useTheme();

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg border border-border/60 overflow-hidden", className)}>
      {title && (
        <div className="border-b bg-muted/30 px-4 py-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
      )}

      {/* Live preview */}
      <div className="p-6">{children}</div>

      {/* Toggle bar */}
      <div className="border-t bg-muted/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {expanded ? (
            <>
              Hide code <ChevronUp className="size-4" />
            </>
          ) : (
            <>
              Show code <ChevronDown className="size-4" />
            </>
          )}
        </button>
      </div>

      {/* Code snippet */}
      {expanded && (
        <div className="relative border-t">
          <button
            onClick={copyToClipboard}
            className="absolute top-3 right-3 z-10 rounded-md border bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
          <Highlight
            theme={theme === "dark" ? themes.oneDark : themes.oneLight}
            code={code.trim()}
            language="tsx"
          >
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className="overflow-x-auto p-4 pr-12 text-sm leading-relaxed"
                style={{ ...style, background: "transparent" }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}
    </div>
  );
}
