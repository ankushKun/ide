/**
 * Global vim mode manager to coordinate vim status updates between different editors
 */

import { initVimMode } from 'monaco-vim';

interface VimInstance {
    id: string;
    instance: any;
    dispose: () => void;
}

class VimModeManager {
    private activeVimId: string | null = null;
    private vimInstances: Map<string, VimInstance> = new Map();
    private statusNode: HTMLElement | null = null;
    private notebookGroups: Map<string, Set<string>> = new Map(); // Track which editors belong to which notebook

    constructor() {
        // Initialize status node reference
        this.updateStatusNode();
    }

    private updateStatusNode() {
        this.statusNode = document.querySelector('#vim-status');
        if (this.statusNode && this.statusNode.innerHTML === '') {
            this.statusNode.innerHTML = 'vim';
        }
    }

    /**
 * Register an editor as part of a notebook group
 */
    registerNotebookEditor(notebookId: string, editorId: string): void {
        if (!this.notebookGroups.has(notebookId)) {
            this.notebookGroups.set(notebookId, new Set());
        }
        this.notebookGroups.get(notebookId)!.add(editorId);
    }

    /**
     * Remove an editor from a notebook group
     */
    unregisterNotebookEditor(notebookId: string, editorId: string): void {
        const group = this.notebookGroups.get(notebookId);
        if (group) {
            group.delete(editorId);
            if (group.size === 0) {
                this.notebookGroups.delete(notebookId);
            }
        }
    }

    /**
     * Get the notebook ID from an editor ID
     */
    private getNotebookId(editorId: string): string | null {
        for (const [notebookId, editors] of this.notebookGroups.entries()) {
            if (editors.has(editorId)) {
                return notebookId;
            }
        }
        return null;
    }

    /**
     * Register a new vim instance
     */
    registerVimInstance(id: string, vimInstance: any): void {
        // Dispose existing instance with same id if it exists
        this.disposeVimInstance(id);

        const instance: VimInstance = {
            id,
            instance: vimInstance,
            dispose: () => {
                try {
                    if (vimInstance && typeof vimInstance.dispose === 'function') {
                        vimInstance.dispose();
                    }
                } catch (error) {
                    console.warn(`Failed to dispose vim instance ${id}:`, error);
                }
            }
        };

        this.vimInstances.set(id, instance);

        // For notebook cells, only set as active if no other cell in the same notebook is active
        const notebookId = this.getNotebookId(id);
        if (notebookId) {
            const notebookEditors = this.notebookGroups.get(notebookId);
            const hasActiveInNotebook = notebookEditors && Array.from(notebookEditors).some(editorId =>
                this.activeVimId === editorId
            );

            if (!hasActiveInNotebook) {
                this.setActiveVim(id);
            }
        } else {
            // For non-notebook editors (like single-file), always set as active
            this.setActiveVim(id);
        }

        console.log(`Vim instance registered: ${id}`);
    }

    /**
     * Set which vim instance should be active (controlling the status)
     */
    setActiveVim(id: string): void {
        if (this.vimInstances.has(id)) {
            const notebookId = this.getNotebookId(id);

            // If this is a notebook cell, make sure all other cells in the same notebook are inactive
            if (notebookId) {
                const notebookEditors = this.notebookGroups.get(notebookId);
                if (notebookEditors) {
                    // Only allow one active vim instance per notebook
                    for (const editorId of notebookEditors) {
                        if (editorId !== id && this.activeVimId === editorId) {
                            // Don't change if another cell in the same notebook is already active
                            // unless this is an explicit focus change
                            return;
                        }
                    }
                }
            }

            this.activeVimId = id;
            console.log(`Active vim instance set to: ${id}`);
        }
    }

