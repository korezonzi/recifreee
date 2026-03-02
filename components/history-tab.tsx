"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { UserSettings } from "@/lib/types";

interface HistoryTabProps {
  settings: UserSettings;
}

interface HistoryRow {
  date: string;
  vendor: string;
  category: string;
  amount: string;
  description: string;
  paymentMethod: string;
}

type SortField = "date" | "amount";
type SortDirection = "asc" | "desc";

function SkeletonRow() {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="p-2">
          <div className="h-4 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

export function HistoryTab({ settings }: HistoryTabProps) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sheets?year=${settings.year}&full=true`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const parsed: HistoryRow[] = (data.rows as string[][]).map((row) => ({
        date: row[2] || "", // 発生日
        vendor: row[4] || "", // 取引先
        category: row[5] || "", // 勘定科目
        amount: row[7] || "", // 金額
        description: row[10] || "", // 備考
        paymentMethod: row[15] || "", // 決済口座
      }));
      setRows(parsed);
      setLoaded(true);
    } catch {
      setRows([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [settings.year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Available months
  const months = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        set.add(r.date.slice(0, 7));
      }
    });
    return Array.from(set).sort();
  }, [rows]);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Filtered and sorted
  const filteredRows = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.vendor.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }

    if (monthFilter !== "all") {
      result = result.filter((r) => r.date.startsWith(monthFilter));
    }

    if (categoryFilter !== "all") {
      result = result.filter((r) => r.category === categoryFilter);
    }

    result = [...result].sort((a, b) => {
      if (sortField === "date") {
        const cmp = a.date.localeCompare(b.date);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const aNum = parseFloat(a.amount) || 0;
      const bNum = parseFloat(b.amount) || 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [rows, search, monthFilter, categoryFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (loading && !loaded) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          データを読み込み中...
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">発生日</th>
                <th className="p-2 text-left">取引先</th>
                <th className="p-2 text-left">勘定科目</th>
                <th className="p-2 text-right">金額</th>
                <th className="p-2 text-left">備考</th>
                <th className="p-2 text-left">決済口座</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="取引先・備考で検索..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="月" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての月</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="勘定科目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length}件
        </span>
      </div>

      {/* Table */}
      {filteredRows.length === 0 && loaded ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "データがありません"
            : "一致するデータがありません"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1 p-0 text-xs font-medium"
                    onClick={() => toggleSort("date")}
                  >
                    発生日
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </th>
                <th className="p-2 text-left text-xs font-medium">取引先</th>
                <th className="p-2 text-left text-xs font-medium">勘定科目</th>
                <th className="p-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1 p-0 text-xs font-medium"
                    onClick={() => toggleSort("amount")}
                  >
                    金額
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </th>
                <th className="p-2 text-left text-xs font-medium">備考</th>
                <th className="p-2 text-left text-xs font-medium">決済口座</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="p-2 text-xs whitespace-nowrap">{row.date}</td>
                  <td className="p-2 text-xs">{row.vendor}</td>
                  <td className="p-2 text-xs">{row.category}</td>
                  <td className="p-2 text-xs text-right whitespace-nowrap">
                    {row.amount
                      ? `¥${Number(row.amount).toLocaleString()}`
                      : ""}
                  </td>
                  <td className="p-2 text-xs truncate max-w-[200px]">
                    {row.description}
                  </td>
                  <td className="p-2 text-xs">{row.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
