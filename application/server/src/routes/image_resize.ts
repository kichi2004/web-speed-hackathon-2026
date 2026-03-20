import { promises as fs } from "fs";
import path from "path";

import { Router } from "express";
import sharp from "sharp";

import { PUBLIC_PATH, UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";

sharp.cache(false);
sharp.concurrency(1);

export const imageResizeRouter = Router();

const ALLOWED_WIDTHS = [40, 80, 192, 245, 490, 494, 960, 1200];

function clampWidth(w: number): number {
  for (const allowed of ALLOWED_WIDTHS) {
    if (w <= allowed) return allowed;
  }
  return ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!;
}

// In-memory cache for resized images (LRU-like, capped at 100 entries)
const MAX_CACHE_SIZE = 100;
const cache = new Map<string, Buffer>();

function cacheSet(key: string, value: Buffer) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

export function clearImageCache() {
  cache.clear();
}

imageResizeRouter.get("/images/{*path}", async (req, res, next) => {
  const wParam = req.query["w"];
  if (wParam == null) return next();

  const width = clampWidth(Number(wParam));
  if (Number.isNaN(width)) return next();

  const imagePathSegs = (req.params as Record<string, string[]>)["path"];
  const imagePath = imagePathSegs?.join("/") ?? "";
  if (imagePath == null) return next();
  const cacheKey = `${imagePath}:${width}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader("Content-Type", "image/avif");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(cached);
  }

  // Try upload path first, then public path
  let filePath = path.resolve(UPLOAD_PATH, "images", imagePath!);
  try {
    await fs.access(filePath);
  } catch {
    filePath = path.resolve(PUBLIC_PATH, "images", imagePath!);
    try {
      await fs.access(filePath);
    } catch {
      return next();
    }
  }

  try {
    const resized = await sharp(filePath)
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 50 })
      .toBuffer();

    cacheSet(cacheKey, resized);

    res.setHeader("Content-Type", "image/avif");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(resized);
  } catch {
    return next();
  }
});