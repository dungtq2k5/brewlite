-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name_en" VARCHAR(60) NOT NULL,
    "name_vi" VARCHAR(60) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
