import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { config } from "../config.js";

export type UploadPurpose = "messenger" | "dealer_material";

const DISK_ROOT = path.resolve(process.cwd(), "uploads");

/** Лимиты и MIME — единая точка для API и UI. */
export const UPLOAD_LIMITS = {
  messenger: {
    maxBytes: 10 * 1024 * 1024,
    maxFiles: 10,
    mimePrefixes: ["image/", "video/", "audio/"] as const,
    mimeExact: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/x-7z-compressed",
      "application/octet-stream"
    ])
  },
  dealer_material: {
    maxBytes: 50 * 1024 * 1024,
    maxFiles: 1,
    mimePrefixes: ["image/", "video/", "audio/"] as const,
    mimeExact: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream"
    ])
  }
} as const;

const SIGNED_GET_TTL_SEC = 15 * 60;

function s3Enabled() {
  return Boolean(
    config.s3.endpoint && config.s3.bucket && config.s3.accessKey && config.s3.secretKey
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    if (!s3Enabled()) {
      throw new Error("S3 не настроен (S3_ENDPOINT / S3_BUCKET / ключи)");
    }
    client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey
      }
    });
  }
  return client;
}

export function isObjectStorageConfigured() {
  return s3Enabled();
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.\-а-яА-ЯёЁ ]+/gi, "_").slice(0, 120) || "file";
}

export function assertAllowedUpload(purpose: UploadPurpose, mimeType: string, byteSize: number) {
  const limits = UPLOAD_LIMITS[purpose];
  if (byteSize <= 0) throw new Error("Пустой файл");
  if (byteSize > limits.maxBytes) {
    throw new Error(
      purpose === "messenger" ? "Файл больше 10 МБ" : "Файл больше 50 МБ"
    );
  }
  const mime = (mimeType || "application/octet-stream").toLowerCase();
  const okPrefix = limits.mimePrefixes.some((prefix) => mime.startsWith(prefix));
  if (!okPrefix && !limits.mimeExact.has(mime)) {
    throw new Error("Этот тип файла не поддерживается");
  }
}

export function buildObjectKey(purpose: UploadPurpose, safeName: string, ownerId: string) {
  const id = randomUUID();
  if (purpose === "messenger") {
    return `messenger/${ownerId}/${id}-${safeName}`;
  }
  return `dealer-materials/${ownerId}/${id}-${safeName}`;
}

async function putToDisk(key: string, body: Buffer, contentType: string) {
  const fullPath = path.join(DISK_ROOT, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
  // contentType на диске не храним — только в БД
  void contentType;
}

async function deleteFromDisk(key: string) {
  try {
    await unlink(path.join(DISK_ROOT, key));
  } catch {
    /* уже нет */
  }
}

export async function putObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  if (s3Enabled()) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType
      })
    );
    return;
  }
  await putToDisk(input.key, input.body, input.contentType);
}

export async function deleteObject(key: string) {
  if (s3Enabled()) {
    try {
      await getClient().send(
        new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key })
      );
    } catch {
      /* объект мог уже исчезнуть */
    }
    return;
  }
  await deleteFromDisk(key);
}

export async function assertObjectExists(key: string) {
  if (s3Enabled()) {
    await getClient().send(
      new HeadObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    return;
  }
  await access(path.join(DISK_ROOT, key));
}

/** Signed GET к Garage/S3. Для браузера нужен S3_PUBLIC_ENDPOINT (иначе только stream через API). */
export async function createSignedGetUrl(key: string, fileName: string) {
  if (!s3Enabled()) {
    return null;
  }
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
  });
  const url = await getSignedUrl(getClient(), command, { expiresIn: SIGNED_GET_TTL_SEC });
  // Подмена endpoint для клиента, если Garage снаружи недоступен по внутреннему DNS
  if (config.s3.publicEndpoint && config.s3.endpoint) {
    return url.replace(config.s3.endpoint.replace(/\/$/, ""), config.s3.publicEndpoint.replace(/\/$/, ""));
  }
  return url;
}

export async function openObjectStream(key: string): Promise<{
  body: Readable;
  contentType?: string | undefined;
}> {
  if (s3Enabled()) {
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    if (!result.Body) throw new Error("Пустой объект в хранилище");
    const body = result.Body as Readable;
    return {
      body,
      ...(result.ContentType ? { contentType: result.ContentType } : {})
    };
  }
  return { body: createReadStream(path.join(DISK_ROOT, key)) };
}

/** Короткоживущая ссылка на наш API (cookie не нужна) — для «открыть в новой вкладке». */
export function createApiSignedDownloadPath(
  kind: "messenger" | "dealer_material",
  id: string
) {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_GET_TTL_SEC;
  const payload = `${kind}:${id}:${exp}`;
  const sig = createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
  const base =
    kind === "messenger"
      ? `/api/messenger/attachments/${id}/signed`
      : `/api/partner/general/materials/${id}/signed`;
  return `${base}?exp=${exp}&sig=${sig}`;
}

export function verifyApiSignedDownload(
  kind: "messenger" | "dealer_material",
  id: string,
  expRaw: string,
  sig: string
) {
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    throw new Error("Ссылка устарела");
  }
  const payload = `${kind}:${id}:${exp}`;
  const expected = createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Неверная подпись");
  }
}
