#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = process.env.DIABETO_APP_PATH
  ? path.resolve(process.env.DIABETO_APP_PATH)
  : path.join(
      root,
      "build/DerivedData/Build/Products/Release-iphoneos/Diabeto.app",
    );
const outPath = process.env.DIABETO_IPA_OUT
  ? path.resolve(process.env.DIABETO_IPA_OUT)
  : path.join(root, "outputs/Diabeto-latest.ipa");

const bundleId = process.env.DIABETO_BUNDLE_ID || "com.tyandco.diabeto";
const appJson = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const expoConfig = appJson.expo || {};
const buildNumber =
  process.env.DIABETO_BUILD_NUMBER || expoConfig.ios?.buildNumber || "1";
const version = process.env.DIABETO_VERSION || expoConfig.version || "1.0.1";

if (!fs.existsSync(appPath)) {
  console.error(`Missing app bundle: ${appPath}`);
  console.error("Build the iOS Release app before packaging.");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "diabeto-ipa-"));
const payloadDir = path.join(tmp, "Payload");
const appCopy = path.join(payloadDir, path.basename(appPath));
fs.mkdirSync(payloadDir, { recursive: true });
fs.cpSync(appPath, appCopy, { recursive: true });

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: options.stdio || "pipe",
    cwd: options.cwd || root,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
}

function plistBuddy(...commands) {
  const plist = path.join(appCopy, "Info.plist");
  for (const command of commands) {
    run("/usr/libexec/PlistBuddy", ["-c", command, plist]);
  }
}

function plistBuddyOptional(...commands) {
  const plist = path.join(appCopy, "Info.plist");
  for (const command of commands) {
    try {
      run("/usr/libexec/PlistBuddy", ["-c", command, plist]);
    } catch {
      // Optional plist cleanup commands can fail when the source plist shape changes.
    }
  }
}

function removeByName(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.name === name) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) {
      removeByName(entryPath, name);
    }
  }
}

plistBuddy(
  `Set :CFBundleIdentifier ${bundleId}`,
  `Set :CFBundleVersion ${buildNumber}`,
  `Set :CFBundleShortVersionString ${version}`,
);
plistBuddyOptional(
  "Delete :CFBundleURLTypes:0:CFBundleURLSchemes",
  "Add :CFBundleURLTypes:0:CFBundleURLSchemes array",
  "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string diabeto",
  `Add :CFBundleURLTypes:0:CFBundleURLSchemes:1 string ${bundleId}`,
);

const appConfigPath = path.join(appCopy, "EXConstants.bundle/app.config");
if (fs.existsSync(appConfigPath)) {
  const appConfig = JSON.parse(fs.readFileSync(appConfigPath, "utf8"));
  appConfig.ios = appConfig.ios || {};
  appConfig.ios.bundleIdentifier = bundleId;
  delete appConfig.ios.buildNumber;
  if (appConfig.android) {
    delete appConfig.android.package;
  }
  fs.writeFileSync(appConfigPath, JSON.stringify(appConfig));
}

removeByName(appCopy, "_CodeSignature");
fs.rmSync(path.join(tmp, "__MACOSX"), { recursive: true, force: true });

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const tmpIpa = path.join(tmp, path.basename(outPath));
run(
  "/usr/bin/zip",
  [
    "-qry",
    tmpIpa,
    "Payload",
    "-x",
    "*/_CodeSignature/*",
    "-x",
    "*/_CodeSignature",
    "-x",
    "__MACOSX/*",
  ],
  { cwd: tmp },
);
fs.renameSync(tmpIpa, outPath);

const listing = run("/usr/bin/unzip", ["-l", outPath]).toString();
if (/__MACOSX|_CodeSignature/.test(listing)) {
  console.error("Packaged IPA still contains macOS metadata or signatures.");
  process.exit(1);
}

console.log(`Packaged ${outPath}`);
console.log(run("/usr/bin/shasum", ["-a", "256", outPath]).toString().trim());
