import { lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";

interface AddIntellijLinkOptions {
  out: string;
  linkPath: string;
  force: boolean;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function resolveSymlinkTarget(linkPath: string, target: string): string {
  return path.resolve(path.dirname(linkPath), target);
}

export async function addIntellijLink(options: AddIntellijLinkOptions): Promise<string> {
  const sourcePath = path.join(path.resolve(options.out), "intellij");
  if (!(await pathExists(sourcePath))) {
    throw new Error(`IntelliJ output does not exist yet: ${sourcePath}. Run generate first.`);
  }

  const absoluteLinkPath = path.resolve(options.linkPath);
  await mkdir(path.dirname(absoluteLinkPath), { recursive: true });

  try {
    const existing = await lstat(absoluteLinkPath);
    if (!existing.isSymbolicLink()) {
      throw new Error(`Link path already exists and is not a symlink: ${absoluteLinkPath}`);
    }

    const currentTarget = resolveSymlinkTarget(absoluteLinkPath, await readlink(absoluteLinkPath));
    if (currentTarget === sourcePath) {
      return absoluteLinkPath;
    }

    if (!options.force) {
      throw new Error(`Link path already points elsewhere: ${absoluteLinkPath}. Use --force to replace it.`);
    }

    await unlink(absoluteLinkPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  await symlink(sourcePath, absoluteLinkPath, "dir");
  return absoluteLinkPath;
}
