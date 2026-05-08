import { lstat, mkdir, mkdtemp, readlink, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addIntellijLink } from "../src/links.js";

async function createGeneratedIntellijDir(root: string): Promise<string> {
  const intellijDir = path.join(root, "generated", "intellij");
  await mkdir(intellijDir, { recursive: true });
  await writeFile(path.join(intellijDir, "users.http"), "GET https://example.com\n", "utf-8");
  await writeFile(path.join(intellijDir, "http-client.env.json"), "{}\n", "utf-8");
  return intellijDir;
}

describe("addIntellijLink", () => {
  it("creates a directory symlink to generated IntelliJ files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-link-"));
    const intellijDir = await createGeneratedIntellijDir(tempDir);
    const linkPath = path.join(tempDir, "http");

    const createdLink = await addIntellijLink({
      out: path.join(tempDir, "generated"),
      linkPath,
      force: false
    });

    const linkStats = await lstat(createdLink);
    expect(linkStats.isSymbolicLink()).toBe(true);
    expect(path.resolve(path.dirname(linkPath), await readlink(linkPath))).toBe(intellijDir);
  });

  it("does nothing when the link already points to the generated IntelliJ directory", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-link-"));
    const intellijDir = await createGeneratedIntellijDir(tempDir);
    const linkPath = path.join(tempDir, "http");
    await symlink(intellijDir, linkPath, "dir");

    await expect(
      addIntellijLink({
        out: path.join(tempDir, "generated"),
        linkPath,
        force: false
      })
    ).resolves.toBe(linkPath);
  });

  it("refuses to replace a real directory", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openkit-link-"));
    await createGeneratedIntellijDir(tempDir);
    const linkPath = path.join(tempDir, "http");
    await mkdir(linkPath);

    await expect(
      addIntellijLink({
        out: path.join(tempDir, "generated"),
        linkPath,
        force: true
      })
    ).rejects.toThrow("is not a symlink");
  });
});
