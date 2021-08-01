import * as vscode from "vscode"
import { resolve, relative } from "path"
const markdownLinkExtractor = require("markdown-link-extractor")

const updateLinkPath = async (
  files: readonly {
    oldUri: vscode.Uri
    newUri: vscode.Uri
  }[]
) => {
  const notes = await vscode.workspace.findFiles(
    "**/*.md",
    "**​/node_modules/**"
  )

  for (const note of notes) {
    const noteContentBuffer = await vscode.workspace.fs.readFile(note)

    const initialNoteContent = noteContentBuffer.toString()
    let noteContent = initialNoteContent

    for (const fileRenamed of files) {
      if (!fileRenamed.newUri.fsPath.endsWith("md")) {
        continue
      }

      const noteFolderPath = resolve(note.path, "../")

      const newRelativePath = relative(noteFolderPath, fileRenamed.newUri.path)

      const parsedNewRelativePath = newRelativePath.startsWith("../")
        ? newRelativePath
        : newRelativePath.startsWith("./")
        ? newRelativePath
        : `./${newRelativePath}`

      const links: string[] = markdownLinkExtractor(noteContent)

      for (const link of links) {
        const absoluteURI = resolve(noteFolderPath, link)

        if (absoluteURI === fileRenamed.oldUri.path) {
          noteContent = noteContent.replace(
            RegExp(`\(${link}\)`),
            parsedNewRelativePath
          )
        }
      }
    }

    if (initialNoteContent !== noteContent) {
      vscode.workspace.fs.writeFile(
        note,
        new Uint8Array(Buffer.from(noteContent))
      )
    }
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposeRenameFiles = vscode.workspace.onDidRenameFiles(
    async (fileRenameEvent) => {
      if (
        !fileRenameEvent.files.some((file) =>
          file.newUri.fsPath.endsWith(".md")
        )
      ) {
        return
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
          title: "Updating link path...",
        },
        () => updateLinkPath(fileRenameEvent.files)
      )
    }
  )

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
          await vscode.workspace.openTextDocument(fleetingNote)
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
      } catch (error) {
        console.warn(error)
      }
    }
  )

  context.subscriptions.push(...[commandDisposable, disposeRenameFiles])
}

// this method is called when your extension is deactivated
export function deactivate() {}
