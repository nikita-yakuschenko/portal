/** Тексты шаринга проекта (Telegram / navigator.share) со склонениями. */

export type ProjectShareInput = {
  name: string;
  technology: "modular" | "panel_frame" | string;
  floors?: number | null;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: string | number | null | undefined;
};

/** 1 → one, 2–4 → few, 5+ / 11–14 → many */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const n10 = abs % 10;
  const n100 = abs % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

function floorsGenitive(floors: number | null | undefined): string | null {
  if (floors == null || floors <= 0) return null;
  if (floors === 1) return "одноэтажного";
  if (floors === 2) return "двухэтажного";
  if (floors === 3) return "трёхэтажного";
  if (floors === 4) return "четырёхэтажного";
  if (floors === 5) return "пятиэтажного";
  return `${floors}-этажного`;
}

function technologyGenitive(technology: string): string {
  return technology === "panel_frame" ? "панельно-каркасного" : "модульного";
}

export function parseBathroomCount(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  const match = String(value).trim().match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatArea(area: number | null | undefined): string | null {
  if (area == null || !Number.isFinite(area) || area <= 0) return null;
  const rounded = Number.isInteger(area) ? String(area) : String(area).replace(".", ",");
  return `${rounded} м²`;
}

export function formatBedrooms(count: number | null | undefined): string | null {
  if (count == null || count <= 0) return null;
  return `${count} ${pluralRu(count, "спальня", "спальни", "спален")}`;
}

export function formatBathrooms(value: string | number | null | undefined): string | null {
  const count = parseBathroomCount(value);
  if (count == null) return null;
  return `${count} ${pluralRu(count, "сан. узел", "сан. узла", "сан. узлов")}`;
}

/** Первая строка: «Проект … дома {name} от {company}.» */
export function projectShareTitle(project: ProjectShareInput, companyName: string): string {
  const parts: string[] = ["Проект"];
  const floors = floorsGenitive(project.floors);
  if (floors) parts.push(floors);
  parts.push(technologyGenitive(project.technology));
  parts.push("дома");

  const name = project.name.trim();
  if (name) parts.push(name);

  const company = companyName.trim();
  let sentence = parts.join(" ");
  if (company) sentence += ` от ${company}`;
  return `${sentence}.`;
}

/** Вторая строка: площадь, спальни, санузлы */
export function projectShareDescription(project: ProjectShareInput): string {
  const chunks: string[] = [];
  const area = formatArea(project.area);
  if (area) chunks.push(area);

  const bedrooms = formatBedrooms(project.bedrooms);
  if (bedrooms) chunks.push(`количество спален ${bedrooms}`);

  const bathrooms = formatBathrooms(project.bathrooms);
  if (bathrooms) chunks.push(bathrooms);

  return chunks.join(", ");
}

export function projectShareCopy(project: ProjectShareInput, companyName: string): {
  title: string;
  description: string;
  text: string;
} {
  const title = projectShareTitle(project, companyName);
  const description = projectShareDescription(project);
  return {
    title,
    description,
    text: description ? `${title}\n${description}` : title
  };
}
