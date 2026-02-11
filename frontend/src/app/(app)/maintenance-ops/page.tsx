"use client";

import * as React from "react";
import { Eye, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";

type Frequency = "Daily" | "Weekly" | "Monthly";
type RunStatus = "Active" | "Incomplete" | "Overdue" | "Complete";

type MaintenanceType = {
	maintenance_type_id: number;
	name: string;
	description?: string | null;
	checklist_count?: number;
};

type RunRow = {
	run_id: number;
	schedule_id: number;
	due_date: string;
	status: RunStatus;
	completed_at?: string | null;
	note?: string | null;
	frequency: Frequency;
	server_id: number;
	server_code?: string | null;
	hostname?: string | null;
	maintenance_type: string;
	assigned_engineers?: string | null;
	total_tasks?: number;
	done_tasks?: number;
};

type RunDetail = {
	run: {
		run_id: number;
		schedule_id: number;
		due_date: string;
		status: RunStatus;
		completed_at?: string | null;
		note?: string | null;
		frequency: Frequency;
		server_id: number;
		server_code?: string | null;
		hostname?: string | null;
		maintenance_type: string;
	};
	engineers: Array<{ engineer_id: number; full_name?: string | null; email?: string | null; phone?: string | null }>;
	checklist: Array<{ checklist_item_id: number; label: string; is_done: boolean; done_at?: string | null }>;
	progress: { done: number; total: number; percent: number };
};

function pct(done: number, total: number) {
	if (!total) return 0;
	return Math.round((done / total) * 100);
}

function statusBadgeVariant(status: RunStatus): "default" | "secondary" | "destructive" | "outline" {
	if (status === "Overdue") return "destructive";
	if (status === "Complete") return "secondary";
	if (status === "Incomplete") return "outline";
	return "default";
}

function freqBadge(freq: Frequency) {
	const variant = freq === "Daily" ? "default" : freq === "Weekly" ? "secondary" : "outline";
	return <Badge variant={variant as any}>{freq}</Badge>;
}

function getErrorMessage(err: unknown, fallback: string) {
	const maybe = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
	return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

function isDueToday(dueDateStr: string): boolean {
	try {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		const dueDate = new Date(dueDateStr);
		dueDate.setHours(0, 0, 0, 0);
		
		return today.getTime() === dueDate.getTime();
	} catch {
		return false;
	}
}

// --- IP Assignment Section ---
function IpAssignment() {
	const [mainIp, setMainIp] = React.useState("");
	const [subIps, setSubIps] = React.useState<string[]>([""]);

	const handleSubIpChange = (idx: number, value: string) => {
		setSubIps((ips) => ips.map((ip, i) => (i === idx ? value : ip)));
	};

	const addSubIp = () => setSubIps((ips) => [...ips, ""]);
	const removeSubIp = (idx: number) => setSubIps((ips) => ips.filter((_, i) => i !== idx));

	const handleSubmit = async () => {
		try {
			// Filter empty sub IPs
			const validSubIps = subIps.filter(ip => ip.trim() !== "");
			
			if (!mainIp.trim()) {
				toast.error("Please enter a main IP address");
				return;
			}

			const payload = {
				main_ip: mainIp.trim(),
				sub_ips: validSubIps
			};

			await api.post("/api/ip-assignment", payload);
			toast.success("IP addresses assigned successfully");
			
			// Clear form
			setMainIp("");
			setSubIps([""]);
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to assign IP addresses"));
		}
	};

	return (
		<Card className="mb-6">
			<CardHeader>
				<CardTitle>IP Address Assignment</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div>
					<label className="block text-sm font-medium mb-1">Main IP Address</label>
					<Input
						placeholder="e.g. 192.168.1.10"
						value={mainIp}
						onChange={(e) => setMainIp(e.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium mb-1">Sub IP Addresses</label>
					<div className="grid gap-2">
						{subIps.map((ip, idx) => (
							<div key={idx} className="flex gap-2 items-center">
								<Input
									placeholder={`Sub IP #${idx + 1}`}
									value={ip}
									onChange={(e) => handleSubIpChange(idx, e.target.value)}
								/>
								<Button
									type="button"
									variant="destructive"
									size="icon"
									className="h-8 w-8"
									onClick={() => removeSubIp(idx)}
									disabled={subIps.length === 1}
									aria-label="Remove sub IP"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
						<div className="flex gap-2 mt-2">
							<Button type="button" variant="outline" size="sm" onClick={addSubIp}>
								<Plus className="h-4 w-4 mr-1" /> Add Sub IP
							</Button>
							<Button type="button" variant="default" size="sm" onClick={handleSubmit}>
								Assign IPs
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default function MaintenanceOpsPage() {
	const { user } = useAuth();
	const canManage = can(user, "maintenance.manage");

	const [tab, setTab] = React.useState<"active" | "completed">("active");
	const [q, setQ] = React.useState("");

	const [rows, setRows] = React.useState<RunRow[]>([]);
	const [loading, setLoading] = React.useState(true);

	const [progressOpen, setProgressOpen] = React.useState(false);
	const [progressLoading, setProgressLoading] = React.useState(false);
	const [progressSaving, setProgressSaving] = React.useState(false);
	const [checklistSavingId, setChecklistSavingId] = React.useState<number | null>(null);
	const [runDetail, setRunDetail] = React.useState<RunDetail | null>(null);

	const [historyOpen, setHistoryOpen] = React.useState(false);
	const [historyLoading, setHistoryLoading] = React.useState(false);
	const [historyRows, setHistoryRows] = React.useState<any[]>([]);
	const [historyScheduleId, setHistoryScheduleId] = React.useState<number | null>(null);
	const [activeHistoryRows, setActiveHistoryRows] = React.useState<any[]>([]);
	const [completedHistoryRows, setCompletedHistoryRows] = React.useState<any[]>([]);


	React.useEffect(() => {
		let alive = true;

		(async () => {
			try {
				setLoading(true);
				const endpoint = tab === "active" ? "/api/maintenance-ops/runs/active" : "/api/maintenance-ops/runs/completed";
				const res = await api.get(endpoint, {
					params: { q: q.trim() || undefined, page: 1, page_size: 100 },
					headers: { "x-sam-silent": "1" },
				});
				const list = (res.data?.data?.rows ?? []) as RunRow[];
				if (!alive) return;
				setRows(list);
			} catch (err) {
				if (!alive) return;
				toast.error(getErrorMessage(err, "Failed to load maintenance runs"));
				setRows([]);
			} finally {
				if (alive) setLoading(false);
			}
		})();

		return () => {
			alive = false;
		};
	}, [tab, q]);

	const refresh = React.useCallback(async () => {
		const endpoint = tab === "active" ? "/api/maintenance-ops/runs/active" : "/api/maintenance-ops/runs/completed";
		const res = await api.get(endpoint, {
			params: { q: q.trim() || undefined, page: 1, page_size: 100 },
			headers: { "x-sam-silent": "1" },
		});
		setRows((res.data?.data?.rows ?? []) as RunRow[]);
	}, [q, tab]);

	const openRun = React.useCallback(async (runId: number) => {
		setProgressOpen(true);
		setProgressLoading(true);
		setRunDetail(null);
		try {
			const res = await api.get(`/api/maintenance-ops/runs/${runId}`, { headers: { "x-sam-silent": "1" } });
			const detail = res.data?.data as RunDetail;
			setRunDetail(detail);
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to load run"));
			setProgressOpen(false);
		} finally {
			setProgressLoading(false);
		}
	}, []);

	const toggleChecklistItem = React.useCallback(
		async (checklistItemId: number, isDone: boolean) => {
			if (!runDetail) return;
			if (runDetail.run.status === "Complete") return;
			try {
				setChecklistSavingId(checklistItemId);
				await api.patch(
					`/api/maintenance-ops/runs/${runDetail.run.run_id}/checklist/${checklistItemId}`,
					{ is_done: !isDone },
					{ headers: { "x-sam-silent": "1" } }
				);
				const res = await api.get(`/api/maintenance-ops/runs/${runDetail.run.run_id}`, { headers: { "x-sam-silent": "1" } });
				setRunDetail(res.data?.data as RunDetail);
			} catch (err) {
				toast.error(getErrorMessage(err, "Failed to update task"));
			} finally {
				setChecklistSavingId(null);
			}
		},
		[runDetail]
	);


	const markCompleteById = React.useCallback(
		async (runId: number) => {
			try {
				setProgressSaving(true);
				const res = await api.post(`/api/maintenance-ops/runs/${runId}/complete`);
				const data = res.data?.data as any;
				if (data?.renewed && data?.next_due_date) toast.success(`Completed. Next maintenance created for ${String(data.next_due_date)}`);
				else toast.success("Completed");
				await refresh();
				setProgressOpen(false);
			} catch (err) {
				toast.error(getErrorMessage(err, "Failed to mark complete"));
			} finally {
				setProgressSaving(false);
			}
		},
		[refresh]
	);

	const openHistory = React.useCallback(async (scheduleId: number) => {
		setHistoryOpen(true);
		setHistoryScheduleId(scheduleId);
		setHistoryLoading(true);
		setHistoryRows([]);
		setActiveHistoryRows([]);
		setCompletedHistoryRows([]);
		try {
			const res = await api.get(`/api/maintenance-ops/schedules/${scheduleId}/history`, { headers: { "x-sam-silent": "1" } });
			const all = (res.data?.data ?? []) as any[];
			setHistoryRows(all);
			setCompletedHistoryRows(all.filter((r) => String(r.status) === "Complete"));
			setActiveHistoryRows(all.filter((r) => String(r.status) !== "Complete"));
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to load history"));
		} finally {
			setHistoryLoading(false);
		}
	}, []);

	const filteredRows = React.useMemo(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((r) => {
			const s = `${r.server_code ?? ""} ${r.hostname ?? ""} ${r.maintenance_type ?? ""} ${r.assigned_engineers ?? ""}`.toLowerCase();
			return s.includes(needle);
		});
	}, [q, rows]);

	return (
		<div className="space-y-6">
			{/* IP Assignment Section */}
			<IpAssignment />
			<PageHeader
				title="Advanced Maintenance (Ops Mode)"
				description="Recurring schedules, multi-engineer execution, checklist progress, history, and SMS notifications."
				actions={null}
			/>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-4">
					<div className="space-y-1">
						<CardTitle>Maintenance Runs</CardTitle>
						<div className="text-sm text-muted-foreground">Active includes Active/Incomplete/Overdue.</div>
					</div>
					<div className="flex w-full max-w-md items-center gap-2">
						<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search server/type/engineer…" />
					</div>
				</CardHeader>
				<CardContent>
					<Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
						<TabsList>
							<TabsTrigger value="active">Active</TabsTrigger>
							<TabsTrigger value="completed">Completed</TabsTrigger>
						</TabsList>

						<TabsContent value="active" className="mt-4">
							{loading ? (
								<div className="grid gap-3">
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Server</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Frequency</TableHead>
											<TableHead>Due</TableHead>
											<TableHead>Engineers</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredRows.length === 0 ? (
											<TableRow>
												<TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
													No runs found.
												</TableCell>
											</TableRow>
										) : (
											filteredRows.map((r) => (
												<TableRow key={r.run_id}>
													<TableCell>
														<div className="font-medium">
															{r.server_code ?? `#${r.server_id}`} {r.hostname ? <span className="text-muted-foreground">{r.hostname}</span> : null}
														</div>
													</TableCell>
													<TableCell>{r.maintenance_type}</TableCell>
													<TableCell>{freqBadge(r.frequency)}</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<span>{r.due_date}</span>
															{isDueToday(r.due_date) && r.status !== "Complete" && (
																<Badge variant="outline" className="text-xs bg-blue-50">
																	Today
																</Badge>
															)}
														</div>
													</TableCell>
													  <TableCell className="max-w-60 truncate">{r.assigned_engineers ?? "—"}</TableCell>
													<TableCell>
														<Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
														<div className="mt-1 text-xs text-muted-foreground">
															{Number(r.done_tasks ?? 0)}/{Number(r.total_tasks ?? 0)} ({pct(Number(r.done_tasks ?? 0), Number(r.total_tasks ?? 0))}%)
														</div>
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															{isDueToday(r.due_date) && r.status !== "Complete" && (
																<Button
																	variant="default"
																	size="sm"
																	disabled={progressSaving}
																	onClick={() => markCompleteById(r.run_id)}
																>
																	Mark Complete
																</Button>
															)}
															<Button variant="outline" size="sm" onClick={() => openRun(r.run_id)}>
																<Eye className="mr-2 h-4 w-4" /> View
															</Button>
															<Button variant="outline" size="sm" onClick={() => openHistory(r.schedule_id)}>
																<History className="mr-2 h-4 w-4" /> History
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							)}
						</TabsContent>

						<TabsContent value="completed" className="mt-4">
							{loading ? (
								<div className="grid gap-3">
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Server</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Frequency</TableHead>
											<TableHead>Due</TableHead>
														<TableHead>Engineers</TableHead>
											<TableHead>Completed</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredRows.length === 0 ? (
											<TableRow>
															<TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
													No completed runs found.
												</TableCell>
											</TableRow>
										) : (
											filteredRows.map((r) => (
												<TableRow key={r.run_id}>
													<TableCell>
														<div className="font-medium">
															{r.server_code ?? `#${r.server_id}`} {r.hostname ? <span className="text-muted-foreground">{r.hostname}</span> : null}
														</div>
													</TableCell>
													<TableCell>{r.maintenance_type}</TableCell>
													<TableCell>{freqBadge(r.frequency)}</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<span>{r.due_date}</span>
															{isDueToday(r.due_date) && (
																<Badge variant="outline" className="text-xs bg-blue-50">
																	Today
																</Badge>
															)}
														</div>
													</TableCell>
																<TableCell className="max-w-60 truncate">{r.assigned_engineers ?? "—"}</TableCell>
													<TableCell>{r.completed_at ? String(r.completed_at).slice(0, 10) : "—"}</TableCell>
													<TableCell>
														<Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															<Button variant="outline" size="sm" onClick={() => openRun(r.run_id)}>
																<Eye className="mr-2 h-4 w-4" /> View
															</Button>
															<Button variant="outline" size="sm" onClick={() => openHistory(r.schedule_id)}>
																<History className="mr-2 h-4 w-4" /> History
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* View Dialog (read-only) */}
			<Dialog open={progressOpen} onOpenChange={setProgressOpen}>
				<DialogContent className="max-w-none w-[min(56rem,calc(100vw-1.5rem))] max-h-[90vh] overflow-hidden sm:resize sm:min-h-130 sm:min-w-180">
					<DialogHeader>
						<DialogTitle>Maintenance Run</DialogTitle>
					</DialogHeader>

					{progressLoading || !runDetail ? (
						<div className="grid gap-3">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-48 w-full" />
						</div>
					) : (
						<div className="grid max-h-[calc(90vh-8rem)] gap-4 overflow-auto pr-1">
							{/* Read-only header */}
							<div className="grid gap-2 rounded-md border p-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="font-medium">
										{runDetail.run.server_code ?? `#${runDetail.run.server_id}`} {runDetail.run.hostname ?? ""}
									</div>
									<Badge variant={statusBadgeVariant(runDetail.run.status)}>{runDetail.run.status}</Badge>
								</div>
								<div className="text-sm text-muted-foreground">
									{runDetail.run.maintenance_type} • {runDetail.run.frequency} • Due {runDetail.run.due_date}
									{isDueToday(runDetail.run.due_date) && (
										<Badge variant="outline" className="ml-2 text-xs bg-blue-50">
											Today
										</Badge>
									)}
								</div>
								<div className="text-xs text-muted-foreground">
									Engineers: {runDetail.engineers.map((e) => e.full_name || e.email || `#${e.engineer_id}`).filter(Boolean).join(", ") || "—"}
								</div>

								<div className="mt-2">
									{(() => {
										const total = runDetail.checklist.length;
										const done = runDetail.checklist.filter((c) => Boolean(c.is_done)).length;
										const percent = pct(done, total);
										return (
											<>
												<div className="flex items-center justify-between text-sm">
													<div>
														{done}/{total} tasks completed
													</div>
													<div className="font-medium">{percent}%</div>
												</div>
												<div className="mt-2 h-2 w-full rounded-full bg-muted">
													<div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
												</div>
											</>
										);
									})()}
								</div>
							</div>

							{/* Checklist */}
							<div className="grid gap-2">
								<div className="text-sm font-medium">Checklist</div>
								<div className="max-h-96 overflow-auto rounded-md border">
									{runDetail.checklist.length === 0 ? (
										<div className="p-4 text-sm text-muted-foreground">No checklist items on this run.</div>
									) : (
										<ul className="divide-y">
											{runDetail.checklist.map((c) => {
												const checked = Boolean(c.is_done);
												return (
													<li
														key={c.checklist_item_id}
														className={`flex items-center justify-between gap-3 p-3 ${checked ? "bg-emerald-50/40" : ""}`}
													>
														<div className={`min-w-0 text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>{c.label}</div>
														<input
															type="checkbox"
															checked={checked}
															disabled={runDetail.run.status === "Complete" || checklistSavingId === c.checklist_item_id}
															onChange={() => toggleChecklistItem(c.checklist_item_id, checked)}
															className="h-4 w-4 cursor-pointer"
														/>
													</li>
												);
											})}
										</ul>
									)}
								</div>
								<div className="text-xs text-muted-foreground">
									{runDetail.run.status === "Complete" ? "Checklist is locked (run complete)." : "Click items to mark done."}
								</div>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button variant="outline" onClick={() => setProgressOpen(false)}>
							Close
						</Button>
						{runDetail && 
						 runDetail.run.status !== "Complete" && 
						 isDueToday(runDetail.run.due_date) && (
							<Button 
								onClick={() => markCompleteById(runDetail.run.run_id)}
								disabled={progressSaving}
							>
								Mark Complete
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* History Dialog */}
			<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
				<DialogContent className="max-w-none w-[min(48rem,calc(100vw-1.5rem))] max-h-[90vh] overflow-auto sm:resize sm:min-h-130 sm:min-w-180">
					<DialogHeader>
						<DialogTitle>Run History</DialogTitle>
					</DialogHeader>

					{historyLoading ? (
						<div className="grid gap-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-4" />
						</div>
					) : historyRows.length === 0 ? (
						<div className="text-sm text-muted-foreground">No history found.</div>
					) : (
						<div className="grid gap-4">
							{activeHistoryRows.length > 0 ? (
								<div className="grid gap-2">
									<div className="text-sm font-medium">Active Record</div>
									{activeHistoryRows.slice(0, 1).map((h) => (
										<div key={h.run_id} className="rounded-md border p-3">
											<div className="flex items-center justify-between gap-2">
												<div className="text-sm font-medium">Due {h.due_date}</div>
												<Badge variant={statusBadgeVariant(h.status)}>{h.status}</Badge>
											</div>
											<div className="mt-1 text-xs text-muted-foreground">
												{Number(h.done_tasks ?? 0)}/{Number(h.total_tasks ?? 0)} ({pct(Number(h.done_tasks ?? 0), Number(h.total_tasks ?? 0))}%)
											</div>
										</div>
									))}
								</div>
							) : null}

							<div className="grid gap-2">
								<div className="text-sm font-medium">Completed History</div>
								{completedHistoryRows.length === 0 ? (
									<div className="text-sm text-muted-foreground">No completed history found.</div>
								) : (
									<div className="grid gap-3">
										{completedHistoryRows.map((h) => {
											const total = Number(h.total_tasks ?? 0);
											const done = Number(h.done_tasks ?? 0);
											const percent = pct(done, total);
											return (
												<div key={h.run_id} className="rounded-md border p-3">
													<div className="flex items-center justify-between gap-2">
														<div className="text-sm font-medium">Due {h.due_date}</div>
														<Badge variant={statusBadgeVariant(h.status)}>{h.status}</Badge>
													</div>
													<div className="mt-1 text-xs text-muted-foreground">
														{done}/{total} ({percent}%) • Completed {h.completed_at ? String(h.completed_at).slice(0, 10) : "—"}
													</div>
													{h.note ? <div className="mt-2 text-sm">{h.note}</div> : null}
												</div>
											);
										})}
									</div>
								)}
							</div>
						</div>
					)}

					<DialogFooter>
						<Button variant="outline" onClick={() => setHistoryOpen(false)}>
							Close
						</Button>
						{canManage && historyScheduleId ? (
							<Button
								onClick={async () => {
									try {
									const latest = completedHistoryRows[0] ?? historyRows[0];
										if (!latest?.run_id) return;
										const res = await api.post(`/api/maintenance-ops/runs/${latest.run_id}/sms/resend`);
										toast.success(`SMS resend triggered (sent=${res.data?.data?.sent ?? 0})`);
									} catch (err) {
										toast.error(getErrorMessage(err, "Failed to resend SMS"));
									}
								}}
							>
								Resend SMS (latest)
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}