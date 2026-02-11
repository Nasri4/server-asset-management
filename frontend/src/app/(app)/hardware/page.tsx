"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  MoreVertical,
  Pencil,
  Search,
  Settings,
  Trash2,
  X,
  Plus,
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Shield,
  AlertTriangle,
  Calendar,
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
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { ServerSelect } from "@/components/forms/server-select";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

const CPU_CORE_OPTIONS = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];
const RAID_LEVELS = ["RAID 0", "RAID 1", "RAID 5", "RAID 6", "RAID 10", "RAID 50", "RAID 60", "No RAID"];
const NIC_COUNT_OPTIONS = [1, 2, 4, 6, 8];

const selectClassName =
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type HardwareRow = {
  server_id: number;
  server_code?: string;
  hostname?: string;
  vendor?: string;
  model?: string;
  serial_number?: string;
  cpu_model?: string;
  cpu_cores?: number;
  ram_gb?: number;
  storage_tb?: number;
  raid_level?: string;
  nic_count?: number;
  power_supply?: string;
  warranty_expiry?: string; // ISO date string
};

const schema = z.object({
  server_id: z.number().int().positive({ message: "Select a server" }),
  vendor: requiredText("Vendor is required"),
  model: requiredText("Model is required"),
  serial_number: requiredText("Serial number is required"),
  cpu_model: requiredText("CPU model is required"),
  cpu_cores: z.number().int().min(1, "CPU cores is required"),
  ram_gb: z.number().int().min(1, "RAM is required"),
  storage_tb: z.number().positive("Storage is required"),
  raid_level: z.string().optional(),
  nic_count: z.number().int().positive().optional(),
  power_supply: z.string().optional(),
  warranty_expiry: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Status badge helper - Map to PremiumStatusBadge variants
function getHardwareStatusVariant(warranty_expiry?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!warranty_expiry) {
    return "secondary";
  }

  const expiryDate = new Date(warranty_expiry);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return "danger";
  } else if (daysUntilExpiry <= 30) {
    return "warning";
  } else if (daysUntilExpiry <= 90) {
    return "warning";
  } else {
    return "success";
  }
}

function getHardwareStatusLabel(warranty_expiry?: string): string {
  if (!warranty_expiry) {
    return "Unknown";
  }

  const expiryDate = new Date(warranty_expiry);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return "Expired";
  } else if (daysUntilExpiry <= 30) {
    return "Expiring Soon";
  } else if (daysUntilExpiry <= 90) {
    return "Warning";
  } else {
    return "Healthy";
  }
}