    /**
 * Dispose a specific vim instance
 */
    disposeVimInstance(id: string): void {
        const instance = this.vimInstances.get(id);
        if (instance) {
            const notebookId = this.getNotebookId(id);

            try {
                instance.dispose();
            } catch (error) {
                console.warn(`Error disposing vim instance ${id}:`, error);
            }

            this.vimInstances.delete(id);

            // Remove from notebook group if it exists
            if (notebookId) {
                this.unregisterNotebookEditor(notebookId, id);
            }

            // If this was the active instance, try to activate another instance from the same notebook
            if (this.activeVimId === id) {
                this.activeVimId = null;

                // If this was part of a notebook, try to activate another cell in the same notebook
                if (notebookId) {
                    const notebookEditors = this.notebookGroups.get(notebookId);
                    if (notebookEditors && notebookEditors.size > 0) {
                        // Activate the first available cell in the notebook
                        const firstEditor = Array.from(notebookEditors)[0];
                        if (this.vimInstances.has(firstEditor)) {
                            this.activeVimId = firstEditor;
                            console.log(`Switched active vim to another cell in notebook: ${firstEditor}`);
                        }
                    }
                }

                if (!this.activeVimId) {
                    this.resetStatus();
                }
            }

            console.log(`Vim instance disposed: ${id}`);
        }
    }

    /**
     * Dispose vim instances by prefix (useful for component cleanup)
     */
    disposeInstancesByPrefix(prefix: string): void {
        const instancesToDispose = Array.from(this.vimInstances.keys()).filter(id => id.startsWith(prefix));
        instancesToDispose.forEach(id => {
            this.disposeVimInstance(id);
        });
        console.log(`Disposed vim instances with prefix: ${prefix}`);
    }

    /**
     * Dispose all vim instances
     */
    disposeAllInstances(): void {
        this.vimInstances.forEach((instance, id) => {
            try {
                instance.dispose();
            } catch (error) {
                console.warn(`Error disposing vim instance ${id}:`, error);
            }
        });
        this.vimInstances.clear();
        this.notebookGroups.clear();
        this.activeVimId = null;
        this.resetStatus();
        console.log('All vim instances disposed');
    }

    /**
     * Reset the status display to default
     */
    private resetStatus(): void {
        this.updateStatusNode();
        if (this.statusNode) {
            this.statusNode.innerHTML = 'vim';
        }
    }

    /**
 * Initialize vim mode for a notebook cell
 */
    async initializeNotebookVimMode(
        notebookId: string,
        editorId: string,
        editor: any,
        onVimReady?: (vimInstance: any) => void
    ): Promise<void> {
        // Register this editor as part of the notebook
        this.registerNotebookEditor(notebookId, editorId);

        return this.initializeVimMode(editorId, editor, onVimReady);
    }

    /**
 * Initialize vim mode for an editor
 */
    async initializeVimMode(
        editorId: string,
        editor: any,
        onVimReady?: (vimInstance: any) => void
    ): Promise<void> {
        const vimMode = localStorage.getItem("betteridea-vim-mode") === "true";
        if (!vimMode) return;

        // Dispose existing instance for this editor
        this.disposeVimInstance(editorId);

        // Update status node reference
        this.updateStatusNode();

        try {
            // Ensure the editor is still valid before initializing vim
            if (!editor || typeof editor.getModel !== 'function') {
                console.warn(`Invalid editor for vim initialization: ${editorId}`);
                return;
            }

            // Use the imported initVimMode function from monaco-vim
            const vim = initVimMode(editor, this.statusNode);

            if (vim && typeof vim.dispose === 'function') {
                this.registerVimInstance(editorId, vim);

                if (onVimReady) {
                    onVimReady(vim);
                }

                console.log(`Vim mode initialized for editor: ${editorId}`, vim);
            } else {
                console.warn(`Invalid vim instance returned for editor: ${editorId}`);
            }
        } catch (error) {
            console.error(`Failed to initialize vim mode for editor: ${editorId}`, error);
        }
    }

    /**
     * Handle editor focus - set as active vim instance
     */
    onEditorFocus(editorId: string): void {
        if (this.vimInstances.has(editorId)) {
            this.setActiveVim(editorId);
        }
    }

    /**
     * Handle editor blur - optionally clear active status
     */
    onEditorBlur(editorId: string): void {
        if (this.activeVimId === editorId) {
            // Keep the status but note it's no longer active
            // We don't clear it immediately to avoid flickering
        }
    }

    /**
     * Get the currently active vim instance
     */
    getActiveVimInstance(): VimInstance | null {
        if (this.activeVimId) {
            return this.vimInstances.get(this.activeVimId) || null;
        }
        return null;
    }

    /**
     * Check if vim mode is enabled
     */
    isVimModeEnabled(): boolean {
        return localStorage.getItem("betteridea-vim-mode") === "true";
    }
}

// Create a singleton instance
export const vimManager = new VimModeManager();

// Export the class for testing if needed
export { VimModeManager };
