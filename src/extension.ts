import * as vscode from "vscode"
import { resolve, relative } from "path"
const markdownLinkExtractor = require("markdown-link-extractor")

type MovedFiles = ReadonlyArray<{
  oldUri: vscode.Uri
  newUri: vscode.Uri
}>

const parseRelativePath = (newRelativePath: string) => {
  return newRelativePath.startsWith("../")
    ? newRelativePath
    : newRelativePath.startsWith("./")
    ? newRelativePath
    : `./${newRelativePath}`
}

const updateLinkPath = async (files: MovedFiles) => {
  const notes = await vscode.workspace.findFiles(
    "**/*.md",
    "**/node_modules/**/*"
  )

  await updateLinkPathInMovedFiles(files)
  await updateLinkPathInNotes(notes, files)
}

const updateLinkPathInMovedFiles = async (files: MovedFiles) => {
  for (const file of files) {
    const oldFilePath = resolve(file.oldUri.path, "../")
    const filePath = resolve(file.newUri.path, "../")
    const fileContentBuffer = await vscode.workspace.fs.readFile(file.newUri)
    const initialFileContent = fileContentBuffer.toString()
    let fileContent = initialFileContent

    // get all paths
    const linkRegex = /\[(.*?)\]\(.*?\)/gm
    const pathRegex = /\(([^)]+)\)/
    let lastMatch: RegExpExecArray | null = null

    while (
      linkRegex.global &&
      (lastMatch = linkRegex.exec(initialFileContent))
    ) {
      const [link] = lastMatch
      const pathResult = link.match(pathRegex)
      const oldPath = pathResult?.[1]

      if (oldPath) {
        const absolutePath = resolve(oldFilePath, oldPath)
        const newPath = relative(filePath, absolutePath)

        try {
          // Does file exist
          await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath))
        } catch (error) {
          continue
        }

        const parsedNewRelativePath = parseRelativePath(newPath)

        fileContent = fileContent.replace(
          RegExp(`\(${oldPath}\)`),
          parsedNewRelativePath
        )
      }
    }

    if (initialFileContent !== fileContent) {
      vscode.workspace.fs.writeFile(
        file.newUri,
        new Uint8Array(Buffer.from(fileContent))
      )
    }
  }
}

const updateLinkPathInNotes = async (
  notes: vscode.Uri[],
  files: MovedFiles
) => {
  for (const note of notes) {
    const noteContentBuffer = await vscode.workspace.fs.readFile(note)

    const initialNoteContent = noteContentBuffer.toString()
    let noteContent = initialNoteContent

    for (const fileRenamed of files) {
      const noteFolderPath = resolve(note.path, "../")

      const newRelativePath = relative(noteFolderPath, fileRenamed.newUri.path)

      const parsedNewRelativePath = parseRelativePath(newRelativePath)

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
      const markdownFiles = fileRenameEvent.files.filter((file) =>
        file.newUri.fsPath.endsWith(".md")
      )
      if (!markdownFiles.length) {
        return
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
          title: "Updating link path...",
        },
        () => updateLinkPath(markdownFiles)
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
