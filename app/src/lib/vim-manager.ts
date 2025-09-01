/**
 * Global vim mode manager to coordinate vim status updates between different editors
 */

import { initVimMode } from 'monaco-vim';

interface VimInstance {
    id: string;
    instance: any;
    dispose: () => void;
}

interface NotebookVimState {
    masterVimInstance: VimInstance;
    editorInstances: Map<string, any>; // editorId -> editor instance
    activeEditorId: string | null;
}

class VimModeManager {
    private activeVimId: string | null = null;
    private vimInstances: Map<string, VimInstance> = new Map();
    private statusNode: HTMLElement | null = null;
    private notebookGroups: Map<string, Set<string>> = new Map(); // Track which editors belong to which notebook
    private notebookVimStates: Map<string, NotebookVimState> = new Map(); // Track vim state per notebook

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
 * Dispose a notebook cell editor
 */
    disposeNotebookCellEditor(notebookId: string, editorId: string): void {
        const notebookState = this.notebookVimStates.get(notebookId);
        if (notebookState) {
            // Remove the editor from the notebook state
            notebookState.editorInstances.delete(editorId);

            // If this was the active editor, switch to another one
            if (notebookState.activeEditorId === editorId) {
                const remainingEditors = Array.from(notebookState.editorInstances.keys());
                if (remainingEditors.length > 0) {
                    const newActiveEditor = remainingEditors[0];
                    const editor = notebookState.editorInstances.get(newActiveEditor);
                    if (editor) {
                        this.switchMasterVimToEditor(notebookId, newActiveEditor, editor);
                        notebookState.activeEditorId = newActiveEditor;
                    }
                } else {
                    // No more editors, dispose the entire notebook vim state
                    this.disposeNotebookVimState(notebookId);
                }
            }

            // Remove from notebook group
            this.unregisterNotebookEditor(notebookId, editorId);
        }
    }

    /**
     * Dispose entire notebook vim state
     */
    private disposeNotebookVimState(notebookId: string): void {
        const notebookState = this.notebookVimStates.get(notebookId);
        if (notebookState) {
            // Dispose master vim instance
            try {
                notebookState.masterVimInstance.dispose();
                this.vimInstances.delete(notebookState.masterVimInstance.id);
            } catch (error) {
                console.warn(`Error disposing notebook vim state for ${notebookId}:`, error);
            }

            // Clear the notebook state
            this.notebookVimStates.delete(notebookId);
            this.notebookGroups.delete(notebookId);

            // Reset active vim if this was active
            if (this.activeVimId === notebookState.masterVimInstance.id) {
                this.activeVimId = null;
                this.resetStatus();
            }

            console.log(`Disposed notebook vim state: ${notebookId}`);
        }
    }

