import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadPath = path.resolve(__dirname, '../../', config.uploadDir);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const maxFileSizeBytes = config.maxFileSizeMb * 1024 * 1024;

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid image type. Allowed: JPEG, PNG, WebP', 400, 'INVALID_IMAGE'), false);
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxFileSizeBytes },
});

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(`Image too large. Max size: ${config.maxFileSizeMb}MB`, 400, 'INVALID_IMAGE'));
    }
    return next(new AppError(err.message, 400, 'INVALID_IMAGE'));
  }
  next(err);
}
