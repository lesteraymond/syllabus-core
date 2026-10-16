// Prepares a profile photo in the browser: center-crop to a square, downscale to 256x256, export WebP (JPEG fallback).
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const SIZE = 256;

export async function prepareAvatar(file) {
  if (!AVATAR_ACCEPT.split(',').includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is over 5 MB. Choose a smaller one.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That file could not be read as an image.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close?.();

  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/webp', 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.88); // browsers without WebP export
  if (!blob) throw new Error('Could not process that image.');
  return new File([blob], blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg', { type: blob.type });
}
