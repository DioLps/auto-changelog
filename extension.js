// const commitAndGenLogs = require("./commitAndGenLogs");

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  //   console.log(
  //     'Congratulations, your extension "auto-changelog" is now active!'
  //   );

  try {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand(
      "auto-changelog.commit",
      function () {
        // The code you place here will be executed every time your command is executed

        vscode.window.showInformationMessage("Auto Changelog: TEST");

        // Display a prompt for the commit message
        vscode.window
          .showInputBox({
            prompt: "Enter the commit message",
            placeHolder: "Commit message",
          })
          .then((msg) => {
            // if (msg) {
            // 	// Display a prompt for the commit description
            // 	vscode.window.showInputBox({
            // 		prompt: 'Enter the commit description (optional)',
            // 		placeHolder: 'Commit description'
            // 	}).then((description) => {
            // 		// Call the commitAndGenLogs function with the provided message and description
            // 		commitAndGenLogs(msg, description);
            // 	});
            // } else {
            // 	vscode.window.showInformationMessage('Auto Changelog: Commit message not provided.');
            // }
          });
      }
    );

    context.subscriptions.push(disposable);
  } catch (error) {
    // Handle any errors that occur during the commit process
    console.error("Error during commit:", error);
  }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
