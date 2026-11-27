import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { extname, join, relative, resolve } from "node:path";

const VERSION = 9;
const CACHE_PATH = resolve("dist", ".test-results-cache.json");
const DATA_DIRECTORIES = ["catalogs", "data", "docs"];
const DATA_SCOPE_KNOWLEDGE = 1;
const DATA_SCOPE_IMPORT = 2;
const DATA_SCOPE_ALL = 4;
const DATA_SCOPE_RULES = 8;
const DATA_SCOPE_EDITORIAL_SOURCE = 16;
const AUDITED_FILESYSTEM_GRAPHS = new Map([
  ["dist/preparation/classification/mapping.test.js", { digest: "e21dd9e31d72c874ac945901aa8c5d37657be292abd59d14facf2ea9344d5aa3", syntaxDigest: "5f2e335137dab6a2cad78d0bf6a646f3ec7396b7ecabc4967d7b9d4de56c9a03", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/editorial/core/reusable-editorial-architecture.test.js", { digest: "739cdcf1cbd349ff88ce55f567aafb6c402d2bf970b74b6de388f368f60f6a24", syntaxDigest: "daa430a83627aaf8a7f51e3342d7198a772868a0ab45860c3f0ed8a262dd9cc4", scope: DATA_SCOPE_ALL | DATA_SCOPE_EDITORIAL_SOURCE }],
  ["dist/preparation/tests/catalog-publication-consistency.test.js", { digest: "fbf020b1259b7c5b88ec28c3ad2f7d3b755ef61397eb520139778effe6567fec", syntaxDigest: "305fe826926a9c693f624bc02ca0950f265e5970759133e1ceff7925eeb07ea5", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/evidence/technical-provenance-evidence-reconciliation.test.js", { digest: "7228eadf2ba47e69dabed49efc02717cf6816bd966e38e8ebb05148e4d85a405", syntaxDigest: "5d980e609972526c4f436718ca6e9764db1f534c542e06157894cf63d015649d", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/evidence/technical-provenance-gray-document-references.test.js", { digest: "840a3a5a32c5d0b60b9e1cb3691ceace5ee627b53d2a73a4b66f854f739abb6a", syntaxDigest: "261b686e0fd4cb0817897cd805b32d69d9c37fbfae93f7242895040ee755e4cf", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/evidence/technical-provenance-gray-evidence-corrections.test.js", { digest: "f3ef6a62777208b80d9c4545b67cad752aa99614cec1a1ded454d6d93486008b", syntaxDigest: "c1a6c6ba1c8f44f9bca65f9bd061a9875a032da9aded9eb188310e60fbfc12b6", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/evidence/technical-provenance-gray-evidence.test.js", { digest: "75ed433194ef62588ab56f62da7dc4c40228a67c915e13c6301d64ad1b921f5b", syntaxDigest: "fe9ac923b5061d3835b41cb94d0569008f533c634cc13bc54ea67f24799bc882", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/evidence/technical-provenance-gray-verified-lot-models.test.js", { digest: "e0d804f7d75f5c86d2b30684276508b5ac11a5c7a465f3fe6dabe09b1b936f31", syntaxDigest: "9d17c08b249a2d58bca58d7392fa288cb68e22aef19c91fd023683438d4b5ee0", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-alfa-spider-variants.test.js", { digest: "94b61b3b3d198c0dbe43a3109f8729e1c2b39a2a44b1a1ec3e05f607f1341930", syntaxDigest: "65a29ee6583024bef8d8dfea81674bffef59440f6b2d08b66b7dfa5d4da7fe4f", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-b-lift-primary-document.test.js", { digest: "a0a18fa8713fa9faa7e4ce9d7de2646ad2e50227012fd6b5690d0d35d156adf1", syntaxDigest: "9f1279f5186a29b9805cb22430c1c44219b2005b10f501077793e0370b01b5c0", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-genie-2019-platform-length.test.js", { digest: "b330565310462d50a45ff5976540764bee5c6e85a378e1c6abaf1307c2f0828e", syntaxDigest: "beb0e419ca8075c4adecf78fc74a86dd4964eb81643e81293cdb224ccf95715f", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-genie-gr15-standard-platform.test.js", { digest: "dc032e9fd0c4a4fea0df95e439b0c98ed56c663ed085bd9c06bbb6c48839f0be", syntaxDigest: "6d49099462f580d3bb71dc37c9b75687ff9a177e79e4357135379f4e8e063f75", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-genie-manitou-53.test.js", { digest: "c1d1c597420ace85a0cc4b47f5c7bb6c3ed0c7d1c95706c3d3115ef165dc8fb5", syntaxDigest: "9b5fcca6e281e123979aa3d338638b0fdc0aa1c1076f11d10fcd1db723aa901b", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-genie-reach-edition.test.js", { digest: "77acce05c90d719a4ca00bd4958f3bb1f95973b964769fb907fc2df5476a136b", syntaxDigest: "666b26bfbfc74fca2e56dbdc2f2d5230be53cca1bf1631904c5517653e1ce589", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-gray-model-evidence.test.js", { digest: "232a3f1043fa65e78346075d3dbb79f3e79e1a96372988ca281708c16f2b0f84", syntaxDigest: "d239d0fa5981b45b622be810e6855b40677b4377818a2c1a8f7338fff590d533", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-jlg-1930es-55.test.js", { digest: "30783691a0db4b72dcfe9c9b4935774ff0828b4da89b5023ff6239a7dac8221f", syntaxDigest: "921868e86a9a1ab1dbad736354d448dc285967a46280fc404e3e883498bcae53", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-manufacturer-editions.test.js", { digest: "ae43aaf16e07002840fa98bcb330d73a3712e282d5f38d3ddb40eac115528095", syntaxDigest: "b496b5d9c307f23ab39413009acdb5c8afe979c4556c3d299b5b74025e1b1854", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-manufacturer-identity-evidence.test.js", { digest: "33c602820458e794b0e3b68a51cf27fd02d66fa3d1d2a34a950f339aef76043f", syntaxDigest: "7cc1a34dbf025f6c941b122931c0875b8b94a99edab468bc04f6b3464fa3fd52", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-model-source-validation.test.js", { digest: "57067eecab9ea127883429bf1973c19fd53f973223a2d9df7b871203a161171a", syntaxDigest: "e770ff2b5951f852bde9d7a807023205b6a464003ab5ae02aa87410d4acac416", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-panther-hydraulic-elevation.test.js", { digest: "7e3daf195b7c56ce6259a7dc36cc6239ec20e374dcecf5b2b00dbd11eb8b25be", syntaxDigest: "87d434db945982a0e91df61c98098e38eb376a4ee951c7802bb1f573c54ddd94", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/models/technical-provenance-xcmg-verified-facts.test.js", { digest: "cb4767b278bd06741ed3e29489a12a19770c808cd8836cd7754311b1c943a5c0", syntaxDigest: "b3c3d436de7fef6a15de5d5b2bf30784125bea758347002148b0a06eebfd475f", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-gray-coverage.test.js", { digest: "ab2f6c8d5b0733760cf63d45a21c088508b5d5a796cc9a75adcd3c28fec7fed1", syntaxDigest: "a4d96f21d3598fdcfac095ef39addae0f166981e6005167b79f674a9da204938", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-gray-final-boundaries.test.js", { digest: "23b3030c35be9cf52db0903471d5f9c8c508576f864757f44dcde537189cbdee", syntaxDigest: "71000a0dd5d3e341a6273eab14d9ad6b56289ee07597977ae17714d8b152509d", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-gray-reviewed-descriptions.test.js", { digest: "5fd0ba36c146c4a8eabfccf617241b03ac45cc92e7dc2aeab9b3ba5543786942", syntaxDigest: "4f19699d74df012d741cbbeee8c23cbbf38ea5cc64af9a778a508184ab121cb7", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-gray-reviewed-facts.test.js", { digest: "ae26dc419a2ce0883ecb6e4fa4f14c370489d65d7bdcf6a50f1d01ae7b23372a", syntaxDigest: "702ac632432222a90b21e4bab02c4b36610a162e5c689985b429c41ab3e2c204", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-catalog-identities.test.js", { digest: "b2bde0028bb98b0d9739ac1355b7f58e4cd310b22385b1ac20df2a8cc812572e", syntaxDigest: "592e700bfb3db0a96a2991995b0cf056f85486be4ef188f76545241502481eaf", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-gam-mobility-sources.test.js", { digest: "2f51f9411a846818785d984cefdcfdd9bc99660a548c387ebe23a822f49b3c89", syntaxDigest: "78cfeb28c32e44520125fca455a74dd7df3b1cbb6effb3509b0055b4529e0cbe", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-model-additional.test.js", { digest: "43410e5be49afcb5c79333699c7849a38cfe6871f3c112957ff68599b53d5544", syntaxDigest: "a27f705de4550142d741a98d38bf148bedd9ef03601e79aa2050a79b76aed657", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-model-claim-validation.test.js", { digest: "07b08a8b44179fac9762d29aaf3e1c43a543370f2c9d64ebcbeb40c2f55a5f02", syntaxDigest: "6bee2917edf3436769efeda545b9994159597a7f59f4a0675b16ec3fcdd3ec94", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-model-extension.test.js", { digest: "93f9a989bdbce574b6972f6e3ba9b9a54de8cf9a31824ce7d2294ea8128c5779", syntaxDigest: "a0159f4a87488b0fb06c8b7d1a45f90cbf6a6f6ccd7fc473d8b2b09ba11f99dc", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-model-followup.test.js", { digest: "1fc623c0cace64d14d9d505bb22458735a233e3371bf1cbbc8b9c366b869e02b", syntaxDigest: "fd5a61f6e3c0e1eeab9ce641f8b7a99a77a32884328cbfde2f4203d91bef420c", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-model-new-sources.test.js", { digest: "51939adb5b6b459eba25024ab584391e37669eb2d072647173c29f475534873d", syntaxDigest: "5f0ae51cdba05ba370ce5783db9e3d18033aa485e9dc2c96aac48225d98223a4", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-model-verification.test.js", { digest: "a72062dc50b68c25e978f5d85b103b6a92f8d19d78d63d14cbeafe9ba7e4b2f8", syntaxDigest: "bcf9c3b7ced7ade6ee373fabb99f1526ff160df920b468a1d97d63a6836d7a00", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/tests/provenance/review/technical-provenance-reviewed-unit-lots.test.js", { digest: "d8ac66d2b41667940593cb0e86b2a9767593952fd29bd894511801fe2d822583", syntaxDigest: "6010e0279b356da4dd0bf3d2921904adcf0dc8359190a452b8edd3459fd65a60", scope: DATA_SCOPE_ALL }],
  ["dist/preparation/workflow/tests/manain-editorial-integration.test.js", { digest: "125b728ac4c484db81be98f9c700fc763d94758357c37f083e271cbb16559b41", syntaxDigest: "51e3e0eb8030af5840484254a2dc7c0af15e10eb830eaad57accb9d6a2cb1875", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/testing/integration/preparation/gam-evidence-provider-isolation.test.js", { digest: "369325bd3da0bce94aeec934b79c525aee498855d0929fd6be1d4bd43d44adc3", syntaxDigest: "fc1e40b92b9879d925af56d96a5f253c05826f3abdfa4575ecf90b5a6f9d0fd0", scope: DATA_SCOPE_ALL }],
  ["dist/testing/integration/preparation/live-technical-output-consistency.test.js", { digest: "60b8d0ddc28cf7f82f932d97dacb71028e8623223ff25fbfabf8673695a5933f", syntaxDigest: "01efbc16b9fea6745cba6ab520ac35b924687b77afe3bcda385a7266c1e67b0a", scope: DATA_SCOPE_ALL }],
  ["dist/publication/tests/individual-editorial.test.js", { digest: "e792c8b38e6efdc260f823f7ec5bf6275aa81b6ce67f99d9fde56685328a80fb", syntaxDigest: "09a526efb18766c4235fcd0a4ede3a83b15e304e2ebd2475ad4c59c20b079caa", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/campaign/tests/reference/reference-update.test.js", { digest: "67f2a8e39313d3966a05042e0794acddf2c7f10b6c118ac5e74d7632436380af", syntaxDigest: "0fd6a8cb183b5bec6350c323f0100d8650850536d0284a9ff480c1d765cb4040", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/campaign/tests/operations/operations-status.test.js", { digest: "ea74243a76a032c6b1f10ef315e055e8ef1d794c0ff4c726d4632ef9d2495f50", syntaxDigest: "b02aece5618e6aa8e4892c5ea33626b7b99b5b545e7dbe050568e8285fe6f33d", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/campaign/tests/finalization-and-delivery/finalization.test.js", { digest: "659ee7851cc723f8d3384ebc3acb9d2a0e0790740835a3182695b5bffbf3b89d", syntaxDigest: "3a497bf305397c202030066a2bf170fb3cd70897ff26ddaa854953d4fb90f448", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/campaign/tests/discovery-flow/active-campaign.test.js", { digest: "3cea84142f94438d1cefb087665621e1b110e35e8d1c8140e5ae29229c18d220", syntaxDigest: "ef6b3dcf08064092744102401910ca85cbc2bec255dd9933c46f262c7e1d0ab4", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/campaign/tests/discovery-flow/workflow.test.js", { digest: "af913dd1bfd0eb2dd8f3e5b15852444d88de6a320f888febf3e63f0d2fa8ea44", syntaxDigest: "934a8d7bdef1f8e59ba8620ca08e71853ea442feb68897f408f9b6dbc64c37ce", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/infrastructure/filesystem/catalog/tests/campaign-accreditation.test.js", { digest: "297233340d4f5415bf039246fe16266a768e2009a3871f6d10a8e28e3050c9f4", syntaxDigest: "a80ee6859762b08bedaace48520f348d42cc41f10c64ca1d0cd102450cd65b53", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/infrastructure/filesystem/catalog/tests/finding-recognition-store.test.js", { digest: "66025b5855bc8926f2355829e655cd07c965ad42ccb2dfb2488f77deb82ae240", syntaxDigest: "43c36904fc042573f97a6b03f3a699fd36d769ed04d46cdcba7e471549bb7c95", scope: 0 }],
  ["dist/infrastructure/filesystem/campaign/tests/campaign-reference.test.js", { digest: "dfcb6aaf04ca83b6dcfe06954823fec09f5647c16a470d4538f95b03c93afb8b", syntaxDigest: "0985de5cb9d1a652860f00405114b60a794df5fc5a4d42a17485a5763b492195", scope: 0 }],
  ["dist/publication/tests/individual-finish.test.js", { digest: "f92f712a2cbf4c5a096c240f26a10c4caf89b662a2a1e3353902c3c43b0dcb1c", syntaxDigest: "01a67e4a3ff5d34e7359e918c8e12c7ac0cb7c007fff6dc7b62112180aac7d59", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/publication/tests/individual-finish-cycle.test.js", { digest: "1c939b68f3dc4546a061d1273812098dd48e3b0197c821e4a6ed8c0224141050", syntaxDigest: "9e17f059cfa36685fdbee171ee540f3920303fc7ea58ff6893ddf2093c056815", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/publication/tests/individual-finish-editorial.test.js", { digest: "2c640fdd49e137571266e6672691581ec478d23518571417d84296cdcb384c3e", syntaxDigest: "ada79517ae4f61d32ade00cc1d66808b641cffbf42cb5fbdefeaa47864aa232d", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/publication/tests/individual-accreditation-session.test.js", { digest: "2c1b8d1014b35355d3c3a656357918ac2178f80344f172dd58773590f422083e", syntaxDigest: "e95091d27de13287d0ee6dd015c90c5de12f6b054298d7b707044c64b22b4326", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/publication/tests/individual-selection.test.js", { digest: "22537765f55581e15ab87057b06fb5ef4edb3499b15889ca3b21e919fff1bbf8", syntaxDigest: "8c7f7c72e564ba74bc9dbc9e5f73229c4632f55e5d2fdbdac4a66771c89ff206", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/publication/tests/individual-work-report.test.js", { digest: "93b7ad2d99ad57e9a9aa35eea4cb4a0c6bdff0f7eb5e27bc2336306f7c4cf2b3", syntaxDigest: "09d4db448596f22ec1bf2d9841b0b00b0df35ef7bceef50fe7ae6df47216abea", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/publication/tests/individual-finish-journal.test.js", { digest: "68d81a85a80391b88def3a2f61d8f9f931e0a0000be7644c47a5996afe6ec7d7", syntaxDigest: "79a0af561510455af207cbf9f55c8042f1fa41ff015f2f1ca9185ebdf01a1f68", scope: 0 }],
  ["dist/publication/tests/identity-conflict.test.js", { digest: "e5284a343dcc2850d8121fb463caacbed316b1423668c825efaea4b1c0883cb0", syntaxDigest: "490cd6ed1c5955be1b7869a46d12f6febf67607427fc765ee594681d6e422946", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
  ["dist/infrastructure/filesystem/catalog/tests/repository-artifact-snapshot.test.js", { digest: "23bb65d76dffd557d3755b88f8be5d96ce5df8553915fcc90240f0c6d48bbd64", syntaxDigest: "96a159b64bf3b1d7df38a247a0f39e2555dd73200fbcfa51ddc6f15c2b6a5d02", scope: 0 }],
  ["dist/infrastructure/filesystem/preparation/tests/preparation-inputs.test.js", { digest: "1543e0231c1c8fdffbb43bc754a5c747df15f62300a25275478a8e324c357fd2", syntaxDigest: "d459328a420dda5ff705f8c4d728697228f0e9e5fd8b3e2a45c4fff714f70a3c", scope: DATA_SCOPE_ALL | DATA_SCOPE_RULES }],
]);
const AUDITED_DATA_READERS = new Map([
  ["src/infrastructure/filesystem/editorial-knowledge.ts", {
    sourceDigest: "5294710f2b70e9b01f7c395056df5f1a14bc6f0c4928dfdf311ba7e99ef217ba", scope: DATA_SCOPE_KNOWLEDGE
  }],
  ["src/infrastructure/filesystem/legacy-export/import-catalog-loader.ts", {
    sourceDigest: "4a69b18bd40eac431ddd3eb36d27dba1ac8a9bb930e1ffa759ad306ba092fc1b", scope: DATA_SCOPE_IMPORT
  }]
]);
const SOURCE_DIRECTORIES = ["src", "scripts"];
const ROOT_FILES = ["README.md", "package.json", "package-lock.json", "tsconfig.json", ".gitattributes", ".gitignore",
  ".env", ".env.local", ".env.test", ".env.test.local",
  "node_modules/.package-lock.json", "node_modules/typescript/package.json",
  "node_modules/cheerio/package.json", "node_modules/p-limit/package.json",
  "scripts/testing/run-tests.mjs", "scripts/testing/test-result-cache.mjs", "scripts/testing/test-performance.mjs", "scripts/testing/test-runner-observability.mjs",
  "scripts/testing/test-runner-execution.mjs", "scripts/testing/test-runner-completion.mjs", "scripts/testing/test-runner-worker.mjs", "scripts/testing/test-runner-ui.mjs",
  "scripts/build/run-build.mjs", "scripts/build/build-cache.mjs", "scripts/terminal.mjs"];
const PURE_ROOT_FILES = new Set([
  "package.json", "package-lock.json", "tsconfig.json",
  "node_modules/.package-lock.json", "node_modules/typescript/package.json",
  "node_modules/cheerio/package.json", "node_modules/p-limit/package.json",
  "scripts/testing/run-tests.mjs", "scripts/testing/test-result-cache.mjs", "scripts/testing/test-performance.mjs", "scripts/testing/test-runner-observability.mjs",
  "scripts/testing/test-runner-execution.mjs", "scripts/testing/test-runner-completion.mjs", "scripts/testing/test-runner-worker.mjs", "scripts/testing/test-runner-ui.mjs",
  "scripts/build/run-build.mjs", "scripts/build/build-cache.mjs", "scripts/terminal.mjs"
]);
const SESSION_ENVIRONMENT_KEYS = new Set([
  "WT_SESSION", "WT_PROFILE_ID", "VSCODE_PID", "VSCODE_IPC_HOOK_CLI", "SHLVL", "_"
]);
const SESSION_INDEPENDENT_BUILTINS = new Set([
  "assert", "assert/strict", "test", "path", "path/posix", "path/win32", "url", "buffer", "crypto", "util", "zlib"
]);
const UNCERTAIN_ENVIRONMENT_ACCESS = /\b(?:process|global|globalThis|eval|Function|constructor|Reflect|__proto__|getPrototypeOf|setPrototypeOf|WebAssembly|importScripts|mock)\b|\\(?:u(?:00[0-7][\da-f]|\{0*[0-7]?[\da-f]\})|x[0-7][\da-f])/iu;
const EXTERNAL_DATA_ACCESS = /\b(?:node:fs(?:\/promises)?|fs\/promises|process\.(?:binding|loadEnvFile))\b/u;
const AUDITED_FAMILIES = [
  "src/preparation/",
  "src/catalog/diagnostics/tests/",
  "src/commercial/legacy-export/tests/",
  "src/catalog/tests/",
  "src/scraping/providers/",
  "src/scraping/tests/",
  "src/cli/options/tests/",
  "src/cli/reporting/tests/",
  "src/tools/gam/tests/",
  "src/tools/gam/seed/tests/"
];
const AUDITED_INTEGRATION_SUITES = new Set([
  "src/testing/integration/preparation/gam-evidence-provider-isolation.test.ts",
  "src/testing/integration/preparation/live-technical-output-consistency.test.ts",
  "src/testing/integration/preparation/source-technical-unit-consistency.test.ts",
]);
const AUDITED_INPUT_SUITES = new Set([
  "src/cli/commands/catalog/tests/finding-recognition-report.test.ts",
  "src/cli/commands/catalog/tests/normalization-serialization.test.ts",
  "src/cli/commands/catalog/tests/specification-coverage-report.test.ts",
  "src/commercial/diagnostics/tests/commercial-cross-coverage.test.ts",
  "src/commercial/diagnostics/tests/commercial-presentation.test.ts",
  "src/commercial/projection/tests/category-projection.test.ts",
  "src/commercial/projection/tests/export-projection-accreditation.test.ts",
  "src/commercial/projection/tests/export-projection.test.ts",
  "src/shared/audit-provider-results.test.ts",
  "src/testing/builders/tests/prepared-source-fixture.test.ts",
  "src/testing/integration/preparation/attribute-resolution.test.ts",
  "src/testing/integration/preparation/gomariz-technical.test.ts",
]);
const AUDITED_YEAR_SUITES = new Set([
  "src/catalog/normalization/tests/spec-angular-configuration.test.ts",
  "src/catalog/normalization/tests/spec-functional-geometry.test.ts",
  "src/catalog/normalization/tests/spec-numeric-safety.test.ts",
  "src/catalog/normalization/tests/spec-scoped-measurements.test.ts",
  "src/catalog/normalization/tests/spec-scoped-power.test.ts",
  "src/catalog/normalization/tests/spec-identity-geometry-year.test.ts",
  "src/commercial/validation/tests/height-consistency.test.ts",
]);
const AUDITED_PURE_SUITES = new Set([
  "src/catalog/interventions/tests/comparison.test.ts",
  "src/catalog/interventions/tests/intervention-campaign-safety.test.ts",
  "src/catalog/interventions/tests/maintenance.test.ts",
  "src/catalog/interventions/tests/record.test.ts",
  "src/catalog/normalization/gam/tests/gallery.test.ts",
  "src/catalog/normalization/gam/tests/year.test.ts",
  "src/catalog/reference/compare.test.ts",
  "src/cli/commands/catalog/tests/catalog-content-gaps-titles.test.ts",
  "src/cli/commands/catalog/tests/specification-improvement-report.test.ts",
  "src/cli/commands/catalog/tests/specification-opportunities-report.test.ts",
  "src/commercial/diagnostics/tests/commercial-categories.test.ts",
  "src/commercial/diagnostics/tests/commercial-category-tree.test.ts",
  "src/commercial/diagnostics/tests/commercial-intervention-priorities.test.ts",
  "src/commercial/diagnostics/tests/commercial-output-consistency.test.ts",
  "src/commercial/diagnostics/tests/presentation-consistency.test.ts",
  "src/commercial/export/tests/commercial-exception-accreditation.test.ts",
  "src/commercial/projection/tests/editorial-normalization.test.ts",
  "src/commercial/validation/tests/editorial-quality.test.ts",
  "src/commercial/validation/tests/year-consistency.test.ts",
  "src/infrastructure/filesystem/retention/tests/simulation.test.ts",
  "src/scraping/workflow/tests/portable-eligibility.test.ts",
]);
const REJECTED_TEST_OPERATIONS = [
  /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/u,
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|mkdtemp|mkdtempSync|copyFile|copyFileSync|cpSync|rename|renameSync|unlink|unlinkSync|rmSync|rmdir|rmdirSync|symlink|symlinkSync|createWriteStream)\b/u,
  /\b(?:cp|rm)\s*\(/u,
  /\b(?:fetch|setTimeout|setInterval|Math\.random|Date\.now|randomUUID|performance\.now|randomBytes|randomInt)\s*\(/u,
  /\bnew\s+Date\s*\(/u,
  /\b(?:process\.chdir|process\.exit|process\.kill)\s*\(/u,
  /\b(?:process\.env|process\.argv|node:child_process|node:net|node:http|node:https|node:dgram|node:worker_threads)\b/u,
  /\btmpdir\s*\(/u,
  /\b(?:eval|Function|createRequire)\s*\(/u
];

const REJECTED_MODULE_OPERATIONS = [
  /\b(?:node:child_process|node:net|node:http|node:https|node:dgram|node:worker_threads)\b/u,
  /\b(?:fetch|createRequire)\s*\(/u
];

const canonical = (file) => relative(process.cwd(), resolve(file)).replaceAll("\\", "/");
export const relativeCacheFile = canonical;
const hashBytes = (buffer) => createHash("sha256").update(buffer).digest("hex");

const readRegular = (path) => {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Entrada no regular: ${path}`);
  return readFileSync(path);
};

const walkFiles = (directory, accept = () => true, directories) => {
  if (!existsSync(directory)) return [];
  const root = lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error(`Directorio no acreditable: ${directory}`);
  const paths = [];
  const visit = (path) => {
    directories?.push(canonical(path));
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, item.name);
      if (item.isSymbolicLink()) throw new Error(`Entrada simbólica no acreditable: ${child}`);
      if (item.isDirectory()) visit(child);
      else if (item.isFile() && accept(child)) paths.push(child);
      else if (!item.isFile()) throw new Error(`Entrada no regular: ${child}`);
    }
  };
  visit(directory);
  return paths;
};

const environmentFingerprint = (withFullEnvironment) => Object.fromEntries(Object.entries(process.env)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => [key, !withFullEnvironment && SESSION_ENVIRONMENT_KEYS.has(key) && value
    ? "<session>" : value]));

const dataDirectoriesFor = (scope) => scope & DATA_SCOPE_ALL ? DATA_DIRECTORIES : [
  ...(scope & DATA_SCOPE_KNOWLEDGE ? ["data/editorial/knowledge"] : []),
  ...(scope & DATA_SCOPE_IMPORT ? ["data/category", "data/import"] : [])
];

const scopedDataFiles = (scope, directories) => dataDirectoriesFor(scope).flatMap((directory) => {
  const parts = directory.split("/");
  for (let count = 1; count <= parts.length; count += 1) {
    const path = resolve(...parts.slice(0, count));
    let stat;
    try { stat = lstatSync(path); } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directorio no acreditable: ${path}`);
  }
  return walkFiles(resolve(directory), undefined, directories);
});

const ruleInputs = () => [
  ...walkFiles(resolve("dist/preparation"), (path) => path.endsWith(".js") && !path.endsWith(".test.js")),
  ...walkFiles(resolve("dist/catalog/normalization"), (path) => path.endsWith(".js") && !path.endsWith(".test.js")),
  ...["dist/commercial/legacy-export/contracts.js", "dist/commercial/legacy-export/prepare-product.js",
    "dist/catalog/identity.js", "dist/catalog/identity-conflicts.js"].filter(existsSync).map((path) => resolve(path))
];

const sharedFingerprint = (withExternalData, withFullEnvironment, dataScope) => {
  const directories = [];
  const inputs = [
    ...(withExternalData ? scopedDataFiles(dataScope, directories) : []),
    ...(dataScope & DATA_SCOPE_RULES ? ruleInputs() : []),
    ...(dataScope & DATA_SCOPE_EDITORIAL_SOURCE ? walkFiles(resolve("src/preparation/editorial"), undefined, directories) : []),
    ...(withExternalData ? SOURCE_DIRECTORIES.flatMap((directory) => walkFiles(resolve(directory), (path) =>
      !/\.(?:ts|tsx|js|mjs|cjs)$/u.test(path))) : []),
    ...ROOT_FILES.filter((path) => (withExternalData || PURE_ROOT_FILES.has(path)) && existsSync(path))
      .map((path) => resolve(path))
  ].sort((left, right) => canonical(left).localeCompare(canonical(right)));
  const sha = createHash("sha256");
  const now = new Date();
  sha.update(JSON.stringify({ version: VERSION, withExternalData, withFullEnvironment, dataScope, root: process.cwd(), node: process.version,
    executable: process.execPath, platform: process.platform, architecture: process.arch,
    env: environmentFingerprint(withFullEnvironment),
    year: now.getUTCFullYear(),
    ...(dataScope & DATA_SCOPE_RULES ? { date: now.toISOString().slice(0, 10), localDate: now.toDateString(), offset: now.getTimezoneOffset() } : {}) }));
  sha.update(JSON.stringify(directories.sort()));
  for (const file of inputs) {
    sha.update(canonical(file));
    sha.update("\0");
    sha.update(readRegular(file));
    sha.update("\0");
  }
  return sha.digest("hex");
};

const importsOf = (code) => {
  if (/\b(?:require|createRequire|eval)\s*\(|\bimport\s*\(/u.test(code)) return null;
  const imports = [];
  const statements = /\b(?:import|export)\s+[^;]{0,2000}?\bfrom\s*["']([^"']+)["']/gu;
  for (const match of code.matchAll(statements)) imports.push(match[1]);
  const sideEffects = /\bimport\s*["']([^"']+)["']/gu;
  for (const match of code.matchAll(sideEffects)) imports.push(match[1]);
  return imports;
};

const hasUncertainEnvironmentAccess = (code) => UNCERTAIN_ENVIRONMENT_ACCESS.test(code) ||
  /\b(?:import|export|from)\s*(?:\/\*|\/\/)/u.test(code);

const resolveDependency = (importer, specifier) => {
  if (isBuiltin(specifier)) return undefined;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  const candidate = resolve(importer, "..", specifier);
  if (!candidate.startsWith(`${resolve("dist")}/`) && !candidate.startsWith(`${resolve("dist")}\\`) &&
    !candidate.startsWith(`${resolve("scripts")}/`) && !candidate.startsWith(`${resolve("scripts")}\\`)) return null;
  if (!existsSync(candidate) || !lstatSync(candidate).isFile() || lstatSync(candidate).isSymbolicLink()) return null;
  return candidate;
};

const sourceOf = (path) => {
  const name = canonical(path);
  if (!name.startsWith("dist/") || extname(path) !== ".js") return null;
  return resolve("src", name.slice(5).replace(/\.js$/u, ".ts"));
};

const auditedSource = (file) => {
  const source = sourceOf(file);
  if (!source || !existsSync(source) || !(AUDITED_FAMILIES.some((prefix) => canonical(source).startsWith(prefix)) || AUDITED_INTEGRATION_SUITES.has(canonical(source)) || AUDITED_PURE_SUITES.has(canonical(source)) || AUDITED_INPUT_SUITES.has(canonical(source)) || AUDITED_YEAR_SUITES.has(canonical(source)) || AUDITED_FILESYSTEM_GRAPHS.has(canonical(file)))) return null;
  const text = readRegular(source).toString("utf8");
  if (!AUDITED_FILESYSTEM_GRAPHS.has(canonical(file)) && REJECTED_TEST_OPERATIONS.some((expression) => expression.test(AUDITED_YEAR_SUITES.has(canonical(source)) ? withoutUtcYear(text) : text))) return null;
  return source;
};

const withoutUtcYear = (code) => code.replace(/\bnew\s+Date\s*\(\s*\)\s*\.getUTCFullYear\s*\(\s*\)/gu, "0");

const hasRestrictedPureOperations = (code) =>
  /\bDate\b(?!\.parse\b)|\b(?:random|randomUUID|randomBytes|randomInt|randomFill|randomFillSync|getRandomValues|hrtime|performance|setTimeout|setInterval|fetch|crypto\.subtle)\b/u.test(code);

const require = createRequire(import.meta.url);
let compiler;
const dataScopeCompiler = () => {
  if (compiler === undefined) {
    try { compiler = require("typescript"); } catch { compiler = null; }
  }
  return compiler;
};
const normalizeLines = (text) => text.replace(/\r\n/gu, "\n");

const auditedReaderScope = (source, sourceText, path, code) => {
  const reader = AUDITED_DATA_READERS.get(canonical(source));
  if (!reader || hashBytes(Buffer.from(normalizeLines(sourceText))) !== reader.sourceDigest) return DATA_SCOPE_ALL;
  if (canonical(realpathSync(source)) !== canonical(source) || canonical(realpathSync(path)) !== canonical(path)) return DATA_SCOPE_ALL;
  const ts = dataScopeCompiler();
  if (!ts) return DATA_SCOPE_ALL;
  const emitted = ts.transpileModule(sourceText, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, newLine: ts.NewLineKind.LineFeed }
  }).outputText;
  return normalizeLines(emitted) === normalizeLines(code) ? reader.scope : DATA_SCOPE_ALL;
};

const isStaticDataModule = (code) => {
  const ts = dataScopeCompiler();
  if (!ts) return false;
  const file = ts.createSourceFile("data.js", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const constants = new Set();
  const literal = (node) => (ts.isIdentifier(node) && constants.has(node.text)) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isRegularExpressionLiteral(node) ||
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind) ||
    (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(node.operator) && ts.isNumericLiteral(node.operand)) ||
    (ts.isArrayLiteralExpression(node) && node.elements.every(literal)) ||
    (ts.isObjectLiteralExpression(node) && node.properties.every((property) => ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) && literal(property.initializer)));
  return file.parseDiagnostics.length === 0 && file.statements.every((statement) => ts.isVariableStatement(statement) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 && statement.declarationList.declarations.every((declaration) =>
      {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !literal(declaration.initializer)) return false;
      constants.add(declaration.name.text);
      return true;
    }));
};

const moduleFingerprint = (file, hashes, visiting = new Set()) => {
  const path = resolve(file);
  if (hashes.has(path)) return hashes.get(path);
  if (visiting.has(path)) return null;
  visiting.add(path);
  const content = readRegular(path);
  const code = content.toString("utf8");
  const restrictedModule = REJECTED_MODULE_OPERATIONS.some((pattern) => pattern.test(code));
  if (restrictedModule && canonical(path) !== "dist/cli/commands/catalog/individual/publish-individual.js") return null;
  const dependencies = importsOf(code);
  if (dependencies === null) return null;
  const parts = [canonical(path), hashBytes(content)];
  const auditParts = [canonical(path), hashBytes(Buffer.from(normalizeLines(code)))];
  let withExternalData = EXTERNAL_DATA_ACCESS.test(code) || /\b(?:node:)?fs(?:\/promises)?["']/u.test(code);
  let withFullEnvironment = hasUncertainEnvironmentAccess(code) ||
    [...code.matchAll(/\b(?:from|import)\s*["']/gu)].length !== dependencies.length;
  let restrictedPureOperations = hasRestrictedPureOperations(code);
  let restrictedBeyondUtcYear = hasRestrictedPureOperations(withoutUtcYear(code));
  let dataScope = 0;
  let unverifiedDataAccess = restrictedModule;
  let regularGraph = canonical(realpathSync(path)) === canonical(path);
  const source = sourceOf(path);
  if (source) {
    if (!existsSync(source)) return null;
    const sourceContent = readRegular(source);
    const sourceText = sourceContent.toString("utf8");
    parts.push(canonical(source), hashBytes(sourceContent));
    auditParts.push(canonical(source), hashBytes(Buffer.from(normalizeLines(sourceText))));
    regularGraph &&= canonical(realpathSync(source)) === canonical(source);
    withFullEnvironment ||= hasUncertainEnvironmentAccess(sourceText);
    restrictedPureOperations ||= hasRestrictedPureOperations(sourceText);
    restrictedBeyondUtcYear ||= hasRestrictedPureOperations(withoutUtcYear(sourceText));
    withExternalData ||= EXTERNAL_DATA_ACCESS.test(sourceText) ||
      /\b(?:node:)?fs(?:\/promises)?["']/u.test(sourceText);
    if (withExternalData) dataScope = auditedReaderScope(source, sourceText, path, code);
  }
  if (withExternalData && (dataScope === 0 || dataScope & DATA_SCOPE_ALL)) {
    dataScope = DATA_SCOPE_ALL;
    unverifiedDataAccess = true;
  }
  if (!withExternalData && (withFullEnvironment || /\b(?:require|this)\b|\bimport\s*\./u.test(code)) &&
    !isStaticDataModule(code)) dataScope = DATA_SCOPE_ALL;
  for (const specifier of dependencies) {
    const dependency = resolveDependency(path, specifier);
    if (dependency === null) return null;
    if (dependency === undefined) {
      const builtin = specifier.replace(/^node:/u, "");
      withFullEnvironment ||= !SESSION_INDEPENDENT_BUILTINS.has(builtin);
      if (!SESSION_INDEPENDENT_BUILTINS.has(builtin) &&
        !(dataScope !== 0 && !(dataScope & DATA_SCOPE_ALL) && ["fs", "fs/promises"].includes(builtin))) dataScope |= DATA_SCOPE_ALL;
      continue;
    }
    const fingerprint = moduleFingerprint(dependency, hashes, visiting);
    if (fingerprint === null) return null;
    parts.push(canonical(dependency), fingerprint.digest);
    auditParts.push(canonical(dependency), fingerprint.auditDigest);
    unverifiedDataAccess ||= fingerprint.unverifiedDataAccess;
    regularGraph &&= fingerprint.regularGraph;
    withExternalData ||= fingerprint.withExternalData;
    withFullEnvironment ||= fingerprint.withFullEnvironment;
    restrictedPureOperations ||= fingerprint.restrictedPureOperations;
    restrictedBeyondUtcYear ||= fingerprint.restrictedBeyondUtcYear;
    dataScope |= fingerprint.dataScope;
  }
  visiting.delete(path);
  const fingerprint = { digest: hashBytes(Buffer.from(parts.join("\0"))),
    auditDigest: hashBytes(Buffer.from(auditParts.join("\0"))),
    withExternalData, withFullEnvironment, restrictedPureOperations, restrictedBeyondUtcYear, dataScope, unverifiedDataAccess, regularGraph };
  hashes.set(path, fingerprint);
  return fingerprint;
};


const syntaxGraphDigest = (file, hashes) => {
  const path = resolve(file);
  if (hashes.has(path)) return hashes.get(path);
  const ts = dataScopeCompiler();
  if (!ts) return null;
  hashes.set(path, null);
  const syntaxDigest = (filename, text, kind) => {
    const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.ES2022, true, kind);
    if (tree.parseDiagnostics.length !== 0) return null;
    return hashBytes(Buffer.from(ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(tree)));
  };
  const code = readRegular(path).toString("utf8");
  const dependencies = importsOf(code);
  const compiled = syntaxDigest(path, code, ts.ScriptKind.JS);
  if (!compiled || dependencies === null) return null;
  const parts = [canonical(path), compiled];
  const source = sourceOf(path);
  if (source) {
    const sourceDigest = syntaxDigest(source, readRegular(source).toString("utf8"), ts.ScriptKind.TS);
    if (!sourceDigest) return null;
    parts.push(canonical(source), sourceDigest);
  }
  for (const specifier of dependencies) {
    const dependency = resolveDependency(path, specifier);
    if (dependency === null) return null;
    if (dependency === undefined) continue;
    const digest = syntaxGraphDigest(dependency, hashes);
    if (digest === null) return null;
    parts.push(canonical(dependency), digest);
  }
  const digest = hashBytes(Buffer.from(parts.join("\0")));
  hashes.set(path, digest);
  return digest;
};

export const fingerprintTestInputs = (files) => {
  const shared = new Map();
  const sharedFor = (withExternalData, withFullEnvironment, dataScope = DATA_SCOPE_ALL) => {
    const fullEnvironment = withExternalData || withFullEnvironment || Boolean(process.env.NODE_OPTIONS);
    const scope = !withExternalData ? 0 : process.env.NODE_OPTIONS
      ? dataScope | DATA_SCOPE_ALL : dataScope || DATA_SCOPE_ALL;
    const key = `${withExternalData}:${fullEnvironment}:${scope}`;
    if (!shared.has(key)) shared.set(key, sharedFingerprint(withExternalData, fullEnvironment, scope));
    return shared.get(key);
  };
  const hashes = new Map();
  const fingerprints = new Map();
  const syntaxHashes = new Map();
  for (const file of files) {
    const name = canonical(file);
    const source = auditedSource(file);
    if (!source) continue;
    const digest = moduleFingerprint(file, hashes);
    if (digest === null || (AUDITED_PURE_SUITES.has(canonical(source)) &&
      (digest.withExternalData || digest.withFullEnvironment || digest.restrictedPureOperations))) continue;
    if (AUDITED_YEAR_SUITES.has(canonical(source)) &&
      (digest.withExternalData || digest.withFullEnvironment || digest.restrictedBeyondUtcYear)) continue;
    const audited = AUDITED_FILESYSTEM_GRAPHS.get(name);
    if (audited) {
      if (process.env.NODE_OPTIONS || !digest.regularGraph || (audited.digest !== digest.auditDigest &&
        (!audited.syntaxDigest || audited.syntaxDigest !== syntaxGraphDigest(file, syntaxHashes)))) continue;
      fingerprints.set(name, hashBytes(Buffer.from(`${sharedFor(audited.scope !== 0, true, audited.scope)}\0${digest.digest}`)));
      continue;
    }
    if (digest.unverifiedDataAccess) continue;
    fingerprints.set(name, hashBytes(Buffer.from(`${sharedFor(digest.withExternalData, digest.withFullEnvironment, digest.dataScope)}\0${digest.digest}`)));
  }
  return fingerprints;
};

const validCounts = (value) => value !== null && typeof value === "object" &&
  Number.isSafeInteger(value.passed) && value.passed > 0 &&
  value.failed === 0 && value.skipped === 0 && value.todo === 0;

export const loadTestResultsCache = (fingerprints) => {
  try {
    if (!existsSync(CACHE_PATH)) return new Map();
    const data = JSON.parse(readRegular(CACHE_PATH).toString("utf8"));
    if (data?.version !== VERSION || !data.results ||
      typeof data.results !== "object" || Array.isArray(data.results)) return new Map();
    return new Map(Object.entries(data.results).filter(([name, value]) =>
      fingerprints.has(name) && validCounts(value) && fingerprints.get(name) === value.fingerprint));
  } catch {
    return new Map();
  }
};

export const saveTestResultsCache = (fingerprints, results) => {
  const entries = Object.fromEntries([...results].filter(([name, value]) =>
    fingerprints.has(name) && validCounts(value) && fingerprints.get(name) === value.fingerprint));
  const stage = `${CACHE_PATH}.${randomUUID()}.tmp`;
  try {
    if (existsSync(CACHE_PATH)) readRegular(CACHE_PATH);
    writeFileSync(stage, JSON.stringify({ version: VERSION, results: entries }));
    renameSync(stage, CACHE_PATH);
  } finally {
    rmSync(stage, { force: true });
  }
};

export const discardTestResultsCache = () => {
  if (!existsSync(CACHE_PATH)) return;
  readRegular(CACHE_PATH);
  rmSync(CACHE_PATH);
};
