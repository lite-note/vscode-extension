import * as vscode from "vscode"

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "lite-note.newFleetingNote",
    async () => {
      try {
        const today = new Date().toISOString().split("T").shift()

        const [firstInboxFile] = await vscode.workspace.findFiles(
          "**inbox/**.md"
        )

        let inboxFolderPath = firstInboxFile?.fsPath

        vscode.workspace.workspaceFolders?.forEach((workspace) => {
          inboxFolderPath = inboxFolderPath.replace(workspace.uri.fsPath, "")
        })

        const [inboxFolder] = inboxFolderPath.startsWith("/")
          ? inboxFolderPath.replace("/", "").split("/")
          : inboxFolderPath.split("/")

        const [fleetingNote] = await vscode.workspace.findFiles(
          `${inboxFolder ?? "_inbox"}/${today}.md`
        )

        if (fleetingNote) {
          await vscode.workspace.openTextDocument(fleetingNote.path)
          vscode.window.showInformationMessage("Fleeting note already exist.")
          return
        }

        const wsPath = vscode.workspace?.workspaceFolders?.[0].uri.fsPath
        const filePath = vscode.Uri.file(`${wsPath}/_inbox/${today}.md`)

        if (!wsPath) {
          return
        }

        const worspaceEdit = new vscode.WorkspaceEdit()
        worspaceEdit.createFile(filePath, { ignoreIfExists: true })
        worspaceEdit.insert(
          filePath,
          new vscode.Position(0, 0),
          `# ${new Date().toLocaleDateString(vscode.env.language)}\n`
        )

        await vscode.workspace.applyEdit(worspaceEdit)
      } catch (error) {
        console.warn(error)
      }
    }
  )

  context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() {}
