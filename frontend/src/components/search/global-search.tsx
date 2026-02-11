"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  Server, 
  AlertTriangle, 
  Wrench, 
  User, 
  MapPin,
  Search
} from "lucide-react";
import { api } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  url: string;
  metadata?: any;
}

interface SearchResponse {
  data: {
    servers: SearchResult[];
    incidents: SearchResult[];
    maintenance: SearchResult[];
    engineers: SearchResult[];
    locations: SearchResult[];
  };
  meta: {
    query: string;
    totalResults: number;
  };
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResponse["data"] | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Allow other UI (Topbar search button) to open the dialog.
  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("sam:open-search", onOpen);
    return () => window.removeEventListener("sam:open-search", onOpen);
  }, []);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
        setResults(response.data.data);
      } catch (error) {
        console.error("Search error:", error);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "server":
        return <Server className="h-4 w-4" />;
      case "incident":
        return <AlertTriangle className="h-4 w-4" />;
      case "maintenance":
        return <Wrench className="h-4 w-4" />;
      case "engineer":
        return <User className="h-4 w-4" />;
      case "location":
        return <MapPin className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (result: SearchResult) => {
    if (result.type === "server" && result.metadata?.status) {
      const status = result.metadata.status;
      const variants: Record<string, string> = {
        Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
        Maintenance: "bg-amber-50 text-amber-700 border-amber-200",
        Offline: "bg-rose-50 text-rose-700 border-rose-200",
        Degraded: "bg-orange-50 text-orange-700 border-orange-200",
      };

      return (
        <Badge
          variant="outline"
          className={`ml-2 text-xs ${variants[status] || "bg-slate-50 text-slate-700"}`}
        >
          {status}
        </Badge>
      );
    }

    if (result.type === "incident" && result.metadata?.severity) {
      const severity = result.metadata.severity;
      const variants: Record<string, string> = {
        Critical: "bg-rose-50 text-rose-700 border-rose-200",
        Major: "bg-orange-50 text-orange-700 border-orange-200",
        Medium: "bg-amber-50 text-amber-700 border-amber-200",
        Low: "bg-blue-50 text-blue-700 border-blue-200",
      };

      return (
        <Badge
          variant="outline"
          className={`ml-2 text-xs ${variants[severity] || "bg-slate-50 text-slate-700"}`}
        >
          {severity}
        </Badge>
      );
    }

    return null;
  };

  const totalResults = results
    ? Object.values(results).reduce((acc, arr) => acc + arr.length, 0)
    : 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search servers, incidents, maintenance..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && query && query.length >= 2 && totalResults === 0 && (
          <CommandEmpty>No results found for "{query}"</CommandEmpty>
        )}

        {!loading && results && (
          <>
            {/* Servers */}
            {results.servers && results.servers.length > 0 && (
              <CommandGroup heading="Servers">
                {results.servers.map((result) => (
                  <CommandItem
                    key={`server-${result.id}`}
                    value={`server-${result.id}`}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        {getStatusBadge(result)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Incidents */}
            {results.incidents && results.incidents.length > 0 && (
              <CommandGroup heading="Incidents">
                {results.incidents.map((result) => (
                  <CommandItem
                    key={`incident-${result.id}`}
                    value={`incident-${result.id}`}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-rose-50 text-rose-600">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        {getStatusBadge(result)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Maintenance */}
            {results.maintenance && results.maintenance.length > 0 && (
              <CommandGroup heading="Maintenance">
                {results.maintenance.map((result) => (
                  <CommandItem
                    key={`maintenance-${result.id}`}
                    value={`maintenance-${result.id}`}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-50 text-amber-600">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{result.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Engineers */}
            {results.engineers && results.engineers.length > 0 && (
              <CommandGroup heading="Engineers">
                {results.engineers.map((result) => (
                  <CommandItem
                    key={`engineer-${result.id}`}
                    value={`engineer-${result.id}`}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-50 text-purple-600">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{result.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Locations */}
            {results.locations && results.locations.length > 0 && (
              <CommandGroup heading="Locations">
                {results.locations.map((result) => (
                  <CommandItem
                    key={`location-${result.id}`}
                    value={`location-${result.id}`}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-50 text-green-600">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{result.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {!query && (
          <div className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              Start typing to search across servers, incidents, and more...
            </p>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium">
                <span className="text-xs">⌘</span>K
              </kbd>
              <span>or</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium">
                <span className="text-xs">Ctrl</span>K
              </kbd>
            </div>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
