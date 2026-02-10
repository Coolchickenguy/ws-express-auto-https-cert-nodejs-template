import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { resolve } from "path";
const config = getConfig();
// @ts-expect-error
import greenlock from "@root/greenlock";
import { getConfig } from "./config.js";
const configPath = resolve(fileURLToPath(import.meta.url), "../../config.json");
const packageJsonPath = resolve(
  fileURLToPath(import.meta.url),
  "../../package.json",
);
let inst: any;
const root = resolve(fileURLToPath(import.meta.url), "../../");
export async function setup() {
  const { name, version }: { name: string; version: number } = JSON.parse(
    readFileSync(packageJsonPath).toString(),
  );
  const { maintainerEmail }: { maintainerEmail: string } = JSON.parse(
    readFileSync(configPath).toString(),
  );
  inst = greenlock.create({
    maintainerEmail,
    packageAgent: name + "/" + version,
    packageRoot: root,
  });
  await inst.manager.defaults({
    agreeToTerms: true,
    subscriberEmail: maintainerEmail,
    challenges: {
      "http-01": {
        module: fileURLToPath(import.meta.resolve("./http01auth.cjs")),
      },
    },
  });
}
// Wrappers around greenlock's methods that mainly ADD TYPINGS
export function addSite<
  const subject extends string,
  const altnames extends string[] = [subject],
>(
  subject: subject,
  altnames?: altnames,
): Promise<{ subject: subject; altnames: altnames; renewAt: number }> {
  if (
    !Array.isArray(altnames) ||
    !(altnames.length > 0) ||
    altnames.findIndex((v) => typeof v !== "string") !== -1
  ) {
    altnames = [subject] as any;
  }
  const out = inst.add({ subject, altnames });
  return out;
}
export function removeSite(subject: string): Promise<void> {
  return inst.remove({ subject });
}
export function getCerts(subject: string): { key: Buffer; cert: Buffer } {
  let certDir: string;
  const certPaths = () => {
    return {
      cert: resolve(certDir, "fullchain.pem"),
      key: resolve(certDir, "privkey.pem"),
    };
  };
  const certValues = () =>
    Object.fromEntries(
      Object.entries(certPaths()).map(([key, value]): [string, Buffer] => [
        key,
        readFileSync(value),
      ]),
    ) as { key: Buffer; cert: Buffer };
  if (!config.doCert) {
    certDir = "./assets/defaultCerts";
  } else {
    const { configDir } = JSON.parse(readFileSync("./.greenlockrc").toString());

    certDir = resolve(configDir, "live", subject);
  }
  return certValues();
}
