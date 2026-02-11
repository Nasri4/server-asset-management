"use client";

import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Eye,
  Globe,
  Lock,
  MoreVertical,
  Network as NetworkIcon,
  Pencil,
  Plus,
  Search,
  Server as ServerIcon,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requiredText } from "@/lib/validation";

import { FadeIn } from "@/components/motion/fade-in";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { ServerSelect } from "@/components/forms/server-select";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

type NetworkRow = {
  network_id: number;
  server_id: number;
  server_code?: string;
  hostname?: string;
  ip_address: string;
  secondary_ip?: string;
  ipv6?: string;
  subnet: string;
  vlan?: string;
  gateway?: string;
  dns_type?: string;
  network_type: string;
  bandwidth?: string;
  firewall_enabled?: boolean;
  nat_enabled?: boolean;
  created_at?: string;
};

const schema = z.object({
  server_id: z.number().int().positive({ message: "Select a server" }),
  ip_address: requiredText("IP address is required"),
  secondary_ip: z.string().optional(),
  ipv6: z.string().optional(),
  subnet: requiredText("Subnet is required"),
  vlan: z.string().optional(),
  gateway: z.string().optional(),
  dns_type: z.string().optional(),
  network_type: requiredText("Network type is required"),
  bandwidth: z.string().optional(),
  firewall_enabled: z.boolean(),
  nat_enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// Network security status helper
function getSecurityStatus(row: NetworkRow): {
  label: string;
  variant: "success" | "warning" | "danger" | "info" | "secondary";
} {
  if (row.firewall_enabled && row.nat_enabled) {
    return { label: "Fully Secured", variant: "success" };
  } else if (row.firewall_enabled) {
    return { label: "Protected", variant: "success" };
  } else if (!row.gateway) {
    return { label: "No Gateway", variant: "warning" };
  } else {
    return { label: "Exposed", variant: "danger" };
  }
}

// Network type badge
function NetworkTypeBadge({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  
  let color = "#10b981"; // emerald
  let icon = NetworkIcon;
  
  if (normalized.includes("public") || normalized.includes("wan")) {
    color = "#3b82f6"; // blue
    icon = Globe;
  } else if (normalized.includes("private") || normalized.includes("lan")) {
    color = "#8b5cf6"; // purple
    icon = Lock;
  } else if (normalized.includes("dmz")) {
    color = "#f59e0b"; // amber
    icon = AlertTriangle;
  }
  
  const IconComponent = icon;
  
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all hover:scale-105"
      style={{ 
        backgroundColor: `${color}15`, 
        color: color,
        border: `1px solid ${color}30`
      }}
    >
      <IconComponent className="h-3 w-3" />
      {type}
    </span>
  );
}

// Network security badge
function SecurityBadge({ firewall, nat }: { firewall?: boolean; nat?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {firewall && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 transition-all hover:bg-emerald-100">
              <ShieldCheck className="h-3 w-3" />
              FW
            </span>
          </TooltipTrigger>
          <TooltipContent>Firewall Enabled</TooltipContent>
        </Tooltip>
      )}
      {nat && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/20 dark:text-sky-400 transition-all hover:bg-sky-100">
              <Wifi className="h-3 w-3" />
              NAT
            </span>
          </TooltipTrigger>
          <TooltipContent>NAT Enabled</TooltipContent>
        </Tooltip>
      )}
      {!firewall && !nat && (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );
}

export default function NetworkPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<NetworkRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Search and filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [networkTypeFilter, setNetworkTypeFilter] = React.useState<string>("all");
  const [firewallFilter, setFirewallFilter] = React.useState<string>("all");
  const [vlanFilter, setVlanFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("server_code");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    server: true,
    primary_ip: true,
    secondary_ip: false,
    ipv6: false,
    subnet: true,
    vlan: true,
    gateway: false,
    dns_type: false,
    network_type: true,
    bandwidth: false,
    security: true,
    status: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  // Dialog states
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<NetworkRow | null>(null);
  const [editNetwork, setEditNetwork] = React.useState<NetworkRow | null>(null);

  const canAssign = can(user, "network.assign_ip");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      server_id: 0,
      ip_address: "",
      secondary_ip: "",
      ipv6: "",
      subnet: "",
      vlan: "",
      gateway: "",
      dns_type: "",
      network_type: "LAN",
      bandwidth: "",
      firewall_enabled: false,
      nat_enabled: false,
    },
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/network", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as NetworkRow[]);
    } catch (error) {
      setRows([]);
      toast.error("Failed to load network configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      try {
        await api.post("/api/network/assign-ip", values);
        toast.success("IP assigned successfully");
        reset();
        await load();
        setAssignOpen(false);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 409) {
          toast.error(e?.response?.data?.error?.message ?? "This IP already exists.");
          return;
        }
        toast.error(e?.response?.data?.error?.message ?? "Failed to assign IP");
      }
    },
    [reset, load]
  );

  const openEdit = React.useCallback((row: NetworkRow) => {
    setEditNetwork(row);
    setValue("server_id", row.server_id);
    setValue("ip_address", row.ip_address);
    setValue("secondary_ip", row.secondary_ip ?? "");
    setValue("ipv6", row.ipv6 ?? "");
    setValue("subnet", row.subnet);
    setValue("vlan", row.vlan ?? "");
    setValue("gateway", row.gateway ?? "");
    setValue("dns_type", row.dns_type ?? "");
    setValue("network_type", row.network_type);
    setValue("bandwidth", row.bandwidth ?? "");
    setValue("firewall_enabled", row.firewall_enabled ?? false);
    setValue("nat_enabled", row.nat_enabled ?? false);
    setEditOpen(true);
  }, [setValue]);

  const submitEdit = React.useCallback(async (values: FormValues) => {
    if (!editNetwork) return;
    try {
      await api.patch(`/api/network/${editNetwork.network_id}`, values);
      toast.success("Network configuration updated");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        toast.error(e?.response?.data?.error?.message ?? "This IP already exists.");
        return;
      }
      toast.error(e?.response?.data?.error?.message ?? "Failed to update network");
    }
  }, [editNetwork, load]);

  const deleteNetwork = React.useCallback(async (row: NetworkRow) => {
    try {
      await api.delete(`/api/network/${row.network_id}`);
      toast.success("Network record deleted");
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? "Failed to delete network record");
    }
  }, [load]);

  const exportCsv = React.useCallback(() => {
    const headers = [
      "Server Code", "Hostname", "Primary IP", "Secondary IP", "IPv6",
      "Subnet", "VLAN", "Gateway", "DNS Type", "Network Type",
      "Bandwidth", "Firewall", "NAT", "Security Status"
    ];
    const data = filteredRows.map((r) => [
      r.server_code ?? "",
      r.hostname ?? "",
      r.ip_address,
      r.secondary_ip ?? "",
      r.ipv6 ?? "",
      r.subnet,
      r.vlan ?? "",
      r.gateway ?? "",
      r.dns_type ?? "",
      r.network_type,
      r.bandwidth ?? "",
      r.firewall_enabled ? "Yes" : "No",
      r.nat_enabled ? "Yes" : "No",
      getSecurityStatus(r).label,
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `network-export-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Exported successfully");
  }, []);

  // Get unique values for filters
  const uniqueNetworkTypes = React.useMemo(() => {
    const types = new Set(rows.map((r) => r.network_type).filter(Boolean));
    return Array.from(types).sort();
  }, [rows]);

  const uniqueVLANs_list = React.useMemo(() => {
    const vlans = new Set(rows.map((r) => r.vlan).filter(Boolean));
    return Array.from(vlans).sort();
  }, [rows]);

  // Filter and search
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.server_code?.toLowerCase().includes(query) ||
          r.hostname?.toLowerCase().includes(query) ||
          r.ip_address?.toLowerCase().includes(query) ||
          r.secondary_ip?.toLowerCase().includes(query) ||
          r.ipv6?.toLowerCase().includes(query) ||
          r.vlan?.toLowerCase().includes(query) ||
          r.network_type?.toLowerCase().includes(query)
      );
    }

    // Network type filter
    if (networkTypeFilter && networkTypeFilter !== "all") {
      result = result.filter((r) => r.network_type === networkTypeFilter);
    }

    // Firewall filter
    if (firewallFilter && firewallFilter !== "all") {
      if (firewallFilter === "enabled") {
        result = result.filter((r) => r.firewall_enabled);
      } else if (firewallFilter === "disabled") {
        result = result.filter((r) => !r.firewall_enabled);
      }
    }

    // VLAN filter
    if (vlanFilter && vlanFilter !== "all") {
      result = result.filter((r) => r.vlan === vlanFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof NetworkRow];
      let bVal: any = b[sortField as keyof NetworkRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    return result;
  }, [rows, searchQuery, networkTypeFilter, firewallFilter, vlanFilter, sortField, sortDirection]);

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
  }, [searchQuery, networkTypeFilter, firewallFilter, vlanFilter]);

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
        {/* Modern Header */}
        <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
          <div className="absolute right-6 top-6 opacity-10">
            <div className="h-24 w-24 rounded-full bg-emerald-500 blur-xl" />
          </div>
          
          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 shadow-md">
                    <NetworkIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Server Network</h1>
                    <p className="mt-1 text-sm text-slate-600">
                      IP configuration, VLAN management, and connectivity monitoring
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canAssign && (
                  <Button 
                    size="sm" 
                    onClick={() => setAssignOpen(true)}
                    className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 shadow-md hover:shadow-lg transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Network
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                  disabled={loading || rows.length === 0}
                  className="border-slate-300 hover:bg-white shadow-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Controls - Clean Design */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50">
                    <Settings className="h-4 w-4 mr-2" />
                    Columns
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-slate-200 shadow-lg">
                  <DropdownMenuLabel className="text-slate-700">Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.server}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, server: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Server
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.primary_ip}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, primary_ip: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Primary IP
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.secondary_ip}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, secondary_ip: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Secondary IP
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.ipv6}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, ipv6: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    IPv6
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.subnet}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, subnet: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Subnet
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.vlan}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, vlan: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    VLAN
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.gateway}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, gateway: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Gateway
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.dns_type}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, dns_type: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    DNS Type
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.network_type}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, network_type: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Network Type
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.bandwidth}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, bandwidth: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Bandwidth
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.security}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, security: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Security
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.status}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, status: checked }))
                    }
                    className="focus:bg-slate-100"
                  >
                    Status
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Search and Filters - Modern Design */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-slate-500" />
                </div>
                <Input
                  placeholder="Search by server, IP, VLAN, or network type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px] justify-between h-10 border-slate-300 hover:bg-slate-50">
                    <span className="text-slate-700">
                      {networkTypeFilter === "all" ? "All Types" : networkTypeFilter}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border-slate-200 shadow-lg">
                  <DropdownMenuItem 
                    onClick={() => setNetworkTypeFilter("all")}
                    className="text-slate-700 focus:bg-slate-100"
                  >
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {uniqueNetworkTypes.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => setNetworkTypeFilter(type!)}
                      className="text-slate-700 focus:bg-slate-100"
                    >
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px] justify-between h-10 border-slate-300 hover:bg-slate-50">
                    <span className="text-slate-700">
                      {firewallFilter === "all" 
                        ? "All Security" 
                        : firewallFilter === "enabled" 
                        ? "Firewall On" 
                        : "Firewall Off"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border-slate-200 shadow-lg">
                  <DropdownMenuItem 
                    onClick={() => setFirewallFilter("all")}
                    className="text-slate-700 focus:bg-slate-100"
                  >
                    All Security
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setFirewallFilter("enabled")}
                    className="text-slate-700 focus:bg-slate-100"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
                    Firewall On
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setFirewallFilter("disabled")}
                    className="text-slate-700 focus:bg-slate-100"
                  >
                    <ShieldAlert className="mr-2 h-4 w-4 text-red-600" />
                    Firewall Off
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {uniqueVLANs_list.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[140px] justify-between h-10 border-slate-300 hover:bg-slate-50">
                      <span className="text-slate-700">
                        {vlanFilter === "all" ? "All VLANs" : `VLAN ${vlanFilter}`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 border-slate-200 shadow-lg">
                    <DropdownMenuItem 
                      onClick={() => setVlanFilter("all")}
                      className="text-slate-700 focus:bg-slate-100"
                    >
                      All VLANs
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {uniqueVLANs_list.map((vlan) => (
                      <DropdownMenuItem
                        key={vlan}
                        onClick={() => setVlanFilter(vlan!)}
                        className="text-slate-700 focus:bg-slate-100"
                      >
                        VLAN {vlan}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Active Filters Display */}
            {(searchQuery || networkTypeFilter !== "all" || firewallFilter !== "all" || vlanFilter !== "all") && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-medium text-slate-500">Active filters:</span>
                {searchQuery && (
                  <Badge variant="outline" className="gap-1.5 border-slate-300 bg-slate-50 text-slate-700">
                    Search: {searchQuery}
                    <button 
                      onClick={() => setSearchQuery("")} 
                      className="hover:text-slate-900 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {networkTypeFilter !== "all" && (
                  <Badge variant="outline" className="gap-1.5 border-slate-300 bg-slate-50 text-slate-700">
                    Type: {networkTypeFilter}
                    <button 
                      onClick={() => setNetworkTypeFilter("all")} 
                      className="hover:text-slate-900 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {firewallFilter !== "all" && (
                  <Badge variant="outline" className="gap-1.5 border-slate-300 bg-slate-50 text-slate-700">
                    Firewall: {firewallFilter}
                    <button 
                      onClick={() => setFirewallFilter("all")} 
                      className="hover:text-slate-900 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {vlanFilter !== "all" && (
                  <Badge variant="outline" className="gap-1.5 border-slate-300 bg-slate-50 text-slate-700">
                    VLAN: {vlanFilter}
                    <button 
                      onClick={() => setVlanFilter("all")} 
                      className="hover:text-slate-900 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setNetworkTypeFilter("all");
                    setFirewallFilter("all");
                    setVlanFilter("all");
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Premium Table - Modern Card Design */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <PremiumTable>
            <PremiumTableHeader className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                {visibleColumns.server && (
                  <PremiumTableHead
                    sortable
                    sortDirection={sortField === "server_code" ? sortDirection : null}
                    onSort={() => toggleSort("server_code")}
                    className="text-slate-700 font-semibold"
                  >
                    Server
                  </PremiumTableHead>
                )}
                {visibleColumns.primary_ip && (
                  <PremiumTableHead
                    sortable
                    sortDirection={sortField === "ip_address" ? sortDirection : null}
                    onSort={() => toggleSort("ip_address")}
                    className="text-slate-700 font-semibold"
                  >
                    Primary IP
                  </PremiumTableHead>
                )}
                {visibleColumns.secondary_ip && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden md:table-cell">
                    Secondary IP
                  </PremiumTableHead>
                )}
                {visibleColumns.ipv6 && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden xl:table-cell">
                    IPv6
                  </PremiumTableHead>
                )}
                {visibleColumns.subnet && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden lg:table-cell">
                    Subnet
                  </PremiumTableHead>
                )}
                {visibleColumns.vlan && (
                  <PremiumTableHead
                    sortable
                    sortDirection={sortField === "vlan" ? sortDirection : null}
                    onSort={() => toggleSort("vlan")}
                    className="text-slate-700 font-semibold"
                  >
                    VLAN
                  </PremiumTableHead>
                )}
                {visibleColumns.gateway && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden xl:table-cell">
                    Gateway
                  </PremiumTableHead>
                )}
                {visibleColumns.dns_type && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden 2xl:table-cell">
                    DNS Type
                  </PremiumTableHead>
                )}
                {visibleColumns.network_type && (
                  <PremiumTableHead className="text-slate-700 font-semibold">
                    Network Type
                  </PremiumTableHead>
                )}
                {visibleColumns.bandwidth && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden lg:table-cell">
                    Bandwidth
                  </PremiumTableHead>
                )}
                {visibleColumns.security && (
                  <PremiumTableHead className="text-slate-700 font-semibold hidden sm:table-cell">
                    Security
                  </PremiumTableHead>
                )}
                {visibleColumns.status && (
                  <PremiumTableHead className="text-slate-700 font-semibold">
                    Status
                  </PremiumTableHead>
                )}
                <PremiumTableHead className="text-slate-700 font-semibold text-center">
                  Actions
                </PremiumTableHead>
              </tr>
            </PremiumTableHeader>
            <PremiumTableBody>
              {loading ? (
                <PremiumTableSkeleton rows={5} cols={8} />
              ) : total > 0 ? (
                <>
                  {pagedRows.map((network) => (
                    <PremiumTableRow 
                      key={network.network_id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {visibleColumns.server && (
                        <PremiumTableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                              <ServerIcon className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">
                                {network.server_code ?? `#${network.server_id}`}
                              </div>
                              {network.hostname && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {network.hostname}
                                </div>
                              )}
                            </div>
                          </div>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.primary_ip && (
                        <PremiumTableCell>
                          <span className="font-mono font-medium bg-slate-50 px-2 py-1 rounded text-sm">
                            {network.ip_address}
                          </span>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.secondary_ip && (
                        <PremiumTableCell className="hidden md:table-cell">
                          <span className="font-mono text-sm text-slate-500">
                            {network.secondary_ip || "—"}
                          </span>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.ipv6 && (
                        <PremiumTableCell className="hidden xl:table-cell">
                          <span className="font-mono text-sm text-slate-500">
                            {network.ipv6 || "—"}
                          </span>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.subnet && (
                        <PremiumTableCell className="hidden lg:table-cell">
                          <span className="font-mono text-sm bg-slate-50 px-2 py-1 rounded">
                            {network.subnet}
                          </span>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.vlan && (
                        <PremiumTableCell>
                          {network.vlan ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-mono">
                              {network.vlan}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </PremiumTableCell>
                      )}
                      {visibleColumns.gateway && (
                        <PremiumTableCell className="hidden xl:table-cell">
                          <span className="font-mono text-sm text-slate-500">
                            {network.gateway || "—"}
                          </span>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.dns_type && (
                        <PremiumTableCell className="hidden 2xl:table-cell">
                          {network.dns_type || "—"}
                        </PremiumTableCell>
                      )}
                      {visibleColumns.network_type && (
                        <PremiumTableCell>
                          <NetworkTypeBadge type={network.network_type} />
                        </PremiumTableCell>
                      )}
                      {visibleColumns.bandwidth && (
                        <PremiumTableCell className="hidden lg:table-cell">
                          {network.bandwidth ? (
                            <span className="text-sm text-slate-700">
                              {network.bandwidth}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </PremiumTableCell>
                      )}
                      {visibleColumns.security && (
                        <PremiumTableCell className="hidden sm:table-cell">
                          <SecurityBadge firewall={network.firewall_enabled} nat={network.nat_enabled} />
                        </PremiumTableCell>
                      )}
                      {visibleColumns.status && (
                        <PremiumTableCell>
                          <PremiumStatusBadge variant={getSecurityStatus(network).variant}>
                            {getSecurityStatus(network).label}
                          </PremiumStatusBadge>
                        </PremiumTableCell>
                      )}
                      <PremiumTableCell>
                        {canAssign ? (
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PremiumActionButton
                                  variant="edit"
                                  icon={<Pencil className="h-4 w-4" />}
                                  onClick={() => openEdit(network)}
                                  className="hover:bg-slate-100 text-slate-600 hover:text-slate-700"
                                />
                              </TooltipTrigger>
                              <TooltipContent>Edit network configuration</TooltipContent>
                            </Tooltip>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <PremiumActionButton
                                  variant="default"
                                  icon={<MoreVertical className="h-4 w-4" />}
                                  className="hover:bg-slate-100 text-slate-600 hover:text-slate-700"
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 border-slate-200 shadow-lg">
                                <DropdownMenuLabel className="text-slate-700">Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openEdit(network)}
                                  className="text-slate-700 focus:bg-slate-100"
                                >
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeleteTarget(network)}
                                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    </PremiumTableRow>
                  ))}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <tr>
                      <td colSpan={100} className="border-t border-slate-200 px-6 py-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-sm text-slate-600">
                            Showing <span className="font-semibold">{startIndex + 1}-{endIndex}</span> of <span className="font-semibold">{total}</span> configurations
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              disabled={safePage === 1}
                              className="border-slate-300 hover:bg-slate-50"
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={safePage === pageNum ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPage(pageNum)}
                                    className={`min-w-[2rem] h-8 px-2 ${safePage === pageNum ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-300 hover:bg-slate-50'}`}
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              })}
                              {totalPages > 5 && (
                                <span className="text-slate-500 mx-1">...</span>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                              disabled={safePage === totalPages}
                              className="border-slate-300 hover:bg-slate-50"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <PremiumTableEmptyState
                  icon={
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
                      <NetworkIcon className="h-8 w-8 text-emerald-500" />
                    </div>
                  }
                  title="No network configurations found"
                  description={
                    searchQuery || networkTypeFilter !== "all" || firewallFilter !== "all" || vlanFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "Assign network configuration to servers to see them listed here"
                  }
                  action={
                    canAssign &&
                    !searchQuery &&
                    networkTypeFilter === "all" &&
                    firewallFilter === "all" &&
                    vlanFilter === "all" ? (
                      <Button 
                        onClick={() => setAssignOpen(true)} 
                        size="sm"
                        className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Assign First Network
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </PremiumTableBody>
          </PremiumTable>
        </div>

        {/* Assign Network Dialog - Modern Design */}
        {canAssign && (
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border border-slate-300 shadow-2xl max-h-[90vh] flex flex-col">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-green-500" />
              
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center">
                        <Plus className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                          Assign Network Configuration
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                          Assign IP addresses and network settings to a server
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
                    {/* Server Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ServerIcon className="h-4 w-4 text-emerald-600" />
                        <Label className="text-sm font-semibold text-slate-700">
                          Server Selection <span className="text-red-500">*</span>
                        </Label>
                      </div>
                      <ServerSelect
                        value={watch("server_id")}
                        onChange={(id) => setValue("server_id", id, { shouldValidate: true })}
                        showSearch={false}
                      />
                      {errors.server_id && (
                        <p className="text-xs text-red-600 mt-1">{errors.server_id.message}</p>
                      )}
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                    {/* IP Configuration */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-emerald-600" />
                        <Label className="text-sm font-semibold text-slate-700">IP Configuration</Label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="ip_address" className="text-slate-700">
                            Primary IP <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="ip_address"
                            placeholder="e.g. 10.10.0.15"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("ip_address")}
                          />
                          {errors.ip_address && (
                            <p className="text-xs text-red-600">{errors.ip_address.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="secondary_ip" className="text-slate-700">Secondary IP</Label>
                          <Input
                            id="secondary_ip"
                            placeholder="e.g. 10.10.0.16"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("secondary_ip")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ipv6" className="text-slate-700">IPv6</Label>
                          <Input
                            id="ipv6"
                            placeholder="e.g. 2001:db8::1"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("ipv6")}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                    {/* Network Details */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <NetworkIcon className="h-4 w-4 text-emerald-600" />
                        <Label className="text-sm font-semibold text-slate-700">Network Details</Label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor="subnet" className="text-slate-700">
                            Subnet <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="subnet"
                            placeholder="e.g. 255.255.255.0"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("subnet")}
                          />
                          {errors.subnet && (
                            <p className="text-xs text-red-600">{errors.subnet.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vlan" className="text-slate-700">VLAN</Label>
                          <Input
                            id="vlan"
                            placeholder="e.g. 100"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("vlan")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gateway" className="text-slate-700">Gateway</Label>
                          <Input
                            id="gateway"
                            placeholder="e.g. 10.10.0.1"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("gateway")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dns_type" className="text-slate-700">DNS Type</Label>
                          <select
                            id="dns_type"
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("dns_type")}
                          >
                            <option value="">Select DNS...</option>
                            <option value="Primary">Primary</option>
                            <option value="Secondary">Secondary</option>
                            <option value="Forwarder">Forwarder</option>
                            <option value="Recursive">Recursive</option>
                            <option value="Authoritative">Authoritative</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                    {/* Configuration */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-emerald-600" />
                        <Label className="text-sm font-semibold text-slate-700">Configuration</Label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="network_type" className="text-slate-700">
                            Network Type <span className="text-red-500">*</span>
                          </Label>
                          <select
                            id="network_type"
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("network_type")}
                          >
                            <option value="">Select network type...</option>
                            <option value="LAN">LAN (Local Area Network)</option>
                            <option value="WAN">WAN (Wide Area Network)</option>
                            <option value="Public">Public Network</option>
                            <option value="Private">Private Network</option>
                            <option value="DMZ">DMZ (Demilitarized Zone)</option>
                            <option value="VPN">VPN (Virtual Private Network)</option>
                            <option value="Internet">Internet</option>
                            <option value="Intranet">Intranet</option>
                          </select>
                          {errors.network_type && (
                            <p className="text-xs text-red-600">{errors.network_type.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bandwidth" className="text-slate-700">Bandwidth</Label>
                          <Input
                            id="bandwidth"
                            placeholder="e.g. 1Gbps/10Gbps"
                            className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            {...register("bandwidth")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Security Features</Label>
                          <div className="flex gap-6 pt-2">
                            <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                              <div className="relative">
                                <input 
                                  type="checkbox" 
                                  {...register("firewall_enabled")} 
                                  className="sr-only peer"
                                />
                                <div className="h-5 w-5 rounded border border-slate-300 bg-white peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover:border-emerald-400" />
                                <svg 
                                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className="text-slate-700 group-hover:text-slate-900">Firewall</span>
                            </label>
                            <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                              <div className="relative">
                                <input 
                                  type="checkbox" 
                                  {...register("nat_enabled")} 
                                  className="sr-only peer"
                                />
                                <div className="h-5 w-5 rounded border border-slate-300 bg-white peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover:border-emerald-400" />
                                <svg 
                                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className="text-slate-700 group-hover:text-slate-900">NAT</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAssignOpen(false)}
                        disabled={isSubmitting}
                        className="border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 shadow-md"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Assigning...
                          </span>
                        ) : "Assign Network"}
                      </Button>
                    </DialogFooter>
                  </form>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Network Dialog - Modern Design */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border border-slate-300 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-green-500" />
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center">
                      <Pencil className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-slate-900">
                        Edit Network Configuration
                      </DialogTitle>
                      <DialogDescription className="text-slate-500">
                        Update network settings for {editNetwork?.server_code}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <form onSubmit={handleSubmit(submitEdit)} className="space-y-6 mt-6">
                  {/* Server Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ServerIcon className="h-4 w-4 text-emerald-600" />
                      <Label className="text-sm font-semibold text-slate-700">Server</Label>
                    </div>
                    <ServerSelect
                      value={watch("server_id")}
                      onChange={(id) => setValue("server_id", id, { shouldValidate: true })}
                      showSearch={false}
                    />
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                  {/* IP Configuration */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-emerald-600" />
                      <Label className="text-sm font-semibold text-slate-700">IP Configuration</Label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit_ip_address" className="text-slate-700">Primary IP</Label>
                        <Input
                          id="edit_ip_address"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("ip_address")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_secondary_ip" className="text-slate-700">Secondary IP</Label>
                        <Input
                          id="edit_secondary_ip"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("secondary_ip")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_ipv6" className="text-slate-700">IPv6</Label>
                        <Input
                          id="edit_ipv6"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("ipv6")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                  {/* Network Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <NetworkIcon className="h-4 w-4 text-emerald-600" />
                      <Label className="text-sm font-semibold text-slate-700">Network Details</Label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_subnet" className="text-slate-700">Subnet</Label>
                        <Input
                          id="edit_subnet"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("subnet")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_vlan" className="text-slate-700">VLAN</Label>
                        <Input
                          id="edit_vlan"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("vlan")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_gateway" className="text-slate-700">Gateway</Label>
                        <Input
                          id="edit_gateway"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("gateway")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_dns_type" className="text-slate-700">DNS Type</Label>
                        <select
                          id="edit_dns_type"
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("dns_type")}
                        >
                          <option value="">Select DNS...</option>
                          <option value="Primary">Primary</option>
                          <option value="Secondary">Secondary</option>
                          <option value="Forwarder">Forwarder</option>
                          <option value="Recursive">Recursive</option>
                          <option value="Authoritative">Authoritative</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                  {/* Configuration */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-emerald-600" />
                      <Label className="text-sm font-semibold text-slate-700">Configuration</Label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit_network_type" className="text-slate-700">Network Type</Label>
                        <select
                          id="edit_network_type"
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("network_type")}
                        >
                          <option value="">Select network type...</option>
                          <option value="LAN">LAN (Local Area Network)</option>
                          <option value="WAN">WAN (Wide Area Network)</option>
                          <option value="Public">Public Network</option>
                          <option value="Private">Private Network</option>
                          <option value="DMZ">DMZ (Demilitarized Zone)</option>
                          <option value="VPN">VPN (Virtual Private Network)</option>
                          <option value="Internet">Internet</option>
                          <option value="Intranet">Intranet</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_bandwidth" className="text-slate-700">Bandwidth</Label>
                        <Input
                          id="edit_bandwidth"
                          className="h-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                          {...register("bandwidth")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700">Security Features</Label>
                        <div className="flex gap-6 pt-2">
                          <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                            <div className="relative">
                              <input 
                                type="checkbox" 
                                {...register("firewall_enabled")} 
                                className="sr-only peer"
                              />
                              <div className="h-5 w-5 rounded border border-slate-300 bg-white peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover:border-emerald-400" />
                              <svg 
                                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-slate-700 group-hover:text-slate-900">Firewall</span>
                          </label>
                          <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                            <div className="relative">
                              <input 
                                type="checkbox" 
                                {...register("nat_enabled")} 
                                className="sr-only peer"
                              />
                              <div className="h-5 w-5 rounded border border-slate-300 bg-white peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover:border-emerald-400" />
                              <svg 
                                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-slate-700 group-hover:text-slate-900">NAT</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditOpen(false)}
                      disabled={isSubmitting}
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 shadow-md"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Updating...
                        </span>
                      ) : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog - Modern Design */}
        <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-slate-300 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-rose-500" />
            
            <div className="p-6">
              <DialogHeader>
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center mb-3">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    Delete Network Configuration
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 mt-2">
                    Are you sure you want to delete the network configuration for{" "}
                    <span className="font-semibold font-mono">
                      {deleteTarget?.ip_address}
                    </span>
                    {" "}({deleteTarget?.server_code ?? `#${deleteTarget?.server_id}`})? This action cannot be undone.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Warning</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Deleting this configuration may affect server connectivity and related services.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteTarget) deleteNetwork(deleteTarget);
                  }}
                  className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Configuration
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}