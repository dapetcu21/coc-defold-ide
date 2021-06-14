import {
  ExtensionContext,
  commands,
  workspace,
  Document,
  TextEdit,
  Range,
  Uri,
  WorkspaceEdit,
  Position,
} from "coc.nvim";
import path from "path";
import { Edit, refactorHashes } from "../refactorHash";

function applyEdits(document: Document, edits: Edit[]): TextEdit[] {
  const textDocument = document.textDocument;
  const textEdits: TextEdit[] = [];

  edits.forEach(edit => {
    switch (edit.type) {
      case 'insert':
        textEdits.push(TextEdit.insert(
          textDocument.positionAt(edit.offset),
          edit.text,
        ))
        break;
      case 'replace':
        textEdits.push(TextEdit.replace(
          Range.create(
            textDocument.positionAt(edit.startOffset),
            textDocument.positionAt(edit.endOffset),
          ),
          edit.text,
        ))
        break;
    }
  })

  return textEdits
}

async function refactorHash(context: ExtensionContext, visual: boolean) {
  const currentDocument = await workspace.document
  if (!currentDocument) { return ; }

  const config = workspace.getConfiguration("defoldIDE.refactorHash");
  const prefix: string = config.get("prefix") || "";
  const capitalise: boolean = !!config.get("capitalise");
  const modulePath: string = config.get("modulePath") || "";
  const moduleRequireBinding: string =
    config.get("moduleRequireBinding") || "h";

  let moduleDocument: Document | undefined;
  if (modulePath) {
    const url = Uri.file(path.resolve(workspace.root, modulePath))
    moduleDocument = await workspace.loadFile(url.toString())
  }

  let documentText: string = currentDocument.textDocument.getText()
  let moduleText: string = moduleDocument?.textDocument?.getText() ?? ""

  let selectionRange: Range;
  if (visual) {
    const visualRange = await workspace.nvim.eval(`[
      [line("'<") - 1, strchars(strpart(getline("'<"), 0, col("'<") - 1))],
      [line("'>") - 1, strchars(strpart(getline("'>"), 0, col("'>")))]
    ]`.split('\n').map(s => s.trim()).join(""))
    context.logger.info("visualRange", visualRange)
    selectionRange = Range.create(
      Position.create(visualRange[0][0], visualRange[0][1]),
      Position.create(visualRange[1][0], visualRange[1][1]),
    )
  } else {
    const cursor = await workspace.nvim.eval("coc#util#cursor()")
    context.logger.info("cursor", cursor)
    selectionRange = currentDocument.getWordRangeAtPosition(
      Position.create(cursor[0], cursor[1])
    );
  }
  if (!selectionRange) { return; }
  const selection = currentDocument.textDocument.getText(selectionRange)
  context.logger.info("selectionRange", selectionRange, selection)

  const { documentEdits, moduleEdits } = refactorHashes(
    [selection],
    documentText,
    moduleText,
    {
      prefix,
      capitalise,
      modulePath,
      moduleRequireBinding,
    }
  );

  if (documentEdits.length === 0 && moduleEdits.length === 0) {
    return;
  }

  const workspaceEdit: WorkspaceEdit = { changes: {} }

  const documentTextEdits = applyEdits(currentDocument, documentEdits)
  if (documentTextEdits.length) {
    workspaceEdit.changes[currentDocument.uri] = documentTextEdits
  }

  if (moduleDocument) {
    const moduleTextEdits = applyEdits(moduleDocument, moduleEdits)
    if (moduleTextEdits.length) {
      workspaceEdit.changes[moduleDocument.uri] = moduleTextEdits
    }
  }

  await workspace.applyEdit(workspaceEdit)
}

export default function registerRefactorHashCommand(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand(
    "defold-ide.refactorHash",
    async function () { await refactorHash(context, false) }
  ))

  context.subscriptions.push(commands.registerCommand(
    "defold-ide.refactorHashVisual",
    async function () { await refactorHash(context, true) }
  ))
}
