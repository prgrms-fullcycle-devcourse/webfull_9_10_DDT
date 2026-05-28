-- CreateTable
CREATE TABLE "USER" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "provider_id" TEXT NOT NULL,
    "profile_image" TEXT NOT NULL,
    "is_terms_agreed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "USER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RULE_TEMPLATE" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT,
    "is_saved" BOOLEAN NOT NULL DEFAULT false,
    "focus_min" INTEGER NOT NULL,
    "break_min" INTEGER NOT NULL,
    "rounds" INTEGER NOT NULL,
    "tier_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RULE_TEMPLATE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PENALTY_ITEM" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "PENALTY_ITEM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ROOM" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "template_id" TEXT,
    "password_hash" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "status" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "ROOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ROOM_MEMBER" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_token" TEXT,
    "nickname" TEXT NOT NULL,
    "profile_image" TEXT,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "is_logged_in" BOOLEAN NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gave_up_at" TIMESTAMP(3),

    CONSTRAINT "ROOM_MEMBER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESCAPE_LOG" (
    "id" TEXT NOT NULL,
    "room_member_id" TEXT NOT NULL,
    "escaped_at" TIMESTAMP(3) NOT NULL,
    "returned_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ESCAPE_LOG_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ROOM_RESULT" (
    "room_member_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "total_escape_ms" INTEGER NOT NULL,
    "penalty_tier" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ROOM_RESULT_pkey" PRIMARY KEY ("room_member_id")
);

-- CreateTable
CREATE TABLE "RESULT_PENALTY" (
    "room_member_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "is_revealed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RESULT_PENALTY_pkey" PRIMARY KEY ("room_member_id","content")
);

-- CreateIndex
CREATE UNIQUE INDEX "USER_provider_provider_id_key" ON "USER"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "RULE_TEMPLATE_user_id_title_key" ON "RULE_TEMPLATE"("user_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "ROOM_code_key" ON "ROOM"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ROOM_MEMBER_room_id_user_id_key" ON "ROOM_MEMBER"("room_id", "user_id");

-- AddForeignKey
ALTER TABLE "RULE_TEMPLATE" ADD CONSTRAINT "RULE_TEMPLATE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PENALTY_ITEM" ADD CONSTRAINT "PENALTY_ITEM_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "RULE_TEMPLATE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM" ADD CONSTRAINT "ROOM_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM" ADD CONSTRAINT "ROOM_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "RULE_TEMPLATE"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_MEMBER" ADD CONSTRAINT "ROOM_MEMBER_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ROOM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_MEMBER" ADD CONSTRAINT "ROOM_MEMBER_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESCAPE_LOG" ADD CONSTRAINT "ESCAPE_LOG_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "ROOM_MEMBER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_RESULT" ADD CONSTRAINT "ROOM_RESULT_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "ROOM_MEMBER"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_RESULT" ADD CONSTRAINT "ROOM_RESULT_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ROOM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESULT_PENALTY" ADD CONSTRAINT "RESULT_PENALTY_room_member_id_fkey" FOREIGN KEY ("room_member_id") REFERENCES "ROOM_RESULT"("room_member_id") ON DELETE CASCADE ON UPDATE CASCADE;
