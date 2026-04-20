import { useState } from "react";
import { Sliders, Plus, Package2, Pencil, Trash2, Check, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useListPackages } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

type CommissionRule = {
  id: number;
  name: string;
  description: string | null;
  packageId: number | null;
  eventType: string;
  beneficiaryType: string;
  percentage: number;
  isActive: boolean;
  createdAt: string;
};

const EVENT_TYPES = ["NEW_SUBSCRIPTION", "RENEWAL", "UPGRADE", "ADD_ON"];
const BENEFICIARY_TYPES = ["SALES", "DISTRIBUTOR"];

function EventBadge({ type, t }: { type: string, t: any }) {
  const colors: Record<string, string> = {
    NEW_SUBSCRIPTION: "bg-emerald-50 text-emerald-700 border-emerald-200",
    RENEWAL: "bg-blue-50 text-blue-700 border-blue-200",
    UPGRADE: "bg-purple-50 text-purple-700 border-purple-200",
    ADD_ON: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[type] ?? ""}`}>
      {t.orderType?.[type as keyof typeof t.orderType] ?? type.replace(/_/g, " ")}
    </Badge>
  );
}

export default function AdminCommissionRules() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { data: packages } = useListPackages();
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", description: "", packageId: "", eventType: "NEW_SUBSCRIPTION",
    beneficiaryType: "SALES", percentage: "10", isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const openCreate = () => {
    setEditingRule(null);
    setForm({ name: "", description: "", packageId: "", eventType: "NEW_SUBSCRIPTION", beneficiaryType: "SALES", percentage: "10", isActive: true });
    setShowDialog(true);
  };

  const openEdit = (rule: CommissionRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      packageId: rule.packageId ? String(rule.packageId) : "",
      eventType: rule.eventType,
      beneficiaryType: rule.beneficiaryType,
      percentage: String(rule.percentage),
      isActive: rule.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const body = {
        name: form.name,
        description: form.description || null,
        packageId: form.packageId ? Number(form.packageId) : null,
        eventType: form.eventType,
        beneficiaryType: form.beneficiaryType,
        percentage: Number(form.percentage),
        isActive: form.isActive,
      };
      const url = editingRule ? `/api/commission-rules/${editingRule.id}` : "/api/commission-rules";
      const method = editingRule ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Unknown error");
      }
      const saved = await res.json();
      if (editingRule) {
        setRules((prev) => prev.map((r) => r.id === saved.id ? saved : r));
      } else {
        setRules((prev) => [saved, ...prev]);
      }
      setShowDialog(false);
      toast({ title: editingRule ? "Rule updated" : "Rule created" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      const token = localStorage.getItem("auth_token");
      await fetch(`/api/commission-rules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: false } : r));
      toast({ title: "Rule deactivated" });
    } catch {
      toast({ title: "Failed to deactivate rule", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.commissionRules.title}</h2>
          <p className="text-muted-foreground mt-1">
            {t.commissionRules.subtitle}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> {t.commissionRules.newRule}
        </Button>
      </div>

      {/* Priority Explanation */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">{t.commissionRules.priorityTitle}</h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li className="flex items-center gap-2"><span className="font-bold bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span> {t.commissionRules.priority1}</li>
            <li className="flex items-center gap-2"><span className="font-bold bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span> {t.commissionRules.priority2}</li>
            <li className="flex items-center gap-2"><span className="font-bold bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span> {t.commissionRules.priority3}</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.commissionRules.activeRules}</CardTitle>
          <CardDescription>{t.commissionRules.activeRulesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <Empty icon={Sliders} title={t.commissionRules.noRules} description={t.commissionRules.noRulesDesc} className="py-12" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.commissionRules.rule}</TableHead>
                  <TableHead>{t.commissionRules.package}</TableHead>
                  <TableHead>{t.commissionRules.eventType}</TableHead>
                  <TableHead>{t.commissionRules.beneficiary}</TableHead>
                  <TableHead className="text-right">{t.commissionRules.rate}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const pkg = packages?.find((p) => p.id === rule.packageId);
                  return (
                    <TableRow key={rule.id} className={!rule.isActive ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && <div className="text-xs text-muted-foreground">{rule.description}</div>}
                      </TableCell>
                      <TableCell>
                        {pkg ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Package2 className="h-3 w-3" />{pkg.name}
                          </Badge>
                        ) : <span className="text-muted-foreground text-sm">{t.commissionRules.allPackages}</span>}
                      </TableCell>
                      <TableCell><EventBadge type={rule.eventType} t={t} /></TableCell>
                      <TableCell>
                        <Badge className={rule.beneficiaryType === "SALES" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"} variant="outline">
                          {t.roles[rule.beneficiaryType as keyof typeof t.roles] ?? rule.beneficiaryType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary" dir="ltr">{rule.percentage}%</TableCell>
                      <TableCell>
                        {rule.isActive
                          ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline"><Check className="h-3 w-3 me-1" />{t.common.statusActive}</Badge>
                          : <Badge className="bg-slate-100 text-slate-500 border-slate-200" variant="outline"><X className="h-3 w-3 me-1" />{t.common.statusInactive}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(rule)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {rule.isActive && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeactivate(rule.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? t.commissionRules.editRule : t.commissionRules.createRuleTitle}</DialogTitle>
            <DialogDescription>
              {t.commissionRules.createRuleDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-start">
            <div>
              <Label>{t.commissionRules.ruleName}</Label>
              <Input className="mt-1.5" placeholder={t.commissionRules.ruleNamePlaceholder} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>{t.commissionRules.descriptionOpt}</Label>
              <Input className="mt-1.5" placeholder={t.commissionRules.descriptionPlaceholder} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.commissionRules.packageOpt}</Label>
                <Select value={form.packageId} onValueChange={(v) => setForm((p) => ({ ...p, packageId: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder={t.commissionRules.allPackages} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.commissionRules.allPackages}</SelectItem>
                    {packages?.filter((p) => p.isActive).map((pkg) => (
                      <SelectItem key={pkg.id} value={String(pkg.id)}>{pkg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.commissionRules.eventTypeLabel}</Label>
                <Select value={form.eventType} onValueChange={(v) => setForm((p) => ({ ...p, eventType: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => <SelectItem key={type} value={type}>{t.orderType[type as keyof typeof t.orderType] ?? type.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.commissionRules.beneficiaryLabel}</Label>
                <Select value={form.beneficiaryType} onValueChange={(v) => setForm((p) => ({ ...p, beneficiaryType: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BENEFICIARY_TYPES.map((type) => <SelectItem key={type} value={type}>{t.roles[type as keyof typeof t.roles] ?? type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.commissionRules.commissionRate}</Label>
                <Input className="mt-1.5" type="number" min="0" max="100" step="0.01" value={form.percentage} onChange={(e) => setForm((p) => ({ ...p, percentage: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} className={locale === "ar" ? "rotate-180" : ""} />
              <Label htmlFor="isActive">{t.commissionRules.ruleIsActive}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={isSaving || !form.name || !form.eventType}>
              {isSaving ? t.commissionRules.saving : editingRule ? t.commissionRules.updateRule : t.commissionRules.createRuleBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
