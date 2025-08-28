import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

interface TerminalHistoryEntry {
    type: 'command' | 'output' | 'error' | 'system'
    content: string
    timestamp: number
    projectId?: string
    activeFile?: string
}

interface QueuedOutput {
    output: string
    timestamp: number
    eventId?: string
    projectId: string
}

interface TerminalState {
    // History entries for each project
    projectHistories: Record<string, TerminalHistoryEntry[]>

    // Queue for outputs when terminal is not active
    outputQueue: QueuedOutput[]

    // Track if terminal is currently active/mounted
    isTerminalActive: boolean

    // Actions
    addHistoryEntry: (projectId: string, entry: Omit<TerminalHistoryEntry, 'timestamp'>) => void
    getProjectHistory: (projectId: string) => TerminalHistoryEntry[]
    clearProjectHistory: (projectId: string) => void
    clearAllHistory: () => void

    // Queue management
    queueOutput: (output: QueuedOutput) => void
    getQueuedOutputs: (projectId?: string) => QueuedOutput[]
    clearQueue: (projectId?: string) => void
    setTerminalActive: (active: boolean) => void
}

export const useTerminal = create<TerminalState>()(persist((set, get) => ({
    projectHistories: {},
    outputQueue: [],
    isTerminalActive: false,

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
    },

    queueOutput: (output: QueuedOutput) => {
        set((state) => {
            // Keep only last 100 queued outputs to prevent memory issues
            const updatedQueue = [...state.outputQueue, output].slice(-100)
            return { outputQueue: updatedQueue }
        })
    },

    getQueuedOutputs: (projectId?: string) => {
        const queue = get().outputQueue
        if (projectId) {
            return queue.filter(item => item.projectId === projectId)
        }
        return queue
    },

    clearQueue: (projectId?: string) => {
        set((state) => {
            if (projectId) {
                return {
                    outputQueue: state.outputQueue.filter(item => item.projectId !== projectId)
                }
            }
            return { outputQueue: [] }
        })
    },

    setTerminalActive: (active: boolean) => {
        set({ isTerminalActive: active })
    }
}), {
    name: "betteridea-terminal-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        projectHistories: state.projectHistories,
        // Don't persist outputQueue and isTerminalActive as they are runtime state
    })
}))