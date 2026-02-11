"use client";

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Download,
  Globe,
  Home,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings,
  Snowflake,
  Trash2,
  TreePine,
  X,
  Zap,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requiredText } from "@/lib/validation";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PremiumTable,
  PremiumTableHeader,
  PremiumTableHead,
  PremiumTableBody,
  PremiumTableRow,
  PremiumTableCell,
  PremiumStatusBadge,
  PremiumActionButton,
  PremiumTableEmptyState,
  PremiumTableSkeleton,
} from "@/components/tables/premium-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

type LocationRow = {
  location_id: number;
  site_name?: string;
  country?: string;
  city?: string;
  address?: string;
  site_type?: string;
  power_source?: string;
  cooling_type?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
};

const COUNTRIES = ["Somalia", "Kenya", "Ethiopia", "Djibouti", "Uganda", "Tanzania"];
const CITIES = {
  Somalia: ["Mogadishu", "Hargeisa", "Kismayo", "Baidoa", "Marka"],
  Kenya: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
  Ethiopia: ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Hawassa"],
  Djibouti: ["Djibouti City", "Ali Sabieh", "Tadjourah", "Obock", "Dikhil"],
  Uganda: ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu"],
  Tanzania: ["Dar es Salaam", "Dodoma", "Mwanza", "Arusha", "Mbeya"],
};

const schema = z.object({
  site_name: requiredText("Site name is required"),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  site_type: z.enum(["Data Center", "Edge", "Office", "Outdoor"]).optional(),
  power_source: z.enum(["Grid", "UPS", "Generator", "Solar", "Hybrid"]).optional(),
  cooling_type: z.enum(["HVAC", "Airflow", "Liquid", "None"]).optional(),
});

type FormValues = z.infer<typeof schema>;

// Helper function to map site type to PremiumStatusBadge variant
function getSiteTypeVariant(type?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!type) return "secondary";
  if (type === "Data Center") return "info";
  if (type === "Edge") return "success";
  if (type === "Outdoor") return "warning";
  return "secondary";
}

