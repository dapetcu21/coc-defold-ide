// eslint-disable-next-line no-unused-vars
import * as vscode from "coc.nvim";

import registerRefactorHashCommand from "./commandRefactorHash";

export function activate(context: vscode.ExtensionContext) {
  registerRefactorHashCommand(context);
}

export function deactivate() {}
