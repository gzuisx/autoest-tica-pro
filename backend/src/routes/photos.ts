import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const photosRouter = Router();
photosRouter.use(authenticate);

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Garantir que o diretório existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens JPG, PNG e WebP são permitidas'));
    }
  },
});

// POST /api/photos/upload
photosRouter.post('/upload', upload.array('photos', 10), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'Nenhuma foto enviada' });
    return;
  }

  const { serviceOrderId, vehicleId, type = 'other' } = req.body;
  const tenantId = req.user!.tenantId;

  const photos = await Promise.all(
    files.map((file) =>
      prisma.photo.create({
        data: {
          tenantId,
          serviceOrderId: serviceOrderId || undefined,
          vehicleId: vehicleId || undefined,
          type,
          url: `/uploads/${file.filename}`,
        },
      }),
    ),
  );

  res.status(201).json(photos);
});

// DELETE /api/photos/:id
photosRouter.delete('/:id', async (req, res) => {
  const photo = await prisma.photo.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!photo) {
    res.status(404).json({ error: 'Foto não encontrada' });
    return;
  }

  // Remove arquivo do disco
  const filePath = path.join(process.cwd(), photo.url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.photo.delete({ where: { id: req.params.id } });
  res.json({ message: 'Foto removida' });
});
