import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { uploadFile, deleteFile } from '../utils/storage';

export const photosRouter = Router();
photosRouter.use(authenticate);

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Magic bytes das extensões permitidas
function isValidImageMagicBytes(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.slice(0, 8).equals(pngMagic)) return true;
  // WebP: RIFF....WEBP
  if (buf.slice(0, 4).equals(Buffer.from('RIFF')) && buf.slice(8, 12).equals(Buffer.from('WEBP'))) return true;

  return false;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => {
    cb(null, `${uuidv4()}.img`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
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

  // Validar magic bytes e remover arquivos inválidos
  const validFiles: Express.Multer.File[] = [];
  for (const file of files) {
    if (isValidImageMagicBytes(file.path)) {
      validFiles.push(file);
    } else {
      fs.unlinkSync(file.path);
    }
  }

  if (validFiles.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo de imagem válido enviado' });
    return;
  }

  const { serviceOrderId, vehicleId, type = 'other' } = req.body;
  const tenantId = req.user!.tenantId;

  const photos = await Promise.all(
    validFiles.map(async (file) => {
      const { url, storageKey } = await uploadFile(file.path, file.filename, file.mimetype);

      return prisma.photo.create({
        data: {
          tenantId,
          serviceOrderId: serviceOrderId || undefined,
          vehicleId: vehicleId || undefined,
          type,
          url,
          storageKey: storageKey || null,
        },
      });
    }),
  );

  res.status(201).json(photos);
});

// DELETE /api/photos/:id
photosRouter.delete('/:id', async (req, res) => {
  const photo = await prisma.photo.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!photo) {
    res.status(404).json({ error: 'Foto não encontrada' });
    return;
  }

  await deleteFile(photo.url, photo.storageKey);
  await prisma.photo.delete({ where: { id: String(req.params.id) } });
  res.json({ message: 'Foto removida' });
});
