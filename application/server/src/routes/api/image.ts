import { promises as fs } from "fs";
import path from "path";

import { Router } from "express";
import { fileTypeFromBuffer } from "file-type";
import httpErrors from "http-errors";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";

// クライアントはJPGで送信、サーバーは .webp 拡張子で保存（getImagePathとの整合）
const SAVE_EXTENSION = "webp";

export const imageRouter = Router();

imageRouter.post("/images", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  const type = await fileTypeFromBuffer(req.body);
  if (type === undefined || type.ext !== "jpg") {
    throw new httpErrors.BadRequest("Invalid file type");
  }

  const imageId = uuidv4();

  const filePath = path.resolve(UPLOAD_PATH, `./images/${imageId}.${SAVE_EXTENSION}`);
  await fs.mkdir(path.resolve(UPLOAD_PATH, "images"), { recursive: true });
  const webpBuffer = await sharp(req.body).webp({ quality: 80 }).toBuffer();
  await fs.writeFile(filePath, webpBuffer);

  // 元のJPGも保存（E2Eテスト等で元フォーマットを参照するケースに対応）
  const jpgPath = path.resolve(UPLOAD_PATH, `./images/${imageId}.jpg`);
  await fs.writeFile(jpgPath, req.body);

  return res.status(200).type("application/json").send({ id: imageId });
});
