-- Migration: Add ball_brand and referee_phone columns to tournaments
-- Date: 2026-07-02

ALTER TABLE "public"."tournaments" ADD COLUMN IF NOT EXISTS "ball_brand" text;
ALTER TABLE "public"."tournaments" ADD COLUMN IF NOT EXISTS "referee_phone" text;
