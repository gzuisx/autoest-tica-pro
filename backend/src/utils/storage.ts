import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import path from 'path';

// Se as variáveis R2 estiverem configuradas, usa Cloudflare R2. Caso contrário, usa disco local.
const useCloud = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
);

let s3Client: S3Client | null = null;

if (useCloud) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Faz upload de um arquivo para o armazenamento configurado.
 * Retorna { url, storageKey? }
 * - Se cloud: url pública do R2 + storageKey para deletar depois
 * - Se local: url relativa /uploads/filename
 */
export async function uploadFile(
  localPath: string,
  filename: string,
  mimeType: string,
): Promise<{ url: string; storageKey?: string }> {
  if (useCloud && s3Client) {
    const key = `uploads/${filename}`;
    const fileStream = fs.createReadStream(localPath);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: fileStream,
        ContentType: mimeType,
      },
    });

    await upload.done();

    // Remove arquivo local após upload
    fs.unlinkSync(localPath);

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : `/uploads/${filename}`; // fallback se URL pública não configurada

    return { url: publicUrl, storageKey: key };
  }

  // Armazenamento local (dev)
  return { url: `/uploads/${filename}` };
}

/**
 * Deleta um arquivo do armazenamento.
 */
export async function deleteFile(
  localPath: string,
  storageKey?: string | null,
): Promise<void> {
  if (useCloud && s3Client && storageKey) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: storageKey,
      }),
    );
    return;
  }

  // Disco local
  const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
  const filename = path.basename(localPath);
  const filePath = path.resolve(UPLOAD_DIR, filename);

  if (
    (filePath.startsWith(UPLOAD_DIR + path.sep) || filePath === UPLOAD_DIR) &&
    fs.existsSync(filePath)
  ) {
    fs.unlinkSync(filePath);
  }
}

export { useCloud };
