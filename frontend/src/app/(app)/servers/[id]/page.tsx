"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Server as ServerIcon,
  AlertTriangle,
  Activity,
  Shield,
  Network,
  ChevronLeft,
  Layers,
  MoreVertical,
  Clock,
  Globe,
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  Info,
  Terminal,
  CheckCircle2,
  XCircle,
  Construction,
  Search,
  MapPin,
  Box,
  Cpu,
  Database,
  Users,
  Building,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  MemoryStick,
  NetworkIcon,
  ShieldAlert,
  Package,
  HardDriveIcon,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ServerActivityTimeline } from "@/components/server/server-activity-timeline";
import { ServerAuditTimeline } from "@/components/server/server-audit-timeline";

// API Client
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";

// --- Types ---
type ServerDetails = {
  server_id: number;
  server_code?: string | null;
  hostname?: string | null;
  environment?: string | null;
  criticality?: string | null;
  status?: string | null;
  ip_address?: string | null;
  location_name?: string | null;
  location_id?: number | null;
  site_name?: string | null;
  rack_code?: string | null;
  rack_id?: number | null;
  engineer_name?: string | null;
  engineer_id?: number | null;
  team_name?: string | null;
  team_id?: number | null;
  created_at?: string | null;
  last_updated?: string | null;
  warranty_end_date?: string | null;
  eol_date?: string | null;
  description?: string | null;
  tags?: string[];
};

type RelatedData = {
  maintenance: any[];
  incidents: any[];
  monitoring: any[];
  security: any | null;
  hardware: any | null;
  network: any[];
  visits: any[];
  applications: any[];
  activity: any[];
};

// --- Helper Functions ---
function getErrorMessage(err: unknown, fallback: string) {
  const e = err as any;
  return e?.response?.data?.error?.message || e?.message || fallback;
}

function unwrapData(res: any) {
  const d1 = res?.data;
  const d2 = d1?.data;
  return d2 !== undefined ? d2 : d1;
}

// --- Modern Premium Components ---

const StatusIndicator = ({ status }: { status: string }) => {
  const config = {
    Active: { 
      bg: "bg-emerald-500",
      ring: "ring-emerald-500/20",
      icon: CheckCircle2 
    },
    Inactive: { 
      bg: "bg-slate-500",
      ring: "ring-slate-500/20",
      icon: XCircle 
    },
    Maintenance: { 
      bg: "bg-amber-500",
      ring: "ring-amber-500/20",
      icon: Construction 
    },
    Critical: { 
      bg: "bg-rose-500",
      ring: "ring-rose-500/20",
      icon: AlertTriangle 
    },
  }[status] || { 
    bg: "bg-slate-500",
    ring: "ring-slate-500/20",
    icon: Info 
  };

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`relative h-2.5 w-2.5 rounded-full ${config.bg} ring-4 ${config.ring}`} />
      <span className="text-sm font-medium text-slate-700">{status}</span>
    </div>
  );
};

type MetricColor = "blue" | "green" | "orange" | "purple" | "rose";

const METRIC_COLOR_CLASSES: Record<MetricColor, string> = {
  blue: "from-blue-500 to-cyan-500",
  green: "from-emerald-500 to-green-500",
  orange: "from-amber-500 to-orange-500",
  purple: "from-purple-500 to-pink-500",
  rose: "from-rose-500 to-pink-500",
};

