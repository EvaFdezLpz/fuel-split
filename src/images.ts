// Tratamiento seguro de las imágenes subidas.
// 1. Se comprueba el tipo real por los bytes iniciales (no por la extensión ni el MIME del navegador).
// 2. Se decodifica y se vuelve a codificar como JPEG en un canvas: desaparecen metadatos (EXIF, GPS)
//    y cualquier contenido extra incrustado (ficheros políglota, scripts en SVG, etc.).
// 3. Se limita el tamaño para que quepa en un documento de Firestore.

export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_B64 = 880_000;

export class ImageError extends Error {}

async function sniff(file: Blob): Promise<'jpeg' | 'png' | 'webp' | 'heic' | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  const ascii = String.fromCharCode(...b);
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  if (ascii.slice(4, 8) === 'ftyp' && /heic|heix|mif1|hevc/.test(ascii.slice(8, 12))) return 'heic';
  return null;
}

export interface ProcessedImage {
  base64: string;
  canvas: HTMLCanvasElement;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('La imagen pesa más de 15 MB.');
  const kind = await sniff(file);
  if (!kind) throw new ImageError('El archivo no es una imagen JPG, PNG o WEBP.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(
      kind === 'heic' ? 'Este navegador no abre fotos HEIC. Haz una captura de pantalla o usa la cámara desde la app.' : 'No se pudo leer la imagen.',
    );
  }
  if (bitmap.width < 64 || bitmap.height < 64) throw new ImageError('La imagen es demasiado pequeña para servir de prueba.');

  let maxSide = 1600;
  let quality = 0.78;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('El navegador no permite procesar imágenes.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    const base64 = url.slice(url.indexOf(',') + 1);
    if (base64.length <= MAX_OUTPUT_B64) {
      bitmap.close();
      return { base64, canvas };
    }
    maxSide = Math.round(maxSide * 0.8);
    quality = Math.max(0.5, quality - 0.06);
  }
  bitmap.close();
  throw new ImageError('No se pudo reducir la imagen lo suficiente.');
}

export function jpegSrc(base64: string): string {
  if (!/^\/9j\/[A-Za-z0-9+/=]+$/.test(base64)) return '';
  return `data:image/jpeg;base64,${base64}`;
}
