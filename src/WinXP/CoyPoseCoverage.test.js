const fs = require("fs");
const path = require("path");

const readProjectFile = filePath => fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

describe("Coy companion pose coverage", () => {
  const companionSource = readProjectFile("src/WinXP/CoyCompanion.js");
  const avatarSource = readProjectFile("src/WinXP/CoyAvatar3D.js");
  const baseAnimations = JSON.parse(readProjectFile("public/avatar/animations.json")).animations || {};
  const toolAnimations = JSON.parse(readProjectFile("public/avatar/coy-tools-animations.json")).animations || {};

  test("every statically declared companion pose has a clip or procedural case", () => {
    const poses = new Set();

    // Literal pose assignments/actions are the easiest places to leave an orphaned name.
    const posePatterns = [
      /\bsetPose\(\s*["']([^"']+)["']\s*\)/g,
      /\bposeRef\.current\s*=\s*["']([^"']+)["']/g,
      /\bshowPose\(\s*["']([^"']+)["']/g,
    ];
    for (const pattern of posePatterns) {
      for (const match of companionSource.matchAll(pattern)) poses.add(match[1]);
    }

    // Include the developer console's complete supported-move list, including moves
    // selected dynamically at runtime (for example coyMoves.play(name)).
    const developerMoves = companionSource.match(
      /const names = \[([\s\S]*?)\];\s*\/\/ plus coyMoves\.wall\(\), \.cursor\(\), \.random\(\)/
    );
    expect(developerMoves).not.toBeNull();
    for (const match of developerMoves[1].matchAll(/["']([^"']+)["']/g)) poses.add(match[1]);

    // The target() switch is the avatar's procedural pose implementation.
    const targetFunction = avatarSource.match(
      /function target\([\s\S]*?(?=\nfunction buildAvatar\()/
    );
    expect(targetFunction).not.toBeNull();
    const proceduralCases = new Set(
      [...targetFunction[0].matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(match => match[1])
    );

    // These aliases are used to reuse imported Roblox clips for friendly pose names.
    const aliasBlock = avatarSource.match(/const clipName = \(\{([\s\S]*?)\}\)\[L\.pose\]/);
    expect(aliasBlock).not.toBeNull();
    const aliases = Object.fromEntries(
      [...aliasBlock[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*["']([^"']+)["']/g)]
        .map(match => [match[1], match[2]])
    );
    const importedClips = new Set([
      ...Object.keys(baseAnimations),
      ...Object.keys(toolAnimations),
    ]);

    const uncovered = [...poses].filter(pose =>
      !proceduralCases.has(pose) && !importedClips.has(aliases[pose] || pose)
    );

    expect([...poses].length).toBeGreaterThan(0);
    expect(uncovered).toEqual([]);
  });
});
