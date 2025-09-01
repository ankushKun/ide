import { Editor, DiffEditor } from "@monaco-editor/react";
import { useGlobalState } from "@/hooks/use-global-state";
import { useProjects, type File } from "@/hooks/use-projects";
import { useTheme } from "@/components/theme-provider";
import { editor } from "monaco-editor";
import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import notebookTheme from "@/assets/themes/notebook.json";

const monacoConfig: editor.IStandaloneEditorConstructionOptions = {
    fontFamily: '"DM Mono", monospace',
    fontSize: 14,
    lineHeight: 20,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
}

const diffMonacoConfig: editor.IDiffEditorConstructionOptions = {
    fontFamily: '"DM Mono", monospace',
    fontSize: 14,
    lineHeight: 20,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    renderSideBySide: false,
}

function extensionToLanguage(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase();
    switch (extension) {
        case "json":
            return "json";
        case "md":
            return "markdown";
        case "lua":
        case "luanb":
            return "lua";
        case "js":
            return "javascript";
        case "ts":
            return "typescript";
        case "tsx":
            return "typescript";
        case "jsx":
            return "javascript";
        case "html":
            return "html";
        case "css":
            return "css";
        case "yaml":
        case "yml":
            return "yaml";
        default:
            return "plaintext";
    }
}

