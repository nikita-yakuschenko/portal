import { z } from "zod";

export const partnerSiteConfigSchema = z.object({
  siteId: z.string().min(1),
  partnerId: z.string().min(1),
  brand: z.object({
    title: z.string().min(1),
    phone: z.string().min(1),
    email: z.email(),
    address: z.string().optional()
  }),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional()
  }),
  analytics: z.object({
    yandexMetrikaCounter: z.string().optional(),
    googleTagManagerId: z.string().optional()
  }),
  cta: z.object({
    primaryLabel: z.string().default("Запросить цену"),
    inquiryEmail: z.email().optional()
  })
});

export type PartnerSiteConfig = z.infer<typeof partnerSiteConfigSchema>;
