import cFs from 'fs';
import path from 'path';

const fs = cFs.promises;

const dist = path.resolve(__dirname, '..', 'dist');

async function removeDist(pth: string) {
  const files = await fs.readdir(pth);

  for (let file of files) {
    if ((await fs.stat(path.resolve(pth, file))).isFile()) {
      await fs.unlink(path.resolve(pth, file));
    } else {
      await removeDist(path.resolve(pth, file));
    }
  }
  await fs.rmdir(pth);
}

removeDist(dist);