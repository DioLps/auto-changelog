const FS = require("fs-extra");
const { exec } = require("child_process");
const vscode = require("vscode");

const findWorkspaceFolder = () => {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders === undefined || workspaceFolders.length === 0) {
    return null;
  }
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  }
  if (vscode.window.activeTextEditor === undefined) {
    return workspaceFolders[0].uri.fsPath;
  }
  const currentDocument = vscode.window.activeTextEditor.document.uri.fsPath;
  const folder = workspaceFolders.find((w) =>
    currentDocument.startsWith(w.uri.fsPath)
  );
  console.log("folder", folder);
  return folder === undefined ? null : folder.uri.fsPath;
};

const IO = (module.exports = {});

IO.findWorkspaceFolder = findWorkspaceFolder;

IO.readFile = async (path) => {
  return await FS.readFile(path);
};

IO.writeFile = async (path, data) => {
  return await FS.outputFile(path, data);
};

IO.getGitDiff = async () => {
  const path = findWorkspaceFolder();
  if (path === null) {
    console.error("No current folder found!");
    return;
  }

  return new Promise((resolve) => {
    exec("git diff --cached", { cwd: path }, (err, stdout) => {
      if (err) {
        console.log(`[IO.getGitDiff](${path}): Error ${err.code}`);
        return resolve(`<${err.code}>`);
      }
      // Only keep lines starting with diff, index, ---/+++, @@, +, or - (but not --- or +++)
      const lines = stdout.split("\n");
      const filtered = lines.filter((line) => {
        if (line.startsWith("diff --git")) return true;
        if (line.startsWith("index ")) return true;
        if (line.startsWith("@@")) return true;
        if (line.startsWith("+") && !line.startsWith("+++")) return true;
        if (line.startsWith("-") && !line.startsWith("---")) return true;
        if (line.startsWith("new file mode")) return true;
        if (line.startsWith("deleted file mode")) return true;
        if (line.startsWith("--- ") || line.startsWith("+++ ")) return false;
        return false;
      });
      resolve(filtered.join("\n").trim());
    });
  });
};

IO.gitAddAll = async () => {
  const path = findWorkspaceFolder();
  if (path === null) {
    console.error("No current folder found!");
    return;
  }

  return new Promise((resolve) => {
    exec(`git add -A`, { cwd: path }, (err, stdout) => {
      if (err) {
        console.log(`[IO.gitAddAll]: Error ${err.code}`);
        return resolve(`<${err.code}>`);
      }
      resolve(stdout.trim());
    });
  });
};

IO.gitCommit = async (msg, cwd = null) => {
  const path = findWorkspaceFolder();
  if (path === null) {
    console.error("No current folder found!");
    return;
  }

  return new Promise((resolve) => {
    exec(`git commit -m "${msg}"`, { cwd: path }, (err, stdout) => {
      if (err) {
        console.log(`[IO.gitCommit](${path}): Error ${err.code}`);
        return resolve(`<${err.code}>`);
      }
      resolve(stdout.trim());
    });
  });
};

IO.getCommitAuthorEmail = async () => {
  const path = findWorkspaceFolder();
  if (path === null) {
    console.error("No current folder found!");
    return;
  }

  return new Promise((resolve) => {
    exec("git config user.email", { cwd: path }, (err, stdout) => {
      if (err) {
        console.log(`[IO.getCommitAuthorEmail]: Error ${err.code}`);
        return resolve(`<${err.code}>`);
      }
      resolve(stdout.trim());
    });
  });
};
