"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UserSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

function SortableItem({
  id,
  label,
  onRemove,
}: {
  id: string;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-sm"
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1">{label}</span>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SettingsForm() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPayment, setNewPayment] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => toast.error("設定の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(
    async (updated: UserSettings) => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error();
        toast.success("設定を保存しました");
      } catch {
        toast.error("設定の保存に失敗しました");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const addItem = useCallback(
    (
      field: "paymentMethods" | "categories",
      value: string,
      clear: () => void
    ) => {
      if (!value.trim()) return;
      if (settings[field].includes(value.trim())) {
        toast.error("既に存在します");
        return;
      }
      const updated = {
        ...settings,
        [field]: [...settings[field], value.trim()],
      };
      setSettings(updated);
      clear();
      save(updated);
    },
    [settings, save]
  );

  const removeItem = useCallback(
    (field: "paymentMethods" | "categories", index: number) => {
      const updated = {
        ...settings,
        [field]: settings[field].filter((_, i) => i !== index),
      };
      setSettings(updated);
      save(updated);
    },
    [settings, save]
  );

  const handleDragEnd = useCallback(
    (field: "paymentMethods" | "categories") => (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const items = settings[field];
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);

      const updated = {
        ...settings,
        [field]: arrayMove(items, oldIndex, newIndex),
      };
      setSettings(updated);
      save(updated);
    },
    [settings, save]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Year */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">年度</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={String(settings.year)}
            onValueChange={(v) => {
              const updated = { ...settings, year: Number(v) };
              setSettings(updated);
              save(updated);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">決済口座</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem("paymentMethods", newPayment, () =>
                    setNewPayment("")
                  );
                }
              }}
              placeholder="新しい決済口座"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addItem("paymentMethods", newPayment, () => setNewPayment(""))
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd("paymentMethods")}
          >
            <SortableContext
              items={settings.paymentMethods}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {settings.paymentMethods.map((item, i) => (
                  <SortableItem
                    key={item}
                    id={item}
                    label={item}
                    onRemove={() => removeItem("paymentMethods", i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">勘定科目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem("categories", newCategory, () => setNewCategory(""));
                }
              }}
              placeholder="新しい勘定科目"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addItem("categories", newCategory, () => setNewCategory(""))
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd("categories")}
          >
            <SortableContext
              items={settings.categories}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {settings.categories.map((item, i) => (
                  <SortableItem
                    key={item}
                    id={item}
                    label={item}
                    onRemove={() => removeItem("categories", i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          保存中...
        </div>
      )}
    </div>
  );
}