// AWS-style Right Slide Panel Component - Updated with light green
function RightSlidePanel({
  isOpen,
  onClose,
  hardware,
}: {
  isOpen: boolean;
  onClose: () => void;
  hardware: HardwareRow | null;
}) {
  const canUpsert = can(useAuth().user, "hardware.upsert");
  const [activeTab, setActiveTab] = React.useState("overview");

  if (!hardware) return null;

  const tabs = [
    { id: "overview", label: "Overview", icon: Cpu },
    { id: "specifications", label: "Specifications", icon: Server },
    { id: "warranty", label: "Warranty", icon: Shield },
  ];

  return (
    <>
      {/* Backdrop - Blur removed */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <Server className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {hardware.server_code ?? `Server #${hardware.server_id}`}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {hardware.hostname || "Hardware Configuration"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6">
            <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-800">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                      activeTab === tab.id
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel Content */}
        <div className="h-[calc(100vh-140px)] overflow-y-auto">
          <div className="p-6">
            {/* Status Banner */}
            <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PremiumStatusBadge variant={getHardwareStatusVariant(hardware.warranty_expiry)}>
                    {getHardwareStatusLabel(hardware.warranty_expiry)}
                  </PremiumStatusBadge>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Last updated: {new Date().toLocaleDateString()}
                  </span>
                </div>
                {canUpsert && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Server Details */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Server Details</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Server Code</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.server_code || "—"}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Hostname</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.hostname || "—"}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Vendor</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.vendor || "—"}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Model</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.model || "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Hardware Summary */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hardware Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <Cpu className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {hardware.cpu_cores || 0} Cores
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <MemoryStick className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {hardware.ram_gb || 0} GB
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">RAM</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <HardDrive className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {hardware.storage_tb || 0} TB
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Storage</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {hardware.nic_count || 0} NICs
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Network</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "specifications" && (
              <div className="space-y-6">
                {/* Processor */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Cpu className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Processor</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">CPU Model</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.cpu_model || "—"}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">CPU Cores</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.cpu_cores || 0} cores</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Memory */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <MemoryStick className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Memory</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">RAM</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.ram_gb || 0} GB</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Storage */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <HardDrive className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Storage</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Storage Capacity</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.storage_tb || 0} TB</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">RAID Level</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.raid_level || "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Networking */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Networking</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">NIC Count</span>
                        <span className="font-medium text-gray-900 dark:text-white">{hardware.nic_count || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "warranty" && (
              <div className="space-y-6">
                {/* Warranty Information */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Warranty Information</h3>
                    </div>
                    <div className="space-y-3">
                      {hardware.warranty_expiry ? (
                        <>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                            <PremiumStatusBadge variant={getHardwareStatusVariant(hardware.warranty_expiry)}>
                              {getHardwareStatusLabel(hardware.warranty_expiry)}
                            </PremiumStatusBadge>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Expiry Date</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {new Date(hardware.warranty_expiry).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-gray-400">No warranty information available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Serial Number */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Serial Information</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Serial Number</span>
                        <span className="font-mono font-medium text-gray-900 dark:text-white">{hardware.serial_number || "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Panel Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Server ID: {hardware.server_id}
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="border-gray-300 dark:border-gray-700"
              >
                Close
              </Button>
              {canUpsert && (
                <Button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Configuration
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function HardwarePage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<HardwareRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Search and filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("server_code");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    server: true,
    vendor: true,
    model: true,
    cpu: true,
    cores: true,
    ram: true,
    storage: true,
    warranty: true,
    status: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  // Create dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editServerId, setEditServerId] = React.useState<number>(0);
  const [editVendor, setEditVendor] = React.useState("");
  const [editModel, setEditModel] = React.useState("");
  const [editSerial, setEditSerial] = React.useState("");
  const [editCpuModel, setEditCpuModel] = React.useState("");
  const [editCpuCores, setEditCpuCores] = React.useState<number>(1);
  const [editRamGb, setEditRamGb] = React.useState<number>(1);
  const [editStorageTb, setEditStorageTb] = React.useState<number>(0);
  const [editRaidLevel, setEditRaidLevel] = React.useState<string>("");
  const [editNicCount, setEditNicCount] = React.useState<number>(1);
  const [editPowerSupply, setEditPowerSupply] = React.useState<string>("");
  const [editWarrantyExpiry, setEditWarrantyExpiry] = React.useState<string>("");

  // View panel state
  const [viewOpen, setViewOpen] = React.useState(false);
  const [selectedHardware, setSelectedHardware] = React.useState<HardwareRow | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<HardwareRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const canUpsert = can(user, "hardware.upsert");

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
      vendor: "",
      model: "",
      serial_number: "",
      cpu_model: "",
      cpu_cores: 4,
      ram_gb: 16,
      storage_tb: 1,
      raid_level: "",
      nic_count: 2,
      power_supply: "",
      warranty_expiry: "",
    },
  });

  const serverId = watch("server_id");
  const selectedHasHardware = React.useMemo(() => {
    if (!serverId) return false;
    return rows.some((r) => r.server_id === serverId);
  }, [serverId, rows]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/hardware", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as HardwareRow[]);
    } catch (error) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = React.useCallback(
    async (data: FormValues) => {
      try {
        setCreateLoading(true);
        await api.post("/api/hardware", data);
        toast.success("Hardware record created");
        reset();
        setCreateOpen(false);
        await load();
      } catch (e: any) {
        toast.error(e?.response?.data?.error?.message ?? "Failed to create hardware record");
      } finally {
        setCreateLoading(false);
      }
    },
    [reset, load]
  );

  const openEdit = React.useCallback((row: HardwareRow) => {
    setEditServerId(row.server_id);
    setEditVendor(row.vendor ?? "");
    setEditModel(row.model ?? "");
    setEditSerial(row.serial_number ?? "");
    setEditCpuModel(row.cpu_model ?? "");
    setEditCpuCores(row.cpu_cores ?? 1);
    setEditRamGb(row.ram_gb ?? 1);
    setEditStorageTb(row.storage_tb ?? 0);
    setEditRaidLevel(row.raid_level ?? "");
    setEditNicCount(row.nic_count ?? 1);
    setEditPowerSupply(row.power_supply ?? "");
    setEditWarrantyExpiry(row.warranty_expiry ? row.warranty_expiry.split("T")[0] : "");
    setEditOpen(true);
  }, []);

  const openView = React.useCallback((row: HardwareRow) => {
    setSelectedHardware(row);
    setViewOpen(true);
  }, []);

  const submitEdit = React.useCallback(async () => {
    if (!editServerId) return;
    try {
      setEditSaving(true);
      await api.patch(`/api/hardware/server/${editServerId}`, {
        vendor: editVendor,
        model: editModel,
        serial_number: editSerial,
        cpu_model: editCpuModel,
        cpu_cores: editCpuCores,
        ram_gb: editRamGb,
        storage_tb: editStorageTb,
        raid_level: editRaidLevel || null,
        nic_count: editNicCount || null,
        power_supply: editPowerSupply || null,
        warranty_expiry: editWarrantyExpiry || null,
      });
      toast.success("Hardware record updated");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? "Failed to update hardware record");
    } finally {
      setEditSaving(false);
    }
  }, [editServerId, editVendor, editModel, editSerial, editCpuModel, editCpuCores, editRamGb, editStorageTb, editRaidLevel, editNicCount, editPowerSupply, editWarrantyExpiry, load]);

  const deleteHardware = React.useCallback(async (row: HardwareRow) => {
    if (!row) return;
    try {
      setDeleting(true);
      await api.delete(`/api/hardware/server/${row.server_id}`);
      toast.success("Hardware record deleted");
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? "Failed to delete hardware record");
    } finally {
      setDeleting(false);
    }
  }, [load]);

  // Get unique vendors
  const uniqueVendors = React.useMemo(() => {
    const vendors = new Set(rows.map((r) => r.vendor).filter(Boolean));
    return Array.from(vendors).sort();
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
          r.vendor?.toLowerCase().includes(query) ||
          r.model?.toLowerCase().includes(query) ||
          r.cpu_model?.toLowerCase().includes(query) ||
          r.serial_number?.toLowerCase().includes(query)
      );
    }

    // Vendor filter
    if (vendorFilter && vendorFilter !== "all") {
      result = result.filter((r) => r.vendor === vendorFilter);
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((r) => {
        const statusLabel = getHardwareStatusLabel(r.warranty_expiry);
        return statusLabel.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof HardwareRow];
      let bVal: any = b[sortField as keyof HardwareRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, searchQuery, vendorFilter, statusFilter, sortField, sortDirection]);

  // Export CSV function
  const exportCsv = React.useCallback(() => {
    const headers = [
      "Server Code", "Hostname", "Vendor", "Model", "Serial", "CPU Model", "Cores", 
      "RAM (GB)", "Storage (TB)", "RAID Level", "NIC Count", "Power Supply", "Warranty Expiry", "Status"
    ];
    const data = filteredRows.map((r) => [
      r.server_code ?? "",
      r.hostname ?? "",
      r.vendor ?? "",
      r.model ?? "",
      r.serial_number ?? "",
      r.cpu_model ?? "",
      String(r.cpu_cores ?? ""),
      String(r.ram_gb ?? ""),
      String(r.storage_tb ?? ""),
      r.raid_level ?? "",
      String(r.nic_count ?? ""),
      r.power_supply ?? "",
      r.warranty_expiry ?? "",
      getHardwareStatusLabel(r.warranty_expiry),
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `hardware-export-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Exported successfully");
  }, [filteredRows]);

  // Calculate metrics
  const totalServers = rows.length;
  const totalRam = rows.reduce((sum, r) => sum + (r.ram_gb || 0), 0);
  const avgRam = totalServers > 0 ? Math.round(totalRam / totalServers) : 0;
  const totalStorage = rows.reduce((sum, r) => sum + (r.storage_tb || 0), 0);
  const highCpuCount = rows.filter((r) => (r.cpu_cores || 0) >= 32).length;
  
  // Warranty expiring soon (within 90 days)
  const warrantyExpiringSoon = rows.filter((r) => {
    if (!r.warranty_expiry) return false;
    const expiryDate = new Date(r.warranty_expiry);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
  }).length;

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
  }, [searchQuery, vendorFilter, statusFilter]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <FadeIn>
        {/* Simplified Header - Similar to the image */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <Server className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Server Hardware</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Infrastructure Management</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportCsv} 
                  disabled={loading || rows.length === 0}
                  className="border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                {canUpsert && (
                  <Button 
                    size="sm" 
                    onClick={() => setCreateOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Hardware
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-7xl mx-auto">
          {/* Search Bar - Simplified like the image */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by server code, hostname, vendor, model, or CPU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 w-full border-gray-300 dark:border-gray-700 focus:border-green-500 focus:ring-green-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400">
                      <Settings className="h-4 w-4" />
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.server}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, server: checked }))
                      }
                    >
                      Server
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.vendor}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, vendor: checked }))
                      }
                    >
                      Vendor
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.model}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, model: checked }))
                      }
                    >
                      Model
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.cpu}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, cpu: checked }))
                      }
                    >
                      CPU Model
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.cores}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, cores: checked }))
                      }
                    >
                      CPU Cores
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.ram}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, ram: checked }))
                      }
                    >
                      RAM
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.storage}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, storage: checked }))
                      }
                    >
                      Storage
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.warranty}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, warranty: checked }))
                      }
                    >
                      Warranty
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.status}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, status: checked }))
                      }
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-35 justify-between border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400">
                      <span>
                        {vendorFilter === "all"
                          ? "All Vendors"
                          : vendorFilter}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setVendorFilter("all")}>
                      All Vendors
                    </DropdownMenuItem>
                    {uniqueVendors.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        {uniqueVendors.map((vendor) => (
                          <DropdownMenuItem
                            key={vendor}
                            onClick={() => setVendorFilter(vendor!)}
                          >
                            {vendor}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Table - Clean design similar to the image */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <PremiumTable>
              <PremiumTableHeader className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.server && (
                    <PremiumTableHead className="min-w-30">
                      SERVER
                    </PremiumTableHead>
                  )}
                  {visibleColumns.vendor && (
                    <PremiumTableHead className="min-w-25">
                      VENDOR
                    </PremiumTableHead>
                  )}
                  {visibleColumns.model && (
                    <PremiumTableHead className="min-w-30">
                      MODEL
                    </PremiumTableHead>
                  )}
                  {visibleColumns.cpu && (
                    <PremiumTableHead className="min-w-37.5 hidden lg:table-cell">
                      CPU MODEL
                    </PremiumTableHead>
                  )}
                  {visibleColumns.cores && (
                    <PremiumTableHead className="min-w-20">
                      CORES
                    </PremiumTableHead>
                  )}
                  {visibleColumns.ram && (
                    <PremiumTableHead className="min-w-20">
                      RAM
                    </PremiumTableHead>
                  )}
                  {visibleColumns.storage && (
                    <PremiumTableHead className="min-w-20 hidden sm:table-cell">
                      STORAGE
                    </PremiumTableHead>
                  )}
                  {visibleColumns.warranty && (
                    <PremiumTableHead className="min-w-25 hidden lg:table-cell">
                      WARRANTY
                    </PremiumTableHead>
                  )}
                  {visibleColumns.status && (
                    <PremiumTableHead className="min-w-25">
                      STATUS
                    </PremiumTableHead>
                  )}
                  <PremiumTableHead className="w-30 text-center">ACTIONS</PremiumTableHead>
                </tr>
              </PremiumTableHeader>
              <PremiumTableBody>
                {loading ? (
                  <PremiumTableSkeleton rows={5} cols={Object.values(visibleColumns).filter(Boolean).length + 1} />
                ) : total > 0 ? (
                  <>
                    {pagedRows.map((hardware) => (
                      <PremiumTableRow 
                        key={hardware.server_id}
                        onClick={() => openView(hardware)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        {visibleColumns.server && (
                          <PremiumTableCell>
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {hardware.server_code ?? `#${hardware.server_id}`}
                              </div>
                              {hardware.hostname && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {hardware.hostname}
                                </div>
                              )}
                            </div>
                          </PremiumTableCell>
                        )}
                        {visibleColumns.vendor && (
                          <PremiumTableCell>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {hardware.vendor || "—"}
                            </div>
                          </PremiumTableCell>
                        )}
                        {visibleColumns.model && (
                          <PremiumTableCell>
                            {hardware.model || "—"}
                          </PremiumTableCell>
                        )}
                        {visibleColumns.cpu && (
                          <PremiumTableCell className="hidden lg:table-cell">
                            {hardware.cpu_model || "—"}
                          </PremiumTableCell>
                        )}
                        {visibleColumns.cores && (
                          <PremiumTableCell>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {hardware.cpu_cores || 0}
                            </div>
                          </PremiumTableCell>
                        )}
                        {visibleColumns.ram && (
                          <PremiumTableCell>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {hardware.ram_gb || 0} GB
                            </div>
                          </PremiumTableCell>
                        )}
                        {visibleColumns.storage && (
                          <PremiumTableCell className="hidden sm:table-cell">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {hardware.storage_tb || 0} TB
                            </div>
                          </PremiumTableCell>
                        )}
                        {visibleColumns.warranty && (
                          <PremiumTableCell className="hidden lg:table-cell">
                            <div className="text-gray-500 dark:text-gray-400">
                              {hardware.warranty_expiry 
                                ? new Date(hardware.warranty_expiry).toLocaleDateString()
                                : "—"}
                            </div>
                          </PremiumTableCell>
                        )}
                        {visibleColumns.status && (
                          <PremiumTableCell>
                            <PremiumStatusBadge variant={getHardwareStatusVariant(hardware.warranty_expiry)}>
                              {getHardwareStatusLabel(hardware.warranty_expiry)}
                            </PremiumStatusBadge>
                          </PremiumTableCell>
                        )}
                        <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                          {canUpsert ? (
                            <div className="flex items-center justify-center gap-1">
                              <PremiumActionButton
                                variant="edit"
                                icon={<Pencil className="h-4 w-4" />}
                                onClick={() => openEdit(hardware)}
                                tooltip="Edit hardware"
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <PremiumActionButton
                                    variant="default"
                                    icon={<MoreVertical className="h-4 w-4" />}
                                  />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => openView(hardware)}>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(hardware)}>
                                    Edit Configuration
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(hardware)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openView(hardware)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              View
                            </Button>
                          )}
                        </PremiumTableCell>
                      </PremiumTableRow>
                    ))}
                  </>
                ) : (
                  <PremiumTableEmptyState
                    icon={<Server className="h-12 w-12 text-gray-400" />}
                    title="No hardware configurations found"
                    description={
                      searchQuery || vendorFilter !== "all" || statusFilter !== "all"
                        ? "Try adjusting your search or filters"
                        : canUpsert
                        ? "Click 'Add Hardware' to create your first hardware configuration"
                        : "No hardware configurations available"
                    }
                    action={
                      canUpsert && !searchQuery && vendorFilter === "all" && statusFilter === "all"
                        ? (
                            <Button 
                              size="sm" 
                              onClick={() => setCreateOpen(true)}
                              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Hardware
                            </Button>
                          )
                        : undefined
                    }
                  />
                )}
              </PremiumTableBody>
            </PremiumTable>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex flex-col gap-4 p-4 border-t border-gray-200 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {total ? startIndex + 1 : 0} to {endIndex} of {total}{" "}
                  {total === 1 ? "configuration" : "configurations"}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400"
                  >
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                      let p = idx + 1;
                      if (totalPages > 5) {
                        if (idx === 0) p = 1;
                        else if (idx === 1 && safePage > 3) p = safePage - 1;
                        else if (idx === 1) p = 2;
                        else if (idx === 2) p = safePage > 3 ? safePage : 3;
                        else if (idx === 3 && safePage < totalPages - 2) p = safePage + 1;
                        else if (idx === 3) p = totalPages - 1;
                        else p = totalPages;
                      }

                      const active = p === safePage;
                      return (
                        <Button
                          key={idx}
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(p)}
                          className={active ? "bg-green-600 hover:bg-green-700" : "border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400"}
                        >
                          {p}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="border-gray-300 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Slide Panel for View Details */}
          <RightSlidePanel
            isOpen={viewOpen}
            onClose={() => setViewOpen(false)}
            hardware={selectedHardware}
          />

          {/* Create Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Hardware Configuration</DialogTitle>
                <DialogDescription>
                  Add hardware specifications for a server. All fields marked with * are required.
                </DialogDescription>
              </DialogHeader>

              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <ServerSelect
                    value={serverId}
                    onChange={(id) => setValue("server_id", id, { shouldValidate: true })}
                    showSearch={false}
                  />
                  <input type="hidden" {...register("server_id", { valueAsNumber: true })} />
                  {errors.server_id && (
                    <div className="text-xs text-destructive mt-1">{errors.server_id.message}</div>
                  )}
                  {selectedHasHardware && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 p-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900 dark:text-amber-200">
                          This server already has hardware configuration. Use the Edit action in the table to update it.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendor <span className="text-destructive">*</span></Label>
                      <Input id="vendor" placeholder="e.g. Dell, HP, Lenovo" {...register("vendor")} />
                      {errors.vendor && <div className="text-xs text-destructive">{errors.vendor.message}</div>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model <span className="text-destructive">*</span></Label>
                      <Input id="model" placeholder="e.g. PowerEdge R740" {...register("model")} />
                      {errors.model && <div className="text-xs text-destructive">{errors.model.message}</div>}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="serial_number">Serial Number <span className="text-destructive">*</span></Label>
                      <Input id="serial_number" placeholder="e.g. ABC123XYZ" {...register("serial_number")} />
                      {errors.serial_number && <div className="text-xs text-destructive">{errors.serial_number.message}</div>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                      <Input id="warranty_expiry" type="date" {...register("warranty_expiry")} />
                    </div>
                  </div>
                </div>

                {/* CPU & Memory */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">CPU & Memory</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cpu_model">CPU Model <span className="text-destructive">*</span></Label>
                      <Input id="cpu_model" placeholder="e.g. Intel Xeon Silver 4214" {...register("cpu_model")} />
                      {errors.cpu_model && <div className="text-xs text-destructive">{errors.cpu_model.message}</div>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpu_cores">CPU Cores <span className="text-destructive">*</span></Label>
                      <select id="cpu_cores" className={selectClassName} {...register("cpu_cores", { valueAsNumber: true })}>
                        {CPU_CORE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} cores
                          </option>
                        ))}
                      </select>
                      {errors.cpu_cores && <div className="text-xs text-destructive">{errors.cpu_cores.message}</div>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ram_gb">RAM (GB) <span className="text-destructive">*</span></Label>
                    <Input id="ram_gb" type="number" placeholder="e.g. 64" {...register("ram_gb", { valueAsNumber: true })} />
                    {errors.ram_gb && <div className="text-xs text-destructive">{errors.ram_gb.message}</div>}
                  </div>
                </div>

                {/* Storage & RAID */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Storage Configuration</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="storage_tb">Storage (TB) <span className="text-destructive">*</span></Label>
                      <Input
                        id="storage_tb"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 2.5"
                        {...register("storage_tb", { valueAsNumber: true })}
                      />
                      {errors.storage_tb && <div className="text-xs text-destructive">{errors.storage_tb.message}</div>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="raid_level">RAID Level</Label>
                      <select id="raid_level" className={selectClassName} {...register("raid_level")}>
                        <option value="">Select RAID...</option>
                        {RAID_LEVELS.map((raid) => (
                          <option key={raid} value={raid}>
                            {raid}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Network & Power */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Network & Power</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nic_count">NIC Count</Label>
                      <select id="nic_count" className={selectClassName} {...register("nic_count", { valueAsNumber: true })}>
                        {NIC_COUNT_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? "NIC" : "NICs"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="power_supply">Power Supply</Label>
                      <Input id="power_supply" placeholder="e.g. Redundant 1200W" {...register("power_supply")} />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      reset();
                      setCreateOpen(false);
                    }}
                    disabled={createLoading}
                    className="border-gray-300 dark:border-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createLoading || selectedHasHardware}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                  >
                    {createLoading ? "Saving…" : "Save Hardware Configuration"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Hardware Configuration</DialogTitle>
                <DialogDescription className="sr-only">
                  Update the hardware configuration fields and save changes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Server</Label>
                  <ServerSelect value={editServerId} onChange={setEditServerId} showSearch={false} />
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Basic Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit_vendor">Vendor</Label>
                      <Input id="edit_vendor" value={editVendor} onChange={(e) => setEditVendor(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_model">Model</Label>
                      <Input id="edit_model" value={editModel} onChange={(e) => setEditModel(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit_serial">Serial Number</Label>
                      <Input id="edit_serial" value={editSerial} onChange={(e) => setEditSerial(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_warranty">Warranty Expiry</Label>
                      <Input 
                        id="edit_warranty" 
                        type="date" 
                        value={editWarrantyExpiry} 
                        onChange={(e) => setEditWarrantyExpiry(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

                {/* CPU & Memory */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">CPU & Memory</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit_cpu_model">CPU Model</Label>
                      <Input id="edit_cpu_model" value={editCpuModel} onChange={(e) => setEditCpuModel(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_cpu_cores">CPU Cores</Label>
                      <select
                        id="edit_cpu_cores"
                        className={selectClassName}
                        value={String(editCpuCores)}
                        onChange={(e) => setEditCpuCores(Number(e.target.value))}
                      >
                        {CPU_CORE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} cores
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_ram">RAM (GB)</Label>
                    <Input
                      id="edit_ram"
                      type="number"
                      value={String(editRamGb)}
                      onChange={(e) => setEditRamGb(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Storage & RAID */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Storage Configuration</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit_storage">Storage (TB)</Label>
                      <Input
                        id="edit_storage"
                        type="number"
                        step="0.1"
                        value={String(editStorageTb)}
                        onChange={(e) => setEditStorageTb(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_raid">RAID Level</Label>
                      <select
                        id="edit_raid"
                        className={selectClassName}
                        value={editRaidLevel}
                        onChange={(e) => setEditRaidLevel(e.target.value)}
                      >
                        <option value="">Select RAID...</option>
                        {RAID_LEVELS.map((raid) => (
                          <option key={raid} value={raid}>
                            {raid}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Network & Power */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Network & Power</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit_nic">NIC Count</Label>
                      <select
                        id="edit_nic"
                        className={selectClassName}
                        value={String(editNicCount)}
                        onChange={(e) => setEditNicCount(Number(e.target.value))}
                      >
                        {NIC_COUNT_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? "NIC" : "NICs"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_power">Power Supply</Label>
                      <Input 
                        id="edit_power" 
                        value={editPowerSupply} 
                        onChange={(e) => setEditPowerSupply(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setEditOpen(false)} 
                  disabled={editSaving}
                  className="border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => void submitEdit()} 
                  disabled={editSaving || !editServerId}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  {editSaving ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Hardware Configuration</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the hardware configuration for{" "}
                  <span className="font-semibold">
                    {deleteTarget?.server_code ?? `#${deleteTarget?.server_id}`}
                  </span>
                  ? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void deleteHardware(deleteTarget!)}
                  disabled={!deleteTarget || deleting}
                >
                  {deleting ? "Deleting…" : "Delete Configuration"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>
    </div>
  );
}