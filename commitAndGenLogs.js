const IO = require("./io");
const path = require("node:path");

function makeBox(message) {
  const padding = 2;
  const boxWidth = message.length + padding * 2 + 2; // 2 for the borders
  const horizontalLine = "*".repeat(boxWidth);
  const paddingLine = `*${" ".repeat(boxWidth - 2)}*`;
  const messagePadding = " ".repeat(padding);

  return `${horizontalLine}\n${paddingLine}\n*${messagePadding}${message}${messagePadding}*\n${paddingLine}\n${horizontalLine}`;
}

/**
 * commitAndGenLogs(msg)
 * commitAndGenLogs(msg, description)
 *
 * This function appends a changelog entry to src/CHANGELOG
 * It accepts a commit message and an optional
 * description for the changes made in this commit.
 *
 * @param {string} message - The commit message to be used.
 * @param {string} description - An optional description for the changes made.
 */
async function commitAndGenLogs(msg, description = "") {
  const formattedDescription =
    description === ""
      ? ""
      : `<strong>Description:</strong><br>${description}<br>`;

  // Stage all changes and src/CHANGELOG
  await IO.gitAddAll();

  // Get staged diff
  let diff = await IO.getGitDiff();
  if (!diff) diff = "(no staged diff)";

  // Extract all file paths from the diff (can be more than one)
  const filePathMatches = [];
  const diffFileRegex = /^diff --git a\/(.+?) b\//gm;
  let match;
  while ((match = diffFileRegex.exec(diff)) !== null) {
    // filePathMatches is now a list of all changed file paths
    filePathMatches.push(match[1]);
  }

  const finalFilePathMatches = filePathMatches.join(", ");

  // Filter diff to only lines starting with + or -
  const filteredDiff = diff
    .split("\n")
    .filter((line) => line.startsWith("+") || line.startsWith("-"))
    .join("\n");

  // Escape single quotes in the message for safe shell usage
  const safeMsg = msg.replace(/'/g, "'\\''");

  // Get user email
  const user = await IO.getCommitAuthorEmail();

  // Commit with the provided message, safely quoted
  await IO.gitCommit(safeMsg);

  // Get date in dd/mm/yyyy (EU, no leading zeros)
  const now = new Date();
  const date = `${now.getDate()}/${
    now.getMonth() + 1
  }/${now.getFullYear()} - ${now.getHours()}:${now.getMinutes()}`;

  // Write to src/CHANGELOG.md
  const changelogPath = path.join(__dirname, "../CHANGELOG.md");

  const boxMsg = `${date} - [BLAME] => ${user}`;
  // Format entry
  const entry = `
<pre>
${makeBox(boxMsg)}
</pre>
<strong>Message: </strong><br>
"${msg}"<br>
${formattedDescription}
<strong>Affected files: </strong><br>
"${finalFilePathMatches}"\n
<strong>DIFF: </strong><br>
\`\`\`diff
${filteredDiff}
\`\`\`
<p><small>This might be a 🚀 or a 🧨 XD</small></p>
<p>&nbsp;</p>
`;

  // Read current changelog content
  let changelogContent = "";
  try {
    changelogContent = await IO.readFile(changelogPath);
    changelogContent = changelogContent.toString();
  } catch (e) {
    changelogContent = "";
  }

  // Ensure header exists and split content
  const header = "# Changelogs\n\n";
  const body = changelogContent.slice(header.length);

  // Write header, new entry, and body so it's most recent will always be on top
  const newContent = header + entry + body;

  await IO.writeFile(changelogPath, newContent);
  console.log("Changelog entry added.");

  // Stage src/CHANGELOG
  await IO.gitAddAll();
  console.log("All files added.");

  // Commit with the provided message, safely quoted
  await IO.gitCommit(`patch(changelog): update changelog for ${safeMsg}`);

  console.log("Changes committed.");
}

module.exports = commitAndGenLogs;
