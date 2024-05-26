import * as vscode from "vscode"
import { commands } from "vscode"

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const commandDisposable = vscode.commands.registerCommand(
    "lite-note.newFleetingNote",
    async () => {
      try {
        const today = new Date().toISOString().split("T").shift()

        const [firstInboxFile] = await vscode.workspace.findFiles(
          "**inbox/**.md"
        )

        let inboxFolderPath = firstInboxFile?.fsPath ?? ""

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
          commands.executeCommand("vscode.open", fleetingNote)
          vscode.window.showInformationMessage("Fleeting note already exists.")
          return
        }

        const wsPath = vscode.workspace?.workspaceFolders?.[0].uri.fsPath

        if (!wsPath) {
          return
        }

        const filePath = vscode.Uri.file(`${wsPath}/_inbox/${today}.md`)
        const worspaceEdit = new vscode.WorkspaceEdit()
        worspaceEdit.createFile(filePath, { ignoreIfExists: true })
        worspaceEdit.insert(
          filePath,
          new vscode.Position(0, 0),
          `# ${new Date().toLocaleDateString(vscode.env.language)}\n`
        )

        await vscode.workspace.applyEdit(worspaceEdit)
        vscode.window.showTextDocument(filePath)
      } catch (error) {
        console.warn(error)
      }
    }
  )

  context.subscriptions.push(commandDisposable)
}

// this method is called when your extension is deactivated
export function deactivate() {}
