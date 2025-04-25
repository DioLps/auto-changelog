const commitAndGenLogs = require("./commitAndGenLogs");
const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  try {
    const disposable = vscode.commands.registerCommand(
      "auto-changelog.commit",
      async function () {
        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage("[Started]: Auto Changelog");

        const msg = await vscode.window.showInputBox({
          prompt: "Enter the commit message",
          placeHolder: "Commit message",
        });

        if (msg) {
          const description = await vscode.window.showInputBox({
            prompt: "Enter the commit description (optional)",
            placeHolder: "Commit description",
          });

          return commitAndGenLogs(msg, description);
        }

        return vscode.window.showInformationMessage(
          "Auto Changelog: Commit message not provided."
        );
      }
    );

    context.subscriptions.push(disposable);
  } catch (error) {
    vscode.window.showErrorMessage("Error during commit: " + error.message);
  }
}

function deactivate() {
  vscode.window.showInformationMessage("[Stopped]: Auto Changelog");
}

module.exports = {
  activate,
  deactivate,
};
