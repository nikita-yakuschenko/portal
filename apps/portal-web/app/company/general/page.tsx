"use client";

import { useCallback, useEffect, useState } from "react";
import { IconExternalLink, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";
import { cn } from "@/lib/utils";
import {
  MATERIAL_CATEGORY_LABEL,
  formatPrice,
  type DealerMaterial,
  type FactoryProduct
} from "@/lib/general-section";

const KIND_LABEL: Record<FactoryProduct["kind"], string> = {
  truss: "Фермы на МЗП",
  roof_panel: "Кровельные панели"
};

type ProductDraft = Partial<FactoryProduct> & { kind: FactoryProduct["kind"] };
type MaterialDraft = Partial<DealerMaterial>;

export default function CompanyGeneralPage() {
  const [products, setProducts] = useState<FactoryProduct[]>([]);
  const [materials, setMaterials] = useState<DealerMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<
    { kind: "product" | "material"; id: string; title: string } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const [nextProducts, nextMaterials] = await Promise.all([
        apiFetch<FactoryProduct[]>("/api/company/general/products"),
        apiFetch<DealerMaterial[]>("/api/company/general/materials")
      ]);
      setProducts(nextProducts);
      setMaterials(nextMaterials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить раздел");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProduct() {
    if (!productDraft?.name?.trim()) {
      toast.error("Укажите название позиции");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/company/general/products", {
        method: "POST",
        body: JSON.stringify({
          ...(productDraft.id ? { id: productDraft.id } : {}),
          kind: productDraft.kind,
          name: productDraft.name,
          description: productDraft.description ?? "",
          sizes: productDraft.sizes ?? "",
          imageUrl: productDraft.imageUrl?.trim() || null,
          price: productDraft.price ?? null,
          priceUnit: productDraft.priceUnit ?? "",
          sortOrder: productDraft.sortOrder ?? 0,
          isActive: productDraft.isActive ?? true
        })
      });
      setProductDraft(null);
      await load();
      toast.success("Позиция сохранена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function saveMaterial() {
    if (!materialDraft?.title?.trim() || !materialDraft.url?.trim()) {
      toast.error("Нужны название и ссылка");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/company/general/materials", {
        method: "POST",
        body: JSON.stringify({
          ...(materialDraft.id ? { id: materialDraft.id } : {}),
          title: materialDraft.title,
          description: materialDraft.description ?? "",
          url: materialDraft.url,
          category: materialDraft.category ?? "other",
          sortOrder: materialDraft.sortOrder ?? 0,
          isActive: materialDraft.isActive ?? true
        })
      });
      setMaterialDraft(null);
      await load();
      toast.success("Подборка сохранена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    const path =
      removing.kind === "product"
        ? `/api/company/general/products/${removing.id}`
        : `/api/company/general/materials/${removing.id}`;
    try {
      await apiFetch(path, { method: "DELETE" });
      await load();
      toast.success("Удалено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setRemoving(null);
    }
  }

  async function toggleProduct(product: FactoryProduct, isActive: boolean) {
    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, isActive } : item))
    );
    try {
      await apiFetch("/api/company/general/products", {
        method: "POST",
        body: JSON.stringify({ ...product, isActive })
      });
    } catch (err) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id ? { ...item, isActive: product.isActive } : item
        )
      );
      toast.error(err instanceof Error ? err.message : "Не удалось изменить");
    }
  }

  async function toggleMaterial(material: DealerMaterial, isActive: boolean) {
    setMaterials((prev) =>
      prev.map((item) => (item.id === material.id ? { ...item, isActive } : item))
    );
    try {
      await apiFetch("/api/company/general/materials", {
        method: "POST",
        body: JSON.stringify({ ...material, isActive })
      });
    } catch (err) {
      setMaterials((prev) =>
        prev.map((item) =>
          item.id === material.id ? { ...item, isActive: material.isActive } : item
        )
      );
      toast.error(err instanceof Error ? err.message : "Не удалось изменить");
    }
  }

  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/general"
      navigation={companyNavigation}
      title="Общий раздел"
    >
      <PageAlert message={error} variant="destructive" />

      <p className="text-muted-foreground max-w-prose text-sm">
        То, что видят все дилеры в своём «Общем разделе». Дома приезжают из каталога, а фермы,
        кровельные панели и подборки материалов заводятся здесь.
      </p>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Продукция завода</CardTitle>
              <CardDescription>
                Фермы на МЗП и кровельные панели. Выключенные позиции дилерам не показываются.
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  onClick={() => setProductDraft({ kind: "truss", isActive: true, sortOrder: 0 })}
                >
                  <IconPlus />
                  Добавить
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {products.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Позиций пока нет.
                </p>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                      !product.isActive && "bg-muted/30"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{product.name}</p>
                        <Badge variant="secondary" className="font-normal">
                          {KIND_LABEL[product.kind]}
                        </Badge>
                        {product.sizes ? (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {product.sizes}
                          </span>
                        ) : null}
                        {product.price !== null ? (
                          <span className="text-xs tabular-nums">
                            {formatPrice(product.price)} {product.priceUnit}
                          </span>
                        ) : null}
                      </div>
                      {product.description ? (
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                          {product.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={product.isActive}
                        onCheckedChange={(checked) => void toggleProduct(product, checked)}
                        aria-label={product.isActive ? "Скрыть у дилеров" : "Показать дилерам"}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Изменить: ${product.name}`}
                        onClick={() => setProductDraft(product)}
                      >
                        <IconPencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Удалить: ${product.name}`}
                        onClick={() =>
                          setRemoving({ kind: "product", id: product.id, title: product.name })
                        }
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Материалы для дилеров</CardTitle>
              <CardDescription>
                Ссылки на подборки во внешнем облаке. Доступ по ссылке не ограничен — своё
                хранилище появится позже.
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  onClick={() => setMaterialDraft({ category: "media", isActive: true })}
                >
                  <IconPlus />
                  Добавить
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {materials.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">Подборок пока нет.</p>
              ) : (
                materials.map((material) => (
                  <div
                    key={material.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                      !material.isActive && "bg-muted/30"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{material.title}</p>
                        <Badge variant="secondary" className="font-normal">
                          {MATERIAL_CATEGORY_LABEL[material.category] ??
                            MATERIAL_CATEGORY_LABEL.other}
                        </Badge>
                      </div>
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground mt-0.5 inline-flex max-w-full items-center gap-1 text-sm underline-offset-4 hover:underline"
                      >
                        <span className="truncate">
                          {material.url.replace(/^https?:\/\//, "")}
                        </span>
                        <IconExternalLink className="size-3.5 shrink-0" />
                      </a>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={material.isActive}
                        onCheckedChange={(checked) => void toggleMaterial(material, checked)}
                        aria-label={material.isActive ? "Скрыть у дилеров" : "Показать дилерам"}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Изменить: ${material.title}`}
                        onClick={() => setMaterialDraft(material)}
                      >
                        <IconPencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Удалить: ${material.title}`}
                        onClick={() =>
                          setRemoving({ kind: "material", id: material.id, title: material.title })
                        }
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={Boolean(productDraft)} onOpenChange={(next) => !next && setProductDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{productDraft?.id ? "Изменить позицию" : "Новая позиция"}</DialogTitle>
            <DialogDescription>Так её увидят дилеры в общем разделе.</DialogDescription>
          </DialogHeader>

          {productDraft ? (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="product-kind">Раздел</FieldLabel>
                <Select
                  value={productDraft.kind}
                  onValueChange={(value) =>
                    setProductDraft({ ...productDraft, kind: value as FactoryProduct["kind"] })
                  }
                >
                  <SelectTrigger id="product-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truss">Фермы на МЗП</SelectItem>
                    <SelectItem value="roof_panel">Кровельные панели</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="product-name">Название</FieldLabel>
                <Input
                  id="product-name"
                  value={productDraft.name ?? ""}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, name: event.target.value })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="product-description">Описание</FieldLabel>
                <Textarea
                  id="product-description"
                  rows={3}
                  value={productDraft.description ?? ""}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, description: event.target.value })
                  }
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="product-sizes">Типоразмеры</FieldLabel>
                  <Input
                    id="product-sizes"
                    placeholder="6х6, 7х7, 8х8"
                    value={productDraft.sizes ?? ""}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, sizes: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-order">Порядок</FieldLabel>
                  <Input
                    id="product-order"
                    inputMode="numeric"
                    value={String(productDraft.sortOrder ?? 0)}
                    onChange={(event) =>
                      setProductDraft({
                        ...productDraft,
                        sortOrder: Number(event.target.value.replace(/\D/g, "")) || 0
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-price">Цена</FieldLabel>
                  <Input
                    id="product-price"
                    inputMode="numeric"
                    placeholder="4200"
                    value={productDraft.price === null ? "" : String(productDraft.price ?? "")}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "");
                      setProductDraft({
                        ...productDraft,
                        price: digits ? Number(digits) : null
                      });
                    }}
                  />
                  <FieldDescription>Пусто — цена по запросу.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-unit">За что цена</FieldLabel>
                  <Input
                    id="product-unit"
                    placeholder="за м²"
                    value={productDraft.priceUnit ?? ""}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, priceUnit: event.target.value })
                    }
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="product-image">Ссылка на картинку</FieldLabel>
                <Input
                  id="product-image"
                  placeholder="https://…"
                  value={productDraft.imageUrl ?? ""}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, imageUrl: event.target.value })
                  }
                />
                <FieldDescription>Не обязательно — без неё карточка будет текстовой.</FieldDescription>
              </Field>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDraft(null)}>
              Отмена
            </Button>
            <Button disabled={saving} onClick={() => void saveProduct()}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(materialDraft)}
        onOpenChange={(next) => !next && setMaterialDraft(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{materialDraft?.id ? "Изменить подборку" : "Новая подборка"}</DialogTitle>
            <DialogDescription>Ссылка откроется у дилера в новой вкладке.</DialogDescription>
          </DialogHeader>

          {materialDraft ? (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="material-title">Название</FieldLabel>
                <Input
                  id="material-title"
                  value={materialDraft.title ?? ""}
                  onChange={(event) =>
                    setMaterialDraft({ ...materialDraft, title: event.target.value })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="material-url">Ссылка</FieldLabel>
                <Input
                  id="material-url"
                  type="url"
                  placeholder="https://disk.yandex.ru/d/…"
                  value={materialDraft.url ?? ""}
                  onChange={(event) =>
                    setMaterialDraft({ ...materialDraft, url: event.target.value })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="material-category">Что внутри</FieldLabel>
                <Select
                  value={materialDraft.category ?? "other"}
                  onValueChange={(value) =>
                    setMaterialDraft({ ...materialDraft, category: value })
                  }
                >
                  <SelectTrigger id="material-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MATERIAL_CATEGORY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="material-description">Пояснение</FieldLabel>
                <Textarea
                  id="material-description"
                  rows={2}
                  value={materialDraft.description ?? ""}
                  onChange={(event) =>
                    setMaterialDraft({ ...materialDraft, description: event.target.value })
                  }
                />
              </Field>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDraft(null)}>
              Отмена
            </Button>
            <Button disabled={saving} onClick={() => void saveMaterial()}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(next) => !next && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.title} исчезнет у всех дилеров. Чтобы просто спрятать, хватит
              переключателя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
