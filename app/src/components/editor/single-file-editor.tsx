import { Editor, DiffEditor } from "@monaco-editor/react";
import { useGlobalState } from "@/hooks/use-global-state";
import { useProjects, type File } from "@/hooks/use-projects";
import { useTheme } from "@/components/theme-provider";
import { editor } from "monaco-editor";
import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import notebookTheme from "@/assets/themes/notebook.json";
import { vimManager } from "@/lib/vim-manager";

const monacoConfig: editor.IStandaloneEditorConstructionOptions = {
    fontFamily: '"DM Mono", monospace',
    fontSize: 14,
    lineHeight: 20,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    renderLineHighlight: 'none',
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
    },
}

const diffMonacoConfig: editor.IDiffEditorConstructionOptions = {
    fontFamily: '"DM Mono", monospace',
    fontSize: 14,
    lineHeight: 20,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    renderSideBySide: false,
    automaticLayout: true,
    renderLineHighlight: 'none',
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
    },
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
    const vimModeRef = useRef<any>(null);

    // Store models for each file to maintain separate undo/redo history
    const modelsRef = useRef<Map<string, editor.ITextModel>>(new Map());

    // Helper function to get or create a model for a file
    const getOrCreateFileModel = useCallback((monaco: typeof import("monaco-editor"), fileName: string, content: string, language: string) => {
        let model = modelsRef.current.get(fileName);

        // Check if existing model is disposed and remove it
        if (model && model.isDisposed()) {
            modelsRef.current.delete(fileName);
            model = null;
        }

        if (!model) {
            try {
                // Create a unique URI for this file
                const uri = monaco.Uri.parse(`file:///${activeProject}/${fileName}`);
                model = monaco.editor.createModel(content, language, uri);
                modelsRef.current.set(fileName, model);

                // Listen for model changes to update the file content
                model.onDidChangeContent(() => {
                    if (fileName === activeFile && file && project && model && !model.isDisposed()) {
                        try {
                            const updatedContent = model.getValue() || "";
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
                        } catch (error) {
                            // Failed to get model value
                        }
                    }
                });
            } catch (error) {
                // Failed to create Monaco model
                return null;
            }
        } else {
            // Update existing model content if it differs
            try {
                if (model && !model.isDisposed() && model.getValue() !== content) {
                    model.setValue(content);
                }
            } catch (error) {
                // Failed to update model content
                // If model is disposed, remove it from the map and return null
                modelsRef.current.delete(fileName);
                return null;
            }
        }

        // Final check before returning
        if (model && model.isDisposed()) {
            modelsRef.current.delete(fileName);
            return null;
        }

        return model;
    }, [activeProject, activeFile, file, project]);

    // Helper function to determine if dark theme should be used
    const isDarkTheme = useCallback(() => {
        return theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }, [theme]);

    // Helper function to get initial Monaco theme
    const getInitialMonacoTheme = useCallback(() => {
        return isDarkTheme() ? "vs-dark" : "vs-light";
    }, [isDarkTheme]);

    // Helper function to apply theme
    const applyTheme = useCallback((monaco: typeof import("monaco-editor")) => {
        try {
            if (isDarkTheme()) {
                monaco.editor.setTheme("notebook");
            } else {
                monaco.editor.setTheme("vs-light");
            }
        } catch (error) {
            // Failed to apply Monaco theme
        }
    }, [isDarkTheme]);

    // Helper function to initialize vim mode properly
    const initializeVimMode = useCallback(async (editor: editor.IStandaloneCodeEditor | editor.IStandaloneDiffEditor) => {
        if (!vimManager.isVimModeEnabled()) return;

        const editorId = `single-file-${activeFile}`;

        await vimManager.initializeVimMode(editorId, editor, (vimInstance) => {
            vimModeRef.current = vimInstance;
        });

        // Set up focus handlers to manage active vim instance
        // Only IStandaloneCodeEditor has getDomNode method
        const codeEditor = editor as editor.IStandaloneCodeEditor;
        if (codeEditor.getDomNode) {
            const editorDomNode = codeEditor.getDomNode();
            if (editorDomNode) {
                const handleFocus = () => vimManager.onEditorFocus(editorId);
                const handleBlur = () => vimManager.onEditorBlur(editorId);

                editorDomNode.addEventListener('focus', handleFocus, true);
                editorDomNode.addEventListener('blur', handleBlur, true);

                // Store cleanup function
                const cleanup = () => {
                    editorDomNode.removeEventListener('focus', handleFocus, true);
                    editorDomNode.removeEventListener('blur', handleBlur, true);
                };

                // Store cleanup in ref for later use
                if (!vimModeRef.current) {
                    vimModeRef.current = {};
                }
                vimModeRef.current.cleanup = cleanup;
            }
        }
    }, [activeFile]);

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
                    if (monacoRef.current && monacoRef.current.editor) {
                        try {
                            const isDark = e.newValue === "dark" || (e.newValue === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
                            if (isDark) {
                                monacoRef.current.editor.setTheme("notebook");
                            } else {
                                monacoRef.current.editor.setTheme("vs-light");
                            }
                        } catch (error) {
                            // Failed to apply Monaco theme from storage change
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
        if (monacoRef.current && monacoRef.current.editor) {
            try {
                applyTheme(monacoRef.current);
            } catch (error) {
                // Failed to apply theme on context change
            }
        }
    }, [theme, applyTheme])

    // Handle active file changes - switch models
    useEffect(() => {
        if (editorRef.current && monacoRef.current && monacoRef.current.editor && activeFile && file) {
            try {
                const content = file.cells?.[file.cellOrder[0]]?.content || "";
                const language = extensionToLanguage(activeFile);
                const model = getOrCreateFileModel(monacoRef.current, activeFile, content, language);

                if (model && editorRef.current.getModel() !== model) {
                    editorRef.current.setModel(model);
                }
            } catch (error) {
                // Failed to switch models on active file change
            }
        }
    }, [activeFile, file, getOrCreateFileModel]);

    // Handle vim cleanup when activeFile changes
    useEffect(() => {
        return () => {
            // Cleanup vim mode for the previous file when activeFile changes
            if (activeFile) {
                const editorId = `single-file-${activeFile}`;
                vimManager.disposeVimInstance(editorId);
            }
        };
    }, [activeFile]);

    // Re-initialize vim mode when activeFile changes
    useEffect(() => {
        if (editorRef.current && activeFile && vimManager.isVimModeEnabled()) {
            // Re-initializing vim mode for file

            // Small delay to ensure model switching is complete
            const timeoutId = setTimeout(() => {
                if (editorRef.current && activeFile) {
                    // Executing vim re-initialization
                    initializeVimMode(editorRef.current).catch(error => {
                        // Failed to initialize vim mode for new file
                    });
                }
            }, 50);

            return () => clearTimeout(timeoutId);
        }
    }, [activeFile, initializeVimMode]);

    // Cleanup models on unmount
    useEffect(() => {
        return () => {
            // Cleanup all single-file vim instances
            vimManager.disposeInstancesByPrefix('single-file-');

            // Cleanup focus handlers if they exist
            if (vimModeRef.current && typeof vimModeRef.current.cleanup === 'function') {
                try {
                    vimModeRef.current.cleanup();
                } catch (error) {
                    // Failed to cleanup vim focus handlers
                }
            }

            // Clear Monaco references first to prevent theme changes
            monacoRef.current = null;
            editorRef.current = null;
            diffEditorRef.current = null;
            vimModeRef.current = null;

            // Dispose all models when component unmounts
            modelsRef.current.forEach((model, fileName) => {
                try {
                    if (model && !model.isDisposed()) {
                        model.dispose();
                    }
                } catch (error) {
                    // Failed to dispose Monaco model
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
                theme={getInitialMonacoTheme()}
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
                        renderLineHighlight: 'none',
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

                    // Initialize vim mode if enabled
                    initializeVimMode(editor);
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
                theme={getInitialMonacoTheme()}
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
                    if (model && !model.isDisposed()) {
                        try {
                            editor.setModel(model);
                        } catch (error) {
                            // Failed to set model to editor
                        }
                    }

                    // Ensure font is properly applied
                    editor.updateOptions({
                        fontFamily: '"DM Mono", monospace',
                        fontSize: 14,
                        lineHeight: 20,
                        renderLineHighlight: 'none',
                    });

                    // Force font remeasuring
                    setTimeout(() => {
                        monaco.editor.remeasureFonts();
                    }, 100);

                    // Initialize vim mode if enabled
                    initializeVimMode(editor);

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
                                // Formatting code
                                const output: string = luamin.Beautify(input, {
                                    RenameVariables: false,
                                    RenameGlobals: false,
                                    SolveMath: true
                                })
                                // remove source first line
                                editor.setValue(output.split("\n").slice(1).join("\n").trimStart())
                            } catch (error) {
                                // Lua format not available, trying default formatting
                                try {
                                    await editor.getAction('editor.action.formatDocument')?.run();
                                } catch (formatError) {
                                    // Format document not available
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