    /**
     * Dispose a specific vim instance
     */
    disposeVimInstance(id: string): void {
        // Check if this is a notebook cell
        const notebookId = this.getNotebookIdForEditor(id);
        if (notebookId) {
            this.disposeNotebookCellEditor(notebookId, id);
            return;
        }

        // Handle regular (non-notebook) vim instances
        const instance = this.vimInstances.get(id);
        if (instance) {
            try {
                instance.dispose();
            } catch (error) {
                console.warn(`Error disposing vim instance ${id}:`, error);
            }

            this.vimInstances.delete(id);

            // If this was the active instance, reset
            if (this.activeVimId === id) {
                this.activeVimId = null;
                this.resetStatus();
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
        // Dispose all notebook vim states
        this.notebookVimStates.forEach((notebookState, notebookId) => {
            try {
                notebookState.masterVimInstance.dispose();
            } catch (error) {
                console.warn(`Error disposing notebook vim state ${notebookId}:`, error);
            }
        });
        this.notebookVimStates.clear();

        // Dispose regular vim instances
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
        if (!this.isVimModeEnabled()) return;

        // Register this editor as part of the notebook
        this.registerNotebookEditor(notebookId, editorId);

        // Get or create notebook vim state
        let notebookState = this.notebookVimStates.get(notebookId);

        if (!notebookState) {
            // Create master vim instance for this notebook using the first editor
            try {
                // Ensure the editor is valid
                if (!editor || typeof editor.getModel !== 'function') {
                    console.warn(`Invalid editor for notebook vim initialization: ${editorId}`);
                    return;
                }

                const masterVim = initVimMode(editor, this.statusNode);

                if (masterVim && typeof masterVim.dispose === 'function') {
                    const masterInstance: VimInstance = {
                        id: `notebook-master-${notebookId}`,
                        instance: masterVim,
                        dispose: () => {
                            try {
                                masterVim.dispose();
                            } catch (error) {
                                console.warn(`Error disposing master vim for notebook ${notebookId}:`, error);
                            }
                        }
                    };

                    notebookState = {
                        masterVimInstance: masterInstance,
                        editorInstances: new Map(),
                        activeEditorId: editorId
                    };

                    this.notebookVimStates.set(notebookId, notebookState);
                    this.vimInstances.set(masterInstance.id, masterInstance);
                    this.activeVimId = masterInstance.id;

                    console.log(`Created master vim instance for notebook: ${notebookId}`);
                }
            } catch (error) {
                console.error(`Failed to create master vim for notebook ${notebookId}:`, error);
                return;
            }
        }

        // Store the editor instance
        if (notebookState) {
            notebookState.editorInstances.set(editorId, editor);

            // If this is not the first editor, we need to sync vim state
            if (notebookState.editorInstances.size > 1) {
                this.syncVimStateToEditor(notebookId, editorId, editor);
            }

            if (onVimReady && notebookState.masterVimInstance) {
                onVimReady(notebookState.masterVimInstance.instance);
            }
        }
    }

    /**
     * Sync vim state from master to a specific editor
     */
    private syncVimStateToEditor(notebookId: string, editorId: string, editor: any): void {
        const notebookState = this.notebookVimStates.get(notebookId);
        if (!notebookState) return;

        try {
            // Create a lightweight vim binding for this editor that syncs with master
            const masterVim = notebookState.masterVimInstance.instance;

            // Initialize vim mode for this editor but don't create a separate status
            const cellVim = initVimMode(editor, null); // null status node to prevent duplicate indicators

            // Store a reference but don't track it as a separate instance
            console.log(`Synced vim state to cell: ${editorId}`);
        } catch (error) {
            console.warn(`Failed to sync vim state to editor ${editorId}:`, error);
        }
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
     * Handle notebook cell focus
     */
    onNotebookCellFocus(notebookId: string, editorId: string): void {
        const notebookState = this.notebookVimStates.get(notebookId);
        if (notebookState) {
            // Update which cell is active but keep the same master vim instance
            notebookState.activeEditorId = editorId;

            // Switch the master vim to focus on this editor
            const editor = notebookState.editorInstances.get(editorId);
            if (editor) {
                try {
                    // Re-attach the master vim to the focused editor
                    this.switchMasterVimToEditor(notebookId, editorId, editor);
                } catch (error) {
                    console.warn(`Failed to switch vim focus to cell ${editorId}:`, error);
                }
            }
        }
    }

    /**
     * Switch the master vim instance to focus on a specific editor
     */
    private switchMasterVimToEditor(notebookId: string, editorId: string, editor: any): void {
        const notebookState = this.notebookVimStates.get(notebookId);
        if (!notebookState) return;

        try {
            // Dispose the current master vim
            notebookState.masterVimInstance.dispose();

            // Create new master vim on the focused editor
            const newMasterVim = initVimMode(editor, this.statusNode);

            if (newMasterVim && typeof newMasterVim.dispose === 'function') {
                const newMasterInstance: VimInstance = {
                    id: notebookState.masterVimInstance.id,
                    instance: newMasterVim,
                    dispose: () => {
                        try {
                            newMasterVim.dispose();
                        } catch (error) {
                            console.warn(`Error disposing master vim for notebook ${notebookId}:`, error);
                        }
                    }
                };

                // Update the master instance
                notebookState.masterVimInstance = newMasterInstance;
                this.vimInstances.set(newMasterInstance.id, newMasterInstance);

                console.log(`Switched master vim to cell: ${editorId}`);
            }
        } catch (error) {
            console.error(`Failed to switch master vim to editor ${editorId}:`, error);
        }
    }

    /**
     * Handle editor focus - set as active vim instance
     */
    onEditorFocus(editorId: string): void {
        // Check if this is a notebook cell
        const notebookId = this.getNotebookIdForEditor(editorId);
        if (notebookId) {
            this.onNotebookCellFocus(notebookId, editorId);
        } else if (this.vimInstances.has(editorId)) {
            this.setActiveVim(editorId);
        }
    }

    /**
     * Get notebook ID for a given editor ID
     */
    private getNotebookIdForEditor(editorId: string): string | null {
        for (const [notebookId, notebookState] of this.notebookVimStates.entries()) {
            if (notebookState.editorInstances.has(editorId)) {
                return notebookId;
            }
        }
        return null;
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
