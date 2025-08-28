import { create } from "zustand"

interface TerminalHistoryEntry {
    type: 'command' | 'output' | 'error' | 'system'
    content: string
    timestamp: number
    projectId?: string
    activeFile?: string
}

interface TerminalState {
    // History entries for each project
    projectHistories: Record<string, TerminalHistoryEntry[]>

    // Actions
    addHistoryEntry: (projectId: string, entry: Omit<TerminalHistoryEntry, 'timestamp'>) => void
    getProjectHistory: (projectId: string) => TerminalHistoryEntry[]
    clearProjectHistory: (projectId: string) => void
    clearAllHistory: () => void
}

export const useTerminal = create<TerminalState>((set, get) => ({
    projectHistories: {},

    addHistoryEntry: (projectId: string, entry: Omit<TerminalHistoryEntry, 'timestamp'>) => {
        set((state) => {
            const projectHistory = state.projectHistories[projectId] || []
            const newEntry: TerminalHistoryEntry = {
                ...entry,
                timestamp: Date.now()
            }

            // Keep only last 1000 entries per project to prevent memory issues
            const updatedHistory = [...projectHistory, newEntry].slice(-1000)

            return {
                projectHistories: {
                    ...state.projectHistories,
                    [projectId]: updatedHistory
                }
            }
        })
    },

    getProjectHistory: (projectId: string) => {
        return get().projectHistories[projectId] || []
    },

    clearProjectHistory: (projectId: string) => {
        set((state) => ({
            projectHistories: {
                ...state.projectHistories,
                [projectId]: []
            }
        }))
    },

    clearAllHistory: () => {
        set({ projectHistories: {} })
    }
}))