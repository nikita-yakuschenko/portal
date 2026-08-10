CREATE TYPE "public"."factory_product_kind" AS ENUM('truss', 'roof_panel');--> statement-breakpoint
CREATE TABLE "dealer_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_products" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "factory_product_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sizes" text DEFAULT '' NOT NULL,
	"image_url" text,
	"price" integer,
	"price_unit" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "factory_products_kind_order_idx" ON "factory_products" USING btree ("kind","sort_order");;--> statement-breakpoint

-- Стартовое наполнение: тексты перенесены с дилерского раздела на Tilda,
-- дальше правятся в кабинете HQ
INSERT INTO "factory_products" ("id", "kind", "name", "description", "sizes", "price", "price_unit", "sort_order")
VALUES
	(gen_random_uuid()::text, 'truss', 'Односкатные фермы',
	 'Применяются для устройства односкатных кровель или когда внутри здания есть опора — стена, балки или подстропильные фермы.',
	 '6х6, 7х7, 8х8, 9х9, 10х10', NULL, '', 1),
	(gen_random_uuid()::text, 'truss', 'Двускатные фермы',
	 'Для двускатных кровель, а также как один из типов ферм для вальмовых и полувальмовых кровель.',
	 '6х6, 7х7, 8х8, 9х9, 10х10', NULL, '', 2),
	(gen_random_uuid()::text, 'truss', 'Ножничные фермы',
	 'С подъёмом нижнего пояса — над гостиными, спортивными залами, навесами для машин и павильонами.',
	 '6х6, 7х7, 8х8, 9х9, 10х10', NULL, '', 3),
	(gen_random_uuid()::text, 'truss', 'Вальмовые фермы',
	 'Отличаются от двускатных отсутствием фронтона: вместо него дополнительный скат. Лучше держат ветровую нагрузку и защищают стены от осадков.',
	 '9х12', NULL, '', 4),
	(gen_random_uuid()::text, 'roof_panel', 'Кровельная панель',
	 'В готовую панель входят: стропильная система, контробрешётка для вентиляции межкровельного пространства, обрешётка кровли, утепление 200 мм, пароизоляционная плёнка 200 мкрн, гидро-ветрозащитная кровельная мембрана.',
	 '', 4200, 'за м²', 1);
--> statement-breakpoint

INSERT INTO "dealer_materials" ("id", "title", "description", "url", "category", "sort_order")
VALUES
	(gen_random_uuid()::text, 'Фото и видео проектов',
	 'Съёмки готовых домов и рендеры проектов — для сайта, соцсетей и презентаций.',
	 'https://disk.yandex.ru/d/6IiiQ-KdWdMHkw', 'media', 1);