export default function LocationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<LocationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [siteTypeFilter, setSiteTypeFilter] = React.useState<string>("all");
  const [countryFilter, setCountryFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("site_name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    site_name: true,
    location: true,
    site_type: true,
    power: true,
    cooling: true,
    created: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canManage = can(user, "locations.manage");

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editLocation, setEditLocation] = React.useState<LocationRow | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const siteType = watch("site_type");
  const powerSource = watch("power_source");
  const coolingType = watch("cooling_type");
  const selectedCountry = watch("country");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/locations", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as LocationRow[]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Failed to load locations";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDialog = React.useCallback((location?: LocationRow) => {
    if (location) {
      setEditLocation(location);
      reset({
        site_name: location.site_name ?? "",
        country: location.country ?? "",
        city: location.city ?? "",
        address: location.address ?? "",
        site_type: location.site_type as any,
        power_source: location.power_source as any,
        cooling_type: location.cooling_type as any,
      });
    } else {
      setEditLocation(null);
      reset({
        site_name: "",
        country: "Somalia",
        city: "Mogadishu",
        address: "",
        site_type: undefined,
        power_source: undefined,
        cooling_type: undefined,
      });
    }
    setDialogOpen(true);
  }, [reset]);

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      try {
        if (editLocation) {
          await api.patch(
            `/api/locations/${editLocation.location_id}`,
            values,
            { headers: { "x-sam-silent": "1" } }
          );
          toast.success("Location updated successfully");
        } else {
          await api.post("/api/locations", values, { headers: { "x-sam-silent": "1" } });
          toast.success("Location created successfully");
        }

        setDialogOpen(false);
        await load();
      } catch (e: any) {
        const status = e?.response?.status;
        const code = e?.response?.data?.error?.code;
        const msg =
          e?.response?.data?.error?.message ??
          e?.message ??
          `Failed to ${editLocation ? "update" : "create"} location`;
        if (status === 409 && code === "SITE_NAME_ALREADY_EXISTS") {
          toast.error(msg);
          await load();
          return;
        }
        toast.error(msg);
      }
    },
    [editLocation, load]
  );

  const deleteLocation = React.useCallback(
    async (location: LocationRow) => {
      if (!confirm(`Delete location "${location.site_name}"? This cannot be undone.`)) {
        return;
      }

      try {
        await api.delete(`/api/locations/${location.location_id}`, {
          headers: { "x-sam-silent": "1" },
        });
        toast.success("Location deleted successfully");
        await load();
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error?.message ?? e?.message ?? "Failed to delete location"
        );
      }
    },
    [load]
  );

  // Get unique countries for filter
  const uniqueCountries = React.useMemo(() => {
    const countries = new Set(
      rows.map((r) => r.country).filter((c): c is string => Boolean(c))
    );
    return Array.from(countries).sort();
  }, [rows]);

  // Filter and search
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.site_name?.toLowerCase().includes(query) ||
          r.country?.toLowerCase().includes(query) ||
          r.city?.toLowerCase().includes(query) ||
          r.address?.toLowerCase().includes(query)
      );
    }

    // Site type filter
    if (siteTypeFilter && siteTypeFilter !== "all") {
      result = result.filter((r) => r.site_type === siteTypeFilter);
    }

    // Country filter
    if (countryFilter && countryFilter !== "all") {
      result = result.filter((r) => r.country === countryFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof LocationRow];
      let bVal: any = b[sortField as keyof LocationRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, searchQuery, siteTypeFilter, countryFilter, sortField, sortDirection]);

  // Pagination
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(total, startIndex + pageSize);
  const pagedRows = filteredRows.slice(startIndex, endIndex);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, siteTypeFilter, countryFilter]);

  const exportCsv = React.useCallback(() => {
    const headers = [
      "Site Name",
      "Country",
      "City",
      "Site Type",
      "Power Source",
      "Cooling Type",
    ];
    const data = filteredRows.map((r) => [
      r.site_name ?? "",
      r.country ?? "",
      r.city ?? "",
      r.site_type ?? "",
      r.power_source ?? "",
      r.cooling_type ?? "",
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `locations-export-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Exported successfully");
  }, [filteredRows]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };


  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Locations</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage physical sites and data center locations for infrastructure deployment
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={loading || rows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            {canManage && (
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            )}
          </div>
        </div>

        {/* Table Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.site_name}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, site_name: checked }))
                  }
                >
                  Site Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.location}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, location: checked }))
                  }
                >
                  Country / City
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.site_type}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, site_type: checked }))
                  }
                >
                  Site Type
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.power}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, power: checked }))
                  }
                >
                  Power Source
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.cooling}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, cooling: checked }))
                  }
                >
                  Cooling Type
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.created}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, created: checked }))
                  }
                >
                  Created Date
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name, country, city, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
                      <span>
                        {siteTypeFilter === "all" ? "All Types" : siteTypeFilter}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSiteTypeFilter("all")}>
                      All Types
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSiteTypeFilter("Data Center")}>
                      <Building2 className="mr-2 h-4 w-4 text-blue-600" /> Data Center
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSiteTypeFilter("Edge")}>
                      <Zap className="mr-2 h-4 w-4 text-emerald-600" /> Edge
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSiteTypeFilter("Outdoor")}>
                      <TreePine className="mr-2 h-4 w-4 text-amber-600" /> Outdoor
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSiteTypeFilter("Office")}>
                      <Home className="mr-2 h-4 w-4 text-slate-600" /> Office
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {uniqueCountries.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[140px] justify-between"
                      >
                        <span>
                          {countryFilter === "all" ? "All Countries" : countryFilter}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setCountryFilter("all")}>
                        All Countries
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {uniqueCountries.map((country) => (
                        <DropdownMenuItem
                          key={country}
                          onClick={() => setCountryFilter(country)}
                        >
                          <Globe className="mr-2 h-4 w-4" /> {country}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

          {/* Active Filters Display */}
          {(searchQuery || siteTypeFilter !== "all" || countryFilter !== "all") && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <button
                    onClick={() => setSearchQuery("")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {siteTypeFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Type: {siteTypeFilter}
                  <button
                    onClick={() => setSiteTypeFilter("all")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {countryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Country: {countryFilter}
                  <button
                    onClick={() => setCountryFilter("all")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSiteTypeFilter("all");
                  setCountryFilter("all");
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Premium Table */}
        <PremiumTable>
          <PremiumTableHeader>
            <tr>
              {visibleColumns.site_name && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "site_name" ? sortDirection : null}
                  onSort={() => toggleSort("site_name")}
                >
                  Site Name
                </PremiumTableHead>
              )}
              {visibleColumns.location && (
                <PremiumTableHead>Country / City</PremiumTableHead>
              )}
              {visibleColumns.site_type && (
                <PremiumTableHead>Site Type</PremiumTableHead>
              )}
              {visibleColumns.power && (
                <PremiumTableHead>Power Source</PremiumTableHead>
              )}
              {visibleColumns.cooling && (
                <PremiumTableHead>Cooling Type</PremiumTableHead>
              )}
              {visibleColumns.created && (
                <PremiumTableHead>Created</PremiumTableHead>
              )}
              <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={7} />
            ) : loadError ? (
              <tr>
                <td colSpan={100} className="py-16 text-center">
                  <EmptyState
                    icon={<AlertTriangle className="h-12 w-12 text-slate-400" />}
                    title="Failed to load"
                    description={loadError}
                    action={
                      <Button onClick={load} variant="outline">
                        Retry
                      </Button>
                    }
                  />
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <PremiumTableEmptyState
                icon={<MapPin className="h-12 w-12" />}
                title="No locations found"
                description={
                  searchQuery || siteTypeFilter !== "all" || countryFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : canManage
                    ? "Create your first location to start managing infrastructure sites"
                    : "No location records are available"
                }
                action={
                  canManage &&
                  !searchQuery &&
                  siteTypeFilter === "all" &&
                  countryFilter === "all" ? (
                    <Button onClick={() => openDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Location
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              pagedRows.map((location) => (
                <PremiumTableRow key={location.location_id}>
                  {visibleColumns.site_name && (
                    <PremiumTableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {location.site_name || "—"}
                        </div>
                        {location.address && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {location.address}
                          </div>
                        )}
                      </div>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.location && (
                    <PremiumTableCell>
                      {location.country || location.city ? (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-slate-400" />
                          <span>
                            {[location.country, location.city]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </PremiumTableCell>
                  )}
                  {visibleColumns.site_type && (
                    <PremiumTableCell>
                      {location.site_type ? (
                        <PremiumStatusBadge variant={getSiteTypeVariant(location.site_type)}>
                          {location.site_type}
                        </PremiumStatusBadge>
                      ) : (
                        "—"
                      )}
                    </PremiumTableCell>
                  )}
                  {visibleColumns.power && (
                    <PremiumTableCell>
                      {location.power_source ? (
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-slate-400" />
                          <span>{location.power_source}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </PremiumTableCell>
                  )}
                  {visibleColumns.cooling && (
                    <PremiumTableCell>
                      {location.cooling_type ? (
                        <div className="flex items-center gap-2">
                          <Snowflake className="h-4 w-4 text-slate-400" />
                          <span>{location.cooling_type}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </PremiumTableCell>
                  )}
                  {visibleColumns.created && (
                    <PremiumTableCell>
                      {location.created_at
                        ? new Date(location.created_at).toLocaleDateString()
                        : "—"}
                    </PremiumTableCell>
                  )}
                  <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                    {canManage ? (
                      <div className="flex items-center justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PremiumActionButton
                              variant="edit"
                              icon={<Pencil className="h-4 w-4" />}
                              onClick={() => openDialog(location)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>Edit location</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PremiumActionButton
                              variant="delete"
                              icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => deleteLocation(location)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      "—"
                    )}
                  </PremiumTableCell>
                </PremiumTableRow>
              ))
            )}
          </PremiumTableBody>
        </PremiumTable>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div>
              Showing {startIndex + 1}-{endIndex} of {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {safePage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editLocation ? "Edit Location" : "Add New Location"}
              </DialogTitle>
            </DialogHeader>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Section 1: Basic Info */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Basic Information
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="site_name">
                      Site Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="site_name"
                      placeholder="e.g. Hodan Data Center"
                      {...register("site_name")}
                    />
                    {errors.site_name && (
                      <div className="text-xs text-destructive">{errors.site_name.message}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={selectedCountry}
                      onValueChange={(value) =>
                        setValue("country", value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id="country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Select
                      value={watch("city")}
                      onValueChange={(value) =>
                        setValue("city", value, { shouldValidate: true })
                      }
                      disabled={!selectedCountry}
                    >
                      <SelectTrigger id="city">
                        <SelectValue placeholder={selectedCountry ? "Select city" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCountry && CITIES[selectedCountry as keyof typeof CITIES]?.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      placeholder="Full site address"
                      rows={2}
                      {...register("address")}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Infrastructure Type */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Infrastructure Type
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_type">Site Type</Label>
                  <Select
                    value={siteType}
                    onValueChange={(value) =>
                      setValue("site_type", value as any, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="site_type">
                      <SelectValue placeholder="Select site type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Data Center">Data Center</SelectItem>
                      <SelectItem value="Edge">Edge</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Outdoor">Outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Section 3: Facility Conditions */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Facility Conditions
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="power_source">Power Source</Label>
                    <Select
                      value={powerSource}
                      onValueChange={(value) =>
                        setValue("power_source", value as any, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id="power_source">
                        <SelectValue placeholder="Select power source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grid">Grid</SelectItem>
                        <SelectItem value="UPS">UPS</SelectItem>
                        <SelectItem value="Generator">Generator</SelectItem>
                        <SelectItem value="Solar">Solar</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cooling_type">Cooling Type</Label>
                    <Select
                      value={coolingType}
                      onValueChange={(value) =>
                        setValue("cooling_type", value as any, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id="cooling_type">
                        <SelectValue placeholder="Select cooling type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HVAC">HVAC</SelectItem>
                        <SelectItem value="Airflow">Airflow</SelectItem>
                        <SelectItem value="Liquid">Liquid</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? editLocation
                      ? "Updating…"
                      : "Creating…"
                    : editLocation
                    ? "Update Location"
                    : "Create Location"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
