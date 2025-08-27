import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { File } from "./use-projects"

export interface TerminalHistoryEntry {
    type: 'input' | 'output' | 'error' | 'system'
    content: string
    timestamp: number
}

export interface ProcessTerminalState {
    history: TerminalHistoryEntry[]
    prompt: string
    shownSlots: Set<number>
    queue: TerminalHistoryEntry[],
    activeFile: File | null
}

interface TerminalStateActions {
    addTerminalEntry: (processId: string, entry: TerminalHistoryEntry) => void
    setTerminalPrompt: (processId: string, prompt: string) => void
    clearTerminalHistory: (processId: string) => void
    getTerminalState: (processId: string) => ProcessTerminalState
    addShownSlot: (processId: string, slot: number) => void
    hasShownSlot: (processId: string, slot: number) => boolean
    clearShownSlots: (processId: string) => void
    addToQueue: (processId: string, entry: TerminalHistoryEntry) => void
    processQueue: (processId: string) => TerminalHistoryEntry[]
    clearQueue: (processId: string) => void
    setActiveFile: (processId: string, file: File | null) => void
}

export interface TerminalState {
    terminalStates: { [processId: string]: ProcessTerminalState },
    actions: TerminalStateActions
}

export const useTerminalState = create<TerminalState>()(persist((set, get) => ({
    terminalStates: {},
    actions: {
        addTerminalEntry: (processId: string, entry: TerminalHistoryEntry) => set((state) => ({
            terminalStates: {
                ...state.terminalStates,
                [processId]: {
                    ...state.terminalStates[processId],
                    history: [
                        ...(state.terminalStates[processId]?.history || []),
                        entry
                    ],
                    prompt: state.terminalStates[processId]?.prompt || "aos> ",
                    shownSlots: state.terminalStates[processId]?.shownSlots || new Set(),
                    queue: state.terminalStates[processId]?.queue || []
                }
            }
        })),

        setTerminalPrompt: (processId: string, prompt: string) => set((state) => ({
            terminalStates: {
                ...state.terminalStates,
                [processId]: {
                    ...state.terminalStates[processId],
                    history: state.terminalStates[processId]?.history || [],
                    prompt,
                    shownSlots: state.terminalStates[processId]?.shownSlots || new Set(),
                    queue: state.terminalStates[processId]?.queue || []
                }
            }
        })),

        clearTerminalHistory: (processId: string) => set((state) => ({
            terminalStates: {
                ...state.terminalStates,
                [processId]: {
                    history: [],
                    prompt: state.terminalStates[processId]?.prompt || "aos> ",
                    shownSlots: new Set(), // Clear shown slots when clearing history
                    queue: state.terminalStates[processId]?.queue || [],
                    activeFile: state.terminalStates[processId]?.activeFile || null
                }
            }
        })),

        getTerminalState: (processId: string) => {
            const state = get()
            return state.terminalStates[processId] || { history: [], prompt: "aos> ", shownSlots: new Set(), queue: [], activeFile: null }
        },

        addShownSlot: (processId: string, slot: number) => set((state) => {
            const currentState = state.terminalStates[processId] || { history: [], prompt: "aos> ", shownSlots: new Set(), queue: [] }
            const newShownSlots = new Set(currentState.shownSlots)
            newShownSlots.add(slot)

            return {
                terminalStates: {
                    ...state.terminalStates,
                    [processId]: {
                        ...currentState,
                        shownSlots: newShownSlots,
                        queue: currentState.queue || [],
                        activeFile: state.terminalStates[processId]?.activeFile || null
                    }
                }
            }
        }),

        hasShownSlot: (processId: string, slot: number) => {
            const state = get()
            const processState = state.terminalStates[processId]
            return processState?.shownSlots?.has(slot) || false
        },

        clearShownSlots: (processId: string) => set((state) => ({
            terminalStates: {
                ...state.terminalStates,
                [processId]: {
                    ...state.terminalStates[processId],
                    history: state.terminalStates[processId]?.history || [],
                    prompt: state.terminalStates[processId]?.prompt || "aos> ",
                    shownSlots: new Set(),
                    queue: state.terminalStates[processId]?.queue || [],
                    activeFile: state.terminalStates[processId]?.activeFile || null
                }
            }
        })),

        addToQueue: (processId: string, entry: TerminalHistoryEntry) => set((state) => {
            const currentState = state.terminalStates[processId] || { history: [], prompt: "aos> ", shownSlots: new Set(), queue: [], activeFile: null }
            return {
                terminalStates: {
                    ...state.terminalStates,
                    [processId]: {
                        ...currentState,
                        queue: [...currentState.queue, entry],
                        activeFile: currentState.activeFile || null
                    }
                }
            }
        }),

        processQueue: (processId: string) => {
            const state = get()
            const processState = state.terminalStates[processId]
            const queuedEntries = processState?.queue || []

            // Move queue items to history
            if (queuedEntries.length > 0) {
                set((state) => ({
                    terminalStates: {
                        ...state.terminalStates,
                        [processId]: {
                            ...state.terminalStates[processId],
                            history: [
                                ...(state.terminalStates[processId]?.history || []),
                                ...queuedEntries
                            ],
                            queue: [],
                            activeFile: state.terminalStates[processId]?.activeFile || null
                        }
                    }
                }))
            }

            return queuedEntries
        },

        clearQueue: (processId: string) => set((state) => ({
            terminalStates: {
                ...state.terminalStates,
                [processId]: {
                    ...state.terminalStates[processId],
                    history: state.terminalStates[processId]?.history || [],
                    prompt: state.terminalStates[processId]?.prompt || "aos> ",
                    shownSlots: state.terminalStates[processId]?.shownSlots || new Set(),
                    queue: [],
                    activeFile: state.terminalStates[processId]?.activeFile || null
                }
            }
        })),

        setActiveFile: (processId: string, file: File | null) => set((state) => ({
            terminalStates: {
                ...state.terminalStates,
                [processId]: {
                    ...state.terminalStates[processId],
                    history: state.terminalStates[processId]?.history || [],
                    prompt: state.terminalStates[processId]?.prompt || "aos> ",
                    shownSlots: state.terminalStates[processId]?.shownSlots || new Set(),
                    queue: state.terminalStates[processId]?.queue || [],
                    activeFile: file
                }
            }
        }))
    }
}), {
    name: "betteridea-terminal-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        terminalStates: Object.fromEntries(
            Object.entries(state.terminalStates).map(([processId, terminalState]) => [
                processId,
                {
                    ...terminalState,
                    shownSlots: Array.from(terminalState.shownSlots || new Set()),
                    queue: terminalState.queue || [],
                    activeFile: terminalState.activeFile || null
                }
            ])
        )
    }),
    onRehydrateStorage: () => (state) => {
        if (state?.terminalStates) {
            // Convert arrays back to Sets when loading from storage
            Object.keys(state.terminalStates).forEach(processId => {
                const terminalState = state.terminalStates[processId]
                if (terminalState && Array.isArray(terminalState.shownSlots)) {
                    terminalState.shownSlots = new Set(terminalState.shownSlots)
                    terminalState.queue = terminalState.queue || []
                    terminalState.activeFile = terminalState.activeFile || null
                } else if (!terminalState.shownSlots) {
                    terminalState.shownSlots = new Set()
                    terminalState.queue = terminalState.queue || []
                    terminalState.activeFile = terminalState.activeFile || null
                }
            })
        }
    }
}))
