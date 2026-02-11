"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { requiredText } from "@/lib/validation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  serverId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

const hardwareSchema = z.object({
  vendor: requiredText("Vendor is required"),
  model: requiredText("Model is required"),
  serial_number: requiredText("Serial number is required"),
  cpu_model: requiredText("CPU model is required"),
  cpu_cores: z.number().int().min(1, "CPU cores is required"),
  ram_gb: z.number().int().min(1, "RAM is required"),
  storage_tb: z.number().positive("Storage is required"),
});

type HardwareForm = z.infer<typeof hardwareSchema>;

const networkSchema = z.object({
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

type NetworkForm = z.infer<typeof networkSchema>;

const securitySchema = z.object({
  os_name: requiredText("OS name is required"),
  os_version: requiredText("OS version is required"),
  hardening_status: requiredText("Hardening status is required"),
  ssh_key_only: z.boolean(),
  antivirus_installed: z.boolean(),
  backup_enabled: z.boolean(),
  backup_frequency: requiredText("Backup frequency is required"),
  log_retention_days: z.number().int().min(1, "Log retention days is required"),
  compliance: requiredText("Compliance is required"),
});

type SecurityForm = z.infer<typeof securitySchema>;

export function PostCreateWizard({ serverId, open, onOpenChange, onDone }: Props) {
  const [step, setStep] = React.useState<"hardware" | "network" | "security">("hardware");

  const [hardwareSaving, setHardwareSaving] = React.useState(false);
  const hardwareForm = useForm<HardwareForm>({
    resolver: zodResolver(hardwareSchema),
    defaultValues: { vendor: "", model: "", serial_number: "", cpu_model: "", cpu_cores: 4, ram_gb: 16, storage_tb: 1 },
  });

  const [networkSaving, setNetworkSaving] = React.useState(false);
  const [networkAdded, setNetworkAdded] = React.useState<Array<{ ip_address: string; network_type: string }>>([]);
  const networkForm = useForm<NetworkForm>({
    resolver: zodResolver(networkSchema),
    defaultValues: { 
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
      nat_enabled: false
    },
  });

  const [securitySaving, setSecuritySaving] = React.useState(false);
  const securityForm = useForm<SecurityForm>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      os_name: "",
      os_version: "",
      hardening_status: "",
      ssh_key_only: false,
      antivirus_installed: false,
      backup_enabled: false,
      backup_frequency: "",
      log_retention_days: 30,
      compliance: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setStep("hardware");
    setNetworkAdded([]);
    hardwareForm.reset();
    networkForm.reset({ 
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
      nat_enabled: false
    });
    securityForm.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serverId]);

  const saveHardware = async (values: HardwareForm) => {
    try {
      setHardwareSaving(true);
      await api.post("/api/hardware", { server_id: serverId, ...values }, { headers: { "x-sam-silent": "1" } });
      toast.success("Hardware saved");
      setStep("network");
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.error?.code;
      if (status === 409 && code === "HARDWARE_ALREADY_EXISTS") {
        toast.error("This server already has hardware. Use the Hardware page to edit it.");
        setStep("network");
        return;
      }
      toast.error(e?.response?.data?.error?.message ?? "Failed to save hardware");
    } finally {
      setHardwareSaving(false);
    }
  };

  const addNetwork = async (values: NetworkForm) => {
    try {
      setNetworkSaving(true);
      await api.post(
        "/api/network/assign-ip",
        { server_id: serverId, ...values },
        { headers: { "x-sam-silent": "1" } }
      );
      toast.success("Network assigned");
      setNetworkAdded((prev) => [...prev, { ip_address: values.ip_address, network_type: values.network_type }]);
      // Keep some values for next entry
      networkForm.reset({ 
        ip_address: "", 
        secondary_ip: "",
        ipv6: "",
        subnet: values.subnet,
        vlan: values.vlan,
        gateway: values.gateway,
        dns_type: values.dns_type,
        network_type: values.network_type,
        bandwidth: values.bandwidth,
        firewall_enabled: values.firewall_enabled,
        nat_enabled: values.nat_enabled
      });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        toast.error(e?.response?.data?.error?.message ?? "This IP already exists.");
        return;
      }
      toast.error(e?.response?.data?.error?.message ?? "Failed to assign IP");
    } finally {
      setNetworkSaving(false);
    }
  };

  const saveSecurity = async (values: SecurityForm) => {
    try {
      setSecuritySaving(true);
      await api.post(
        "/api/security",
        {
          server_id: serverId,
          ...values,
          backup_frequency: values.backup_frequency.trim(),
          log_retention_days: values.log_retention_days,
        },
        { headers: { "x-sam-silent": "1" } }
      );
      toast.success("Security saved");
      onDone();
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.error?.code;
      if (status === 409 && code === "SECURITY_ALREADY_EXISTS") {
        toast.error("This server already has security. Use the Security page to edit it.");
        onDone();
        return;
      }
      toast.error(e?.response?.data?.error?.message ?? "Failed to save security");
    } finally {
      setSecuritySaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete server setup</DialogTitle>
        </DialogHeader>

        <Tabs value={step} onValueChange={(v) => setStep(v as any)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="hardware" className="pt-2">
            <form className="grid gap-4" onSubmit={hardwareForm.handleSubmit(saveHardware)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="hw_vendor">Vendor</Label>
                  <Input id="hw_vendor" {...hardwareForm.register("vendor")} />
                  {hardwareForm.formState.errors.vendor ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.vendor.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hw_model">Model</Label>
                  <Input id="hw_model" {...hardwareForm.register("model")} />
                  {hardwareForm.formState.errors.model ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.model.message}</div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="hw_serial">Serial number</Label>
                  <Input id="hw_serial" {...hardwareForm.register("serial_number")} />
                  {hardwareForm.formState.errors.serial_number ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.serial_number.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hw_cpu_model">CPU model</Label>
                  <Input id="hw_cpu_model" {...hardwareForm.register("cpu_model")} />
                  {hardwareForm.formState.errors.cpu_model ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.cpu_model.message}</div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="hw_cpu_cores">CPU cores</Label>
                  <Input id="hw_cpu_cores" type="number" {...hardwareForm.register("cpu_cores", { valueAsNumber: true })} />
                  {hardwareForm.formState.errors.cpu_cores ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.cpu_cores.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hw_ram">RAM (GB)</Label>
                  <Input id="hw_ram" type="number" {...hardwareForm.register("ram_gb", { valueAsNumber: true })} />
                  {hardwareForm.formState.errors.ram_gb ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.ram_gb.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hw_storage">Storage (TB)</Label>
                  <Input id="hw_storage" type="number" step="0.1" {...hardwareForm.register("storage_tb", { valueAsNumber: true })} />
                  {hardwareForm.formState.errors.storage_tb ? (
                    <div className="text-xs text-destructive">{hardwareForm.formState.errors.storage_tb.message}</div>
                  ) : null}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep("network")}>
                  Skip
                </Button>
                <Button type="submit" disabled={hardwareSaving}>
                  {hardwareSaving ? "Saving…" : "Save & Continue"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="network" className="pt-2">
            <form className="grid gap-5" onSubmit={networkForm.handleSubmit(addNetwork)}>
              <div className="grid gap-4">
                <div className="text-sm font-semibold text-foreground">IP Configuration</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="nw_ip">Primary IP <span className="text-destructive">*</span></Label>
                    <Input id="nw_ip" placeholder="e.g. 10.10.0.15" {...networkForm.register("ip_address")} />
                    {networkForm.formState.errors.ip_address ? (
                      <div className="text-xs text-destructive">{networkForm.formState.errors.ip_address.message}</div>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nw_secondary_ip">Secondary IP</Label>
                    <Input id="nw_secondary_ip" placeholder="e.g. 10.10.0.16" {...networkForm.register("secondary_ip")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nw_ipv6">IPv6</Label>
                    <Input id="nw_ipv6" placeholder="e.g. 2001:db8::1" {...networkForm.register("ipv6")} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="text-sm font-semibold text-foreground">Network Details</div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nw_subnet">Subnet <span className="text-destructive">*</span></Label>
                    <Input id="nw_subnet" placeholder="e.g. 255.255.255.0" {...networkForm.register("subnet")} />
                    {networkForm.formState.errors.subnet ? (
                      <div className="text-xs text-destructive">{networkForm.formState.errors.subnet.message}</div>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nw_vlan">VLAN</Label>
                    <Input id="nw_vlan" placeholder="e.g. 100" {...networkForm.register("vlan")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nw_gateway">Gateway</Label>
                    <Input id="nw_gateway" placeholder="e.g. 10.10.0.1" {...networkForm.register("gateway")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nw_dns_type">DNS Type</Label>
                    <select
                      id="nw_dns_type"
                      className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      {...networkForm.register("dns_type")}
                    >
                      <option value="">Select DNS type</option>
                      <option value="Primary">Primary</option>
                      <option value="Secondary">Secondary</option>
                      <option value="Forwarder">Forwarder</option>
                      <option value="Recursive">Recursive</option>
                      <option value="Authoritative">Authoritative</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="text-sm font-semibold text-foreground">Configuration</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="nw_type">Network Type <span className="text-destructive">*</span></Label>
                    <Input id="nw_type" placeholder="LAN/WAN/DMZ" {...networkForm.register("network_type")} />
                    {networkForm.formState.errors.network_type ? (
                      <div className="text-xs text-destructive">{networkForm.formState.errors.network_type.message}</div>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nw_bandwidth">Bandwidth</Label>
                    <Input id="nw_bandwidth" placeholder="1Gbps/10Gbps" {...networkForm.register("bandwidth")} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Security Features</Label>
                    <div className="flex gap-4 pt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" {...networkForm.register("firewall_enabled")} className="h-4 w-4 rounded" />
                        <span>Firewall</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" {...networkForm.register("nat_enabled")} className="h-4 w-4 rounded" />
                        <span>NAT</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {networkAdded.length ? (
                <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                      {networkAdded.length}
                    </span>
                    Network(s) assigned in this wizard
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    {networkAdded.map((r, i) => (
                      <div key={i} className="truncate">
                        • {r.ip_address} ({r.network_type})
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setStep("security")}>
                  Continue
                </Button>
                <Button type="submit" disabled={networkSaving}>
                  {networkSaving ? "Adding…" : "Add Network"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="security" className="pt-2">
            <form className="grid gap-4" onSubmit={securityForm.handleSubmit(saveSecurity)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="sec_os_name">OS name</Label>
                  <Input id="sec_os_name" {...securityForm.register("os_name")} />
                  {securityForm.formState.errors.os_name ? (
                    <div className="text-xs text-destructive">{securityForm.formState.errors.os_name.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sec_os_version">OS version</Label>
                  <Input id="sec_os_version" {...securityForm.register("os_version")} />
                  {securityForm.formState.errors.os_version ? (
                    <div className="text-xs text-destructive">{securityForm.formState.errors.os_version.message}</div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="sec_hardening">Hardening status</Label>
                  <Input id="sec_hardening" {...securityForm.register("hardening_status")} />
                  {securityForm.formState.errors.hardening_status ? (
                    <div className="text-xs text-destructive">{securityForm.formState.errors.hardening_status.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sec_compliance">Compliance</Label>
                  <Input id="sec_compliance" {...securityForm.register("compliance")} />
                  {securityForm.formState.errors.compliance ? (
                    <div className="text-xs text-destructive">{securityForm.formState.errors.compliance.message}</div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" {...securityForm.register("ssh_key_only")} />
                  SSH key-only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" {...securityForm.register("antivirus_installed")} />
                  Antivirus installed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" {...securityForm.register("backup_enabled")} />
                  Backups enabled
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="sec_backup_freq">Backup frequency</Label>
                  <select
                    id="sec_backup_freq"
                    className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    {...securityForm.register("backup_frequency")}
                  >
                    <option value="" disabled>
                      Select a frequency
                    </option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                  {securityForm.formState.errors.backup_frequency ? (
                    <div className="text-xs text-destructive">{securityForm.formState.errors.backup_frequency.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sec_log_ret">Log retention days</Label>
                  <Input id="sec_log_ret" type="number" {...securityForm.register("log_retention_days", { valueAsNumber: true })} />
                  {securityForm.formState.errors.log_retention_days ? (
                    <div className="text-xs text-destructive">{securityForm.formState.errors.log_retention_days.message}</div>
                  ) : null}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onDone}>
                  Skip
                </Button>
                <Button type="submit" disabled={securitySaving}>
                  {securitySaving ? "Saving…" : "Finish"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