const MetricCard = (
  {
    title,
    value,
    icon: Icon,
    trend,
    description,
    color = "blue",
  }: {
    title: React.ReactNode;
    value: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    trend?: number;
    description?: React.ReactNode;
    color?: MetricColor;
  }
) => {
  const colorClasses = METRIC_COLOR_CLASSES[color];

  return (
    <Card className="overflow-hidden border-slate-200 hover:border-slate-300 transition-all duration-200 hover:shadow-lg group">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${colorClasses}`} />
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
              {trend && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  trend > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-slate-500 mt-2">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={`p-2 rounded-lg bg-linear-to-br ${colorClasses} text-white`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const DetailCard = ({ title, icon: Icon, children, className = "" }: any) => (
  <Card className={`border-slate-200 ${className}`}>
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      {children}
    </CardContent>
  </Card>
);

const InfoItem = ({ label, value, icon: Icon, mono = false, copyable = false, href }: any) => {
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(String(value));
      toast.success("Copied to clipboard");
    }
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {href ? (
          <a 
            href={href} 
            className={`text-sm font-medium text-slate-900 hover:text-emerald-600 ${mono ? 'font-mono' : ''}`}
          >
            {value || "—"}
          </a>
        ) : (
          <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>
            {value || "—"}
          </span>
        )}
        {copyable && value && (
          <button
            onClick={handleCopy}
            className="ml-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Main Page Component ---

export default function ServerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);
  const { user } = useAuth();

  // ID Parsing
  const serverId = React.useMemo(() => {
    const raw = (params as any)?.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const n = Number.parseInt(String(id ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  }, [params]);

  // State
  const [server, setServer] = React.useState<ServerDetails | null>(null);
  const [relatedData, setRelatedData] = React.useState<RelatedData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const canReadSecurity = can(user, "security.read");
  const canReadApplicationLinks = can(user, "applications.read");

  const loadData = React.useCallback(async () => {
    if (!serverId) return;
    try {
      setRefreshing(true);
      const emptyOk = { data: { ok: true, data: [] as any[] } };

      const [serverRes, maintenanceRes, incidentsRes, monitoringRes, securityRes, hardwareRes, networkRes, visitsRes, applicationsRes] = await Promise.all([
        api.get(`/api/servers/${serverId}`, { headers: { "x-sam-silent": "1" } }),
        api.get(`/api/maintenance`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } }),
        api.get(`/api/incidents`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } }),
        api.get(`/api/monitoring`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } }),
        canReadSecurity
          ? api
              .get(`/api/security`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } })
              .catch((e: any) => (e?.response?.status === 403 ? emptyOk : ({ data: null } as any)))
          : Promise.resolve(emptyOk),
        api.get(`/api/hardware`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } }),
        api.get(`/api/network`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } }),
        api.get(`/api/visits`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } }),
        canReadApplicationLinks
          ? api
              .get(`/api/applications/links`, { params: { server_id: serverId }, headers: { "x-sam-silent": "1" } })
              .catch((e: any) => (e?.response?.status === 403 ? emptyOk : Promise.reject(e)))
          : Promise.resolve(emptyOk),
      ]);

      setServer(unwrapData(serverRes)?.server || unwrapData(serverRes));
      
      const safeExtract = (res: any) => {
        const d = unwrapData(res);
        return Array.isArray(d) ? d : (Array.isArray(d?.rows) ? d.rows : []);
      };

      setRelatedData({
        maintenance: safeExtract(maintenanceRes),
        incidents: safeExtract(incidentsRes),
        monitoring: safeExtract(monitoringRes),
        security: safeExtract(securityRes)[0] || null,
        hardware: safeExtract(hardwareRes)[0] || null,
        network: safeExtract(networkRes),
        visits: safeExtract(visitsRes),
        applications: safeExtract(applicationsRes),
        // Activity is loaded live in the Activity tab via ServerActivityTab.
        activity: [],
      });

    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to refresh data"));
    } finally {
      setRefreshing(false);
    }
  }, [serverId]);

  React.useEffect(() => {
    if (serverId) {
      setLoading(true);
      loadData().catch((e) => setError(getErrorMessage(e, "Error"))).finally(() => setLoading(false));
    }
  }, [serverId, loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-72 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => (
              <Skeleton key={`skeleton-${i}`} className="h-32 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-6">
        <div className="rounded-xl bg-white p-8 border border-slate-200 shadow-lg">
          <Search className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Server Not Found</h2>
          <p className="text-slate-600 max-w-md text-center mb-6">
            The server you're looking for doesn't exist or you don't have permission to access it.
          </p>
          <Button 
            onClick={() => router.push("/servers")}
            className="w-full bg-linear-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-shadow duration-200 font-medium"
          >
            Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

  const activeIncidents = relatedData?.incidents.filter((i: any) => i.status === 'Open').length || 0;
  const uptimePercent = relatedData?.monitoring?.[0]?.uptime_percent || "99.9";
  const securityScore = relatedData?.security?.score || "98";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modern Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                onClick={() => router.push("/servers")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-slate-900">{server.hostname}</h1>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {server.environment || 'Unknown'}
                    </Badge>
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                      {server.criticality || 'Standard'}
                    </Badge>
                    <StatusIndicator status={server.status || "Unknown"} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{server.server_code}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {server.location_name || server.site_name || "Unknown Location"}
                  </span>
                  <span>•</span>
                  <span>ID: {server.server_id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData} 
                disabled={refreshing}
                className="h-9 border-slate-300 hover:border-slate-400"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-slate-300">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push(`/servers/${server.server_id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Server
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(String(server.ip_address || server.server_code));
                    toast.success("Copied to clipboard");
                  }}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Terminal className="mr-2 h-4 w-4" /> Open Console
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Eye className="mr-2 h-4 w-4" /> View Logs
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-rose-600 focus:text-rose-600">
                    <Trash2 className="mr-2 h-4 w-4" /> Decommission
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard 
            title="Uptime (30d)"
            value={`${uptimePercent}%`}
            icon={Activity}
            trend={0.2}
            color="green"
          />
          <MetricCard 
            title="Active Incidents"
            value={activeIncidents}
            icon={AlertTriangle}
            trend={-1}
            color="rose"
          />
          <MetricCard 
            title="Applications"
            value={relatedData?.applications?.length || 0}
            icon={Layers}
            trend={2}
            color="purple"
          />
          <MetricCard 
            title="Security Score"
            value={`${securityScore}/100`}
            icon={Shield}
            trend={1.5}
            color="blue"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Server Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Card */}
            <DetailCard title="Overview" icon={ServerIcon}>
              <div className="space-y-1">
                <InfoItem label="Hostname" value={server.hostname} mono />
                <InfoItem label="Server Code" value={server.server_code} mono copyable />
                <InfoItem label="IP Address" value={server.ip_address} mono copyable />
                <InfoItem label="Operating System" value={relatedData?.hardware?.operating_system || "N/A"} />
                <InfoItem label="Description" value={server.description || "No description provided"} />
              </div>
            </DetailCard>

            {/* Tabs Section */}
            <Card className="border-slate-200">
              <Tabs defaultValue="hardware" className="w-full">
                <TabsList className="w-full justify-start border-b border-slate-200 rounded-none bg-transparent p-0 h-auto">
                  <TabsTrigger 
                    value="hardware" 
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-600 data-[state=active]:border-emerald-500 data-[state=active]:text-slate-900"
                  >
                    <Cpu className="mr-2 h-4 w-4" />
                    Hardware
                  </TabsTrigger>
                  <TabsTrigger 
                    value="network" 
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-600 data-[state=active]:border-emerald-500 data-[state=active]:text-slate-900"
                  >
                    <NetworkIcon className="mr-2 h-4 w-4" />
                    Network
                  </TabsTrigger>
                  <TabsTrigger 
                    value="applications" 
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-600 data-[state=active]:border-emerald-500 data-[state=active]:text-slate-900"
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Applications
                  </TabsTrigger>
                  <TabsTrigger 
                    value="activity" 
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-600 data-[state=active]:border-emerald-500 data-[state=active]:text-slate-900"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Activity
                  </TabsTrigger>
                  <TabsTrigger 
                    value="audit" 
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-slate-600 data-[state=active]:border-emerald-500 data-[state=active]:text-slate-900"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Audit
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="hardware" className="p-6">
                  {relatedData?.hardware ? (
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem label="Processor" value={relatedData.hardware.cpu_model || "N/A"} icon={Cpu} />
                      <InfoItem label="Cores" value={relatedData.hardware.cpu_cores || "N/A"} />
                      <InfoItem label="RAM" value={relatedData.hardware.ram_gb ? `${relatedData.hardware.ram_gb} GB` : "N/A"} icon={MemoryStick} />
                      <InfoItem label="Storage" value={relatedData.hardware.storage_tb ? `${relatedData.hardware.storage_tb} TB` : "N/A"} icon={HardDriveIcon} />
                      <InfoItem label="Manufacturer" value={relatedData.hardware.manufacturer || "N/A"} />
                      <InfoItem label="Model" value={relatedData.hardware.model || "N/A"} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Cpu className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No hardware information available</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="network" className="p-6">
                  {relatedData?.network && relatedData.network.length > 0 ? (
                    <div className="space-y-3">
                      {relatedData.network.map((net: any, idx: number) => (
                        <Card key={`network-${idx}`} className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Interface</p>
                                <p className="font-medium text-slate-900">{net.interface || `eth${idx}`}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">IP Address</p>
                                <p className="font-mono font-medium text-slate-900">{net.ip_address || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">MAC Address</p>
                                <p className="font-mono font-medium text-slate-900">{net.mac_address || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Type</p>
                                <Badge variant="outline">{net.network_type || "LAN"}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <NetworkIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No network interfaces configured</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="applications" className="p-6">
                  {relatedData?.applications && relatedData.applications.length > 0 ? (
                    <div className="space-y-3">
                      {relatedData.applications.map((app: any, idx: number) => (
                        <Card key={`app-${idx}`} className="border-slate-200 hover:border-slate-300 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-slate-900">{app.app_name || app.name || "Unnamed Application"}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-500">v{app.version || "1.0.0"}</span>
                                  {app.port && (
                                    <Badge variant="outline" className="text-xs">Port: {app.port}</Badge>
                                  )}
                                </div>
                              </div>
                              <Badge variant={
                                app.status === 'Running' ? 'success' : 
                                app.status === 'Stopped' ? 'destructive' : 'outline'
                              }>
                                {app.status || 'Unknown'}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No applications installed</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="p-6">
                  {serverId ? (
                    <ServerActivityTimeline serverId={serverId} />
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No server selected</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="p-6">
                  {serverId ? (
                    <ServerAuditTimeline serverId={serverId} />
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No server selected</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Location & Ownership */}
            <DetailCard title="Location & Ownership" icon={MapPin}>
              <div className="space-y-1">
                <InfoItem 
                  label="Data Center" 
                  value={server.location_name || server.site_name} 
                  icon={Building}
                  href={server.location_id ? `/locations/${server.location_id}` : undefined}
                />
                <InfoItem 
                  label="Rack" 
                  value={server.rack_code} 
                  icon={Box}
                  href={server.rack_id ? `/racks/${server.rack_id}` : undefined}
                />
                <InfoItem 
                  label="Team" 
                  value={server.team_name} 
                  icon={Users}
                  href={server.team_id ? `/teams/${server.team_id}` : undefined}
                />
                <InfoItem 
                  label="Engineer" 
                  value={server.engineer_name} 
                  icon={Users}
                  href={server.engineer_id ? `/engineers/${server.engineer_id}` : undefined}
                />
              </div>
            </DetailCard>

            {/* Security Status */}
            <DetailCard title="Security Status" icon={ShieldAlert}>
              {relatedData?.security ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Firewall</span>
                    <Badge variant={relatedData.security.firewall_enabled ? 'success' : 'destructive'}>
                      {relatedData.security.firewall_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Last Scan</span>
                    <span className="text-sm font-medium text-slate-900">
                      {relatedData.security.last_scan ? new Date(relatedData.security.last_scan).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Open Ports</span>
                    <span className="text-sm font-medium text-slate-900">
                      {relatedData.security.open_ports || '0'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">
                  <p className="text-sm">No security data available</p>
                </div>
              )}
            </DetailCard>

            {/* Lifecycle */}
            <DetailCard title="Lifecycle" icon={Calendar}>
              <div className="space-y-1">
                <InfoItem 
                  label="Created" 
                  value={server.created_at ? new Date(server.created_at).toLocaleDateString() : 'Unknown'} 
                />
                <InfoItem 
                  label="Last Updated" 
                  value={server.last_updated ? new Date(server.last_updated).toLocaleDateString() : 'Unknown'} 
                />
                <InfoItem 
                  label="Warranty End" 
                  value={server.warranty_end_date ? new Date(server.warranty_end_date).toLocaleDateString() : 'N/A'} 
                />
                <InfoItem 
                  label="End of Life" 
                  value={server.eol_date ? new Date(server.eol_date).toLocaleDateString() : 'N/A'} 
                />
              </div>
            </DetailCard>

            {/* Quick Actions */}
            <Card className="border-emerald-100 bg-linear-to-b from-emerald-50 to-white">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => router.push(`/servers/${server.server_id}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Server
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-slate-200 hover:border-slate-300"
                    onClick={() => {
                      navigator.clipboard.writeText(String(server.ip_address));
                      toast.success("IP address copied");
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy IP Address
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-slate-200 hover:border-slate-300"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Monitoring
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}