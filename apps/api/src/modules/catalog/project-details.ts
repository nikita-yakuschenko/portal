import type { CatalogTechnology } from "@b2b/domain";

export type CatalogDocKind = "passport" | "spec" | "plan" | "manual" | "other";

export type CatalogProjectDetails = {
  summary?: string;
  mark?: string;
  dimensions?: {
    lengthM?: number;
    widthM?: number;
    label?: string;
  };
  characteristics: Array<{ title: string; value: string }>;
  packages: Array<{
    id: string;
    name: string;
    price?: number;
    description?: string;
  }>;
  optionGroups: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; name: string; note?: string }>;
  }>;
  techDocs: Array<{
    id: string;
    title: string;
    kind: CatalogDocKind;
    status: "available" | "on_request";
    url?: string;
    note?: string;
  }>;
  cargo: {
    modulesNote?: string;
    dimensionsNote?: string;
    weightNote?: string;
    packingNote?: string;
  };
  transport: {
    method?: string;
    leadTimeNote?: string;
    deliveryNote?: string;
    unloadingNote?: string;
    mountingNote?: string;
  };
};

const PACKAGE_NOTES: Record<string, string> = {
  домокомплект: "Заводской комплект для сборки на участке. Базовый состав по спецификации проекта.",
  премиум: "Расширенная комплектация с усиленным составом отделки и инженерной готовности.",
  стандартная: "Базовая заводская комплектация проекта."
};

export function normalizeCatalogTechnology(value: string | null | undefined): CatalogTechnology {
  if (value === "panel_frame" || value === "panel") return "panel_frame";
  if (value === "frame") return "frame";
  return "modular";
}

export function defaultOptionGroups(
  technology: CatalogTechnology
): CatalogProjectDetails["optionGroups"] {
  if (technology === "panel_frame" || technology === "frame") {
    return [
      {
        id: "supply_assembly",
        title: "Поставка и сборка",
        items: [
          {
            id: "domokomplekt",
            name: "Домокомплект",
            note: "Доступно для Нижнего Новгорода и Москвы"
          },
          {
            id: "assembly",
            name: "Сборка",
            note: "Доступно для Нижнего Новгорода и Москвы"
          }
        ]
      },
      {
        id: "partitions",
        title: "Дополнительно",
        items: [
          {
            id: "wood_frame_partitions",
            name: "Изготовление перегородок на деревянном каркасе",
            note: "Доступно для отдельных проектов — уточняйте на заводе"
          }
        ]
      }
    ];
  }

  // Модульные: сводный перечень допов из прайсов (цены зависят от проекта)
  return [
    {
      id: "materials",
      title: "Материалы",
      items: [
        {
          id: "roof_profnastil",
          name: "Настил кровли — крашеный профнастил (только материал)"
        },
        {
          id: "interior_doors",
          name: "Межкомнатные двери (только материал)"
        }
      ]
    },
    {
      id: "structure_finish",
      title: "Конструкции и отделка",
      items: [
        { id: "terrace", name: "Терраса" },
        { id: "floor_csp", name: "Настил пола — ЦСП 10 мм в 2 слоя" },
        { id: "floor_quartz", name: "Настил пола — кварцвинил" },
        { id: "pvc_baseboard", name: "ПВХ плинтуса" },
        { id: "ceiling_beam", name: "Отделка потолка — имитация бруса, сорт АВ" },
        { id: "wall_beam", name: "Отделка стен — имитация бруса, сорт АВ" },
        { id: "paint_1", name: "Внутренняя покраска в 1 слой" },
        { id: "tile_walls", name: "Укладка плитки на стены с/у" },
        { id: "tile_floor", name: "Укладка плитки на пол с/у" }
      ]
    },
    {
      id: "engineering",
      title: "Инженерия",
      items: [
        { id: "heating_convector", name: "Отопление конвекторами" },
        { id: "heating_floor", name: "Отопление водяным тёплым полом" },
        { id: "ventilation", name: "Вентиляция" },
        { id: "plumbing", name: "Водопровод и канализация" },
        { id: "faience", name: "Фаянс" },
        { id: "electric", name: "Электрика" }
      ]
    }
  ];
}

export function defaultTechDocs(projectName: string): CatalogProjectDetails["techDocs"] {
  return [
    {
      id: "passport",
      title: `Паспорт проекта «${projectName}»`,
      kind: "passport",
      status: "on_request",
      note: ""
    },
    {
      id: "spec",
      title: "Спецификация комплектации",
      kind: "spec",
      status: "on_request",
      note: ""
    },
    {
      id: "plan",
      title: "Планировочное решение / экспликация",
      kind: "plan",
      status: "on_request",
      note: ""
    },
    {
      id: "manual",
      title: "Инструкция по монтажу",
      kind: "manual",
      status: "on_request",
      note: ""
    }
  ];
}

export function defaultCargo(_technology: CatalogTechnology): CatalogProjectDetails["cargo"] {
  return {
    modulesNote: "",
    dimensionsNote: "",
    weightNote: "",
    packingNote: ""
  };
}

export function defaultTransport(_technology: CatalogTechnology): CatalogProjectDetails["transport"] {
  return {
    method: "",
    leadTimeNote: "",
    deliveryNote: "",
    unloadingNote: "",
    mountingNote: ""
  };
}

export function buildProjectDetails(input: {
  name: string;
  technology: CatalogTechnology;
  summary?: string;
  mark?: string;
  dimensionsLabel?: string;
  lengthM?: number;
  widthM?: number;
  characteristics?: Array<{ title: string; value: string }>;
  packages?: Array<{ id: string; name: string; price?: number }>;
  pack?: { x?: number; y?: number; z?: number; m?: number };
}): CatalogProjectDetails {
  const packages = (input.packages ?? []).map((item) => {
    const note = PACKAGE_NOTES[item.name.trim().toLowerCase()];
    return note
      ? { ...item, description: note }
      : { id: item.id, name: item.name, ...(item.price !== undefined ? { price: item.price } : {}) };
  });

  const cargo = defaultCargo(input.technology);
  if (input.pack && (input.pack.x || input.pack.y || input.pack.z || input.pack.m)) {
    cargo.dimensionsNote = `Упаковка L×W×H: ${input.pack.x ?? "—"} × ${input.pack.y ?? "—"} × ${input.pack.z ?? "—"} м`;
    if (input.pack.m) {
      cargo.weightNote = `Масса упаковки: ${input.pack.m} кг`;
    }
  }
  const details: CatalogProjectDetails = {
    characteristics: input.characteristics ?? [],
    packages,
    optionGroups: defaultOptionGroups(input.technology),
    techDocs: defaultTechDocs(input.name),
    cargo,
    transport: defaultTransport(input.technology)
  };

  if (input.summary) details.summary = input.summary;
  if (input.mark) details.mark = input.mark;
  if (input.dimensionsLabel || input.lengthM || input.widthM) {
    details.dimensions = {};
    if (input.dimensionsLabel) details.dimensions.label = input.dimensionsLabel;
    if (input.lengthM !== undefined) details.dimensions.lengthM = input.lengthM;
    if (input.widthM !== undefined) details.dimensions.widthM = input.widthM;
  }

  return details;
}
