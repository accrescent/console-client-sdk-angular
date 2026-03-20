// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { GENERATED_ROOTS } from "./generatedRoots.ts";

const PACKAGE_NAME = process.env.npm_package_name!;

async function findTsFiles(directory: string): Promise<Map<string, string[]>> {
    const dirToTsFiles = new Map<string, string[]>();

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            (await findTsFiles(path)).forEach((files, dir) => {
                const existingFiles = dirToTsFiles.get(dir) ?? [];
                existingFiles.push(...files);

                dirToTsFiles.set(dir, existingFiles);
            });
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            const parentDirFiles = dirToTsFiles.get(entry.parentPath) ?? [];
            parentDirFiles.push(path);

            dirToTsFiles.set(entry.parentPath, parentDirFiles);
        }
    }

    return dirToTsFiles;
}

for (const root of GENERATED_ROOTS) {
    for (const [packageDir, files] of await findTsFiles(root)) {
        // Rewrite cross-entry-point relative imports to package imports. Since entry points are
        // flat (no subdirectories), any import starting with "../" necessarily targets a different
        // entry point.
        for (const file of files) {
            const filePath = join(packageDir, file.split("/").pop()!);
            const content = await readFile(filePath, "utf-8");
            const rewritten = content.replace(/from "(\.\.\/.+)"/g, (_, importPath) => {
                const resolved = join(packageDir, importPath);
                const targetDir = resolved.slice(0, resolved.lastIndexOf("/"));
                return `from "${PACKAGE_NAME}/${targetDir}"`;
            });

            await writeFile(filePath, rewritten);
        }

        // Write the ng-packagr entry point for this directory
        const exports = files
            .map((path) => `${path.split("/").pop()!.replace(/\.ts$/, "")}`)
            .map((relativeImport) => `export * from "./${relativeImport}";`)
            .join("\n");
        await writeFile(join(packageDir, "public_api.ts"), `${exports}\n`);

        // Write the ng-package.json config for this entry point
        await writeFile(
            join(packageDir, "ng-package.json"),
            `${JSON.stringify({ lib: { entryFile: "public_api.ts" } })}\n`,
        );
    }
}