export default function SingleFileEditor() {
    const { activeProject, activeFile } = useGlobalState();
    const { projects } = useProjects();
    const { theme } = useTheme();

    const project = projects[activeProject];
    const file = project?.files[activeFile];

    // Refs to store Monaco instances
    const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

    // Store models for each file to maintain separate undo/redo history
    const modelsRef = useRef<Map<string, editor.ITextModel>>(new Map());

    // Helper function to get or create a model for a file
    const getOrCreateFileModel = useCallback((monaco: typeof import("monaco-editor"), fileName: string, content: string, language: string) => {
        let model = modelsRef.current.get(fileName);

        if (!model) {
            // Create a unique URI for this file
            const uri = monaco.Uri.parse(`file:///${activeProject}/${fileName}`);
            model = monaco.editor.createModel(content, language, uri);
            modelsRef.current.set(fileName, model);

            // Listen for model changes to update the file content
            model.onDidChangeContent(() => {
                if (fileName === activeFile && file && project) {
                    const updatedContent = model?.getValue() || "";
                    const firstCellId = file.cellOrder[0];

                    // Ensure cells object exists and has the cell
                    const cells = file.cells || {};
                    const currentCell = cells[firstCellId] || {
                        id: firstCellId,
                        content: "",
                        output: "",
                        type: "CODE" as const,
                        editing: false
                    };

                    const updatedFile = {
                        ...file,
                        cells: {
                            ...cells,
                            [firstCellId]: {
                                ...currentCell,
                                content: updatedContent
                            }
                        }
                    };
                    useProjects.getState().actions.setFile(activeProject, updatedFile);
                }
            });
        } else {
            // Update existing model content if it differs
            if (model.getValue() !== content) {
                model.setValue(content);
            }
        }

        return model;
    }, [activeProject, activeFile, file, project]);

    // Helper function to apply theme
    const applyTheme = useCallback((monaco: typeof import("monaco-editor")) => {
        const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (isDark) {
            monaco.editor.setTheme("notebook");
        } else {
            monaco.editor.setTheme("vs-light");
        }
    }, [theme]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.metaKey && e.key == "Enter") {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("accept-changes-btn")?.click();
            } else if (e.metaKey && e.key == "Backspace") {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("reject-changes-btn")?.click();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [])

    // Add theme change listener for dynamic theme switching
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "vite-ui-theme" && monacoRef.current) {
                // Force Monaco to update theme when storage changes
                setTimeout(() => {
                    if (monacoRef.current) {
                        const isDark = e.newValue === "dark" || (e.newValue === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
                        if (isDark) {
                            monacoRef.current.editor.setTheme("notebook");
                        } else {
                            monacoRef.current.editor.setTheme("vs-light");
                        }
                    }
                }, 100);
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, [])

    // React to theme context changes
    useEffect(() => {
        if (monacoRef.current) {
            applyTheme(monacoRef.current);
        }
    }, [theme, applyTheme])

    // Handle active file changes - switch models
    useEffect(() => {
        if (editorRef.current && monacoRef.current && activeFile && file) {
            const content = file.cells?.[file.cellOrder[0]]?.content || "";
            const language = extensionToLanguage(activeFile);
            const model = getOrCreateFileModel(monacoRef.current, activeFile, content, language);

            if (model && editorRef.current.getModel() !== model) {
                editorRef.current.setModel(model);
            }
        }
    }, [activeFile, file, getOrCreateFileModel]);

    // Cleanup models on unmount
    useEffect(() => {
        return () => {
            // Dispose all models when component unmounts
            modelsRef.current.forEach((model) => {
                if (!model.isDisposed()) {
                    model.dispose();
                }
            });
            modelsRef.current.clear();
        };
    }, []);

    if (!file || !activeFile) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                No file selected
            </div>
        );
    }

    const language = extensionToLanguage(activeFile);

    // Check if file has diff changes (simulating the old structure)
    const hasDiffChanges = (file as any).diffNew !== undefined;

    return <>
        {hasDiffChanges ? (<>
            <div className="flex items-center justify-around">
                <Button
                    variant="ghost"
                    id="reject-changes-btn"
                    className="text-sm p-2 h-5 rounded-none bg-none hover:bg-transparent text-destructive-foreground/40 hover:text-destructive-foreground/80"
                    onClick={() => {
                        if (file && project) {
                            const updatedFile = {
                                ...file,
                                diffNew: undefined
                            };
                            useProjects.getState().actions.setFile(activeProject, updatedFile);
                        }
                    }}
                >
                    Reject Changes {/Mac/.test(navigator.userAgent) ? '⌘⌫' : 'Ctrl+⌫'}
                </Button>
                <Button
                    variant="ghost"
                    id="accept-changes-btn"
                    className="text-sm p-2 h-5 rounded-none bg-none hover:bg-transparent text-primary/60 hover:text-primary"
                    onClick={() => {
                        if (file && project) {
                            const firstCellId = file.cellOrder[0];

                            // Ensure cells object exists and has the cell
                            const cells = file.cells || {};
                            const currentCell = cells[firstCellId] || {
                                id: firstCellId,
                                content: "",
                                output: "",
                                type: "CODE" as const,
                                editing: false
                            };

                            const updatedFile = {
                                ...file,
                                cells: {
                                    ...cells,
                                    [firstCellId]: {
                                        ...currentCell,
                                        content: (file as any).diffNew || ""
                                    }
                                },
                                diffNew: undefined
                            };
                            useProjects.getState().actions.setFile(activeProject, updatedFile);
                        }
                    }}
                >
                    Accept Changes {/Mac/.test(navigator.userAgent) ? '⌘⏎' : 'Ctrl⏎'}
                </Button>
            </div>
            <DiffEditor
                key={`diff-${theme}`}
                language={language}
                options={diffMonacoConfig}
                className="font-btr-code"
                height="100%"
                width="100%"
                onMount={(editor, monaco) => {
                    // Store Monaco instances in refs
                    monacoRef.current = monaco;
                    diffEditorRef.current = editor;

                    // Define and set custom notebook theme
                    monaco.editor.defineTheme(
                        "notebook",
                        notebookTheme as editor.IStandaloneThemeData
                    );

                    // Apply theme using helper function
                    applyTheme(monaco);

                    // Ensure font is properly applied
                    editor.updateOptions({
                        fontFamily: '"DM Mono", monospace',
                        fontSize: 14,
                        lineHeight: 20,
                    });

                    // Force font remeasuring
                    setTimeout(() => {
                        monaco.editor.remeasureFonts();
                    }, 100);

                    editor.getContainerDomNode().addEventListener("keydown", (e) => {
                        if (e.metaKey && e.key == "Enter") {
                            e.preventDefault()
                            e.stopPropagation()
                            document.getElementById("accept-changes-btn")?.click();
                        } else if (e.metaKey && e.key == "Backspace") {
                            e.preventDefault()
                            e.stopPropagation()
                            document.getElementById("reject-changes-btn")?.click();
                        }
                    })

                    const vimMode = localStorage.getItem("vimMode") == "true"
                    if (vimMode) {
                        console.log("vimMode", vimMode)
                        // setup monaco-vim
                        // @ts-ignore
                        window.require.config({
                            paths: {
                                "monaco-vim": "https://unpkg.com/monaco-vim/dist/monaco-vim"
                            }
                        });

                        // @ts-ignore
                        window.require(["monaco-vim"], function (MonacoVim) {
                            const statusNode = document.querySelector(`#vim-status`);
                            const vim = MonacoVim.initVimMode(editor, statusNode)
                            console.log(vim)
                        });
                    }
                }}
                original={file.cells?.[file.cellOrder[0]]?.content || ""}
                modified={(file as any).diffNew || ""}
            />
        </>
        ) : (
            <Editor
                key={`editor-${theme}`}
                className="font-btr-code"
                height="100%"
                onMount={(editor, monaco) => {
                    // Store Monaco instances in refs
                    monacoRef.current = monaco;
                    editorRef.current = editor;

                    // Define and set custom notebook theme
                    monaco.editor.defineTheme(
                        "notebook",
                        notebookTheme as editor.IStandaloneThemeData
                    );

                    // Apply theme using helper function
                    applyTheme(monaco);

                    // Get or create model for this file
                    const content = file.cells?.[file.cellOrder[0]]?.content || "";
                    const model = getOrCreateFileModel(monaco, activeFile, content, language);

                    // Set the model to the editor
                    if (model) {
                        editor.setModel(model);
                    }

                    // Ensure font is properly applied
                    editor.updateOptions({
                        fontFamily: '"DM Mono", monospace',
                        fontSize: 14,
                        lineHeight: 20,
                    });

                    // Force font remeasuring
                    setTimeout(() => {
                        monaco.editor.remeasureFonts();
                    }, 100);

                    const vimMode = localStorage.getItem("vimMode") == "true"
                    if (vimMode) {
                        console.log("vimMode", vimMode)
                        // setup monaco-vim
                        // @ts-ignore
                        window.require.config({
                            paths: {
                                "monaco-vim": "https://unpkg.com/monaco-vim/dist/monaco-vim"
                            }
                        });

                        // @ts-ignore
                        window.require(["monaco-vim"], function (MonacoVim) {
                            const statusNode = document.querySelector(`#vim-status`);
                            const vim = MonacoVim.initVimMode(editor, statusNode)
                            console.log(vim)
                        });
                    }

                    // run function on shift+enter
                    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
                        document.getElementById("run-code-btn")?.click();
                    });

                    editor.addAction({
                        id: "format-code",
                        label: "Format Code",
                        contextMenuGroupId: "navigation",
                        run: async function (editor) {
                            try {
                                const luamin = require('lua-format')
                                const input = editor.getValue()
                                console.log("formatting code")
                                const output: string = luamin.Beautify(input, {
                                    RenameVariables: false,
                                    RenameGlobals: false,
                                    SolveMath: true
                                })
                                // remove source first line
                                editor.setValue(output.split("\n").slice(1).join("\n").trimStart())
                            } catch (error) {
                                console.log("Lua format not available, trying default formatting");
                                try {
                                    await editor.getAction('editor.action.formatDocument')?.run();
                                } catch (formatError) {
                                    console.log("Format document not available");
                                }
                            }
                        },
                    })
                }}
                language={language}
                options={monacoConfig}
            />
        )}
    </>
}