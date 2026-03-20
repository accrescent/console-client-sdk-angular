// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { rm } from "node:fs/promises";

import { GENERATED_ROOTS } from "./generatedRoots.ts";

for (const dir of GENERATED_ROOTS) {
    await rm(dir, { force: true, recursive: true });
}
