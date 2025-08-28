import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { useTheme } from '../theme-provider'
import { ANSI, cn, isExecutionError, parseOutput } from '@/lib/utils'
import { useSettings } from '@/hooks/use-settings'
import { useProjects } from '@/hooks/use-projects'
import { useGlobalState } from '@/hooks/use-global-state'
import { useTerminal } from '@/hooks/use-terminal'

import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Readline } from 'xterm-readline'
import '@xterm/xterm/css/xterm.css'
import { MainnetAO } from '@/lib/ao'
import { createSigner } from '@permaweb/aoconnect'
import { useApi } from '@arweave-wallet-kit/react'

const AOS_ASCII = String.raw`
      ___           ___           ___     
     /\  \         /\  \         /\  \    
    /::\  \       /::\  \       /::\  \   
   /:/\:\  \     /:/\:\  \     /:/\ \  \  
  /::\~\:\  \   /:/  \:\  \   _\:\~\ \  \ 
 /:/\:\ \:\__\ /:/__/ \:\__\ /\ \:\ \ \__\
 \/__\:\/:/  / \:\  \ /:/  / \:\ \:\ \/__/
      \::/  /   \:\  /:/  /   \:\ \:\__\  
      /:/  /     \:\/:/  /     \:\/:/  /  
     /:/  /       \::/  /       \::/  /   
     \/__/         \/__/         \/__/    
`

// define window properties
declare global {
    interface Window {
        xtermPrompt: string
        activeTerminalFile: string
    }
}

export default function Terminal() {
    const settings = useSettings()
    const activeProjectId = useGlobalState(s => s.activeProject)
    const project = useProjects(s => s.projects[activeProjectId])
    const { actions: globalActions, activeProject } = useGlobalState()
    const { actions: projectsActions } = useProjects()
    const { addHistoryEntry, getProjectHistory, clearProjectHistory } = useTerminal()
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const readlineRef = useRef<Readline | null>(null)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const [isReady, setIsReady] = useState(false)

    // Initialize window.activeTerminalFile if not set
    if (typeof window.activeTerminalFile === 'undefined') {
        window.activeTerminalFile = ""
    }

    // Function to update the prompt based on current activeTerminalFile
    const updatePrompt = useCallback(() => {
        if (!window.activeTerminalFile) {
            window.xtermPrompt = project?.processPrompt || "no-project-process?> "
        } else {
            if (project?.files[window.activeTerminalFile]?.process) {
                window.xtermPrompt = ANSI.RESET + ANSI.DIM + window.activeTerminalFile + ANSI.RESET + ANSI.DIM + ">" + ANSI.RESET + project?.files[window.activeTerminalFile]?.processPrompt || "no-file-process?> "
            } else {
                window.xtermPrompt = ANSI.RESET + ANSI.DIM + window.activeTerminalFile + ANSI.RESET + ANSI.DIM + ">" + ANSI.RESET + project?.processPrompt || "no-project-process?> "
            }
        }

        console.log(window.activeTerminalFile, window.xtermPrompt)
    }, [project])

    // Update prompt when project changes
    useEffect(() => {
        updatePrompt()
    }, [updatePrompt])


    // Spinner state
    const spinnerIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const spinnerChars = "⣷⣯⣟⡿⢿⣻⣽⣾".split("")
    const spinnerIndexRef = useRef(0)

    // Spinner functions
    const startSpinner = useCallback(() => {
        if (spinnerIntervalRef.current) {
            clearInterval(spinnerIntervalRef.current)
        }
        spinnerIntervalRef.current = setInterval(() => {
            if (xtermRef.current) {
                const spinnerChar = spinnerChars[spinnerIndexRef.current++ % spinnerChars.length]
                // Clear the entire line first, then write the spinner
                xtermRef.current.write(ANSI.RESET + "\r" + ANSI.CLEARLINE + ANSI.GREEN + spinnerChar + " computing... " + ANSI.RESET)
            }
        }, 100)
    }, [])

    const stopSpinner = useCallback(() => {
        if (spinnerIntervalRef.current) {
            clearInterval(spinnerIntervalRef.current)
            spinnerIntervalRef.current = null
        }
        if (xtermRef.current) {
            // Clear the entire line and return to beginning
            xtermRef.current.write(ANSI.RESET + "\r" + ANSI.CLEARLINE)
        }
    }, [])

    const { theme } = useTheme()
    const api = useApi()
    const ao = new MainnetAO({
        HB_URL: settings.HB_URL,
        GATEWAY_URL: settings.GATEWAY_URL,
        signer: createSigner(api)
    })

    // Function to beautify error output
    const beautifyErrorOutput = useCallback((errorText: string): string => {
        if (!errorText || errorText.trim() === '') {
            return ANSI.RESET + ANSI.RED + "✗ Execution Error" + ANSI.RESET + "\n" +
                ANSI.RESET + ANSI.DIM + "  No error details available" + ANSI.RESET
        }

        // Split error into lines for better formatting
        const lines = errorText.trim().split('\n')
        let formattedError = ANSI.RESET + ANSI.RED + "✗ Lua Execution Error:" + ANSI.RESET + "\n"

        lines.forEach((line, index) => {
            if (line.trim()) {
                // Indent each line and apply styling
                if (line.includes('error:') || line.includes('Error:')) {
                    // Main error line - make it stand out
                    formattedError += ANSI.RESET + "  " + ANSI.RED + line.trim() + ANSI.RESET + "\n"
                } else if (line.includes('stack traceback:') || line.includes('Stack traceback:')) {
                    // Stack trace header
                    formattedError += ANSI.RESET + "  " + ANSI.YELLOW + line.trim() + ANSI.RESET + "\n"
                } else if (line.includes('stdin:') || line.match(/^\s*\[.*\]:/)) {
                    // File/line references
                    formattedError += ANSI.RESET + "    " + ANSI.CYAN + line.trim() + ANSI.RESET + "\n"
                } else {
                    // Other error details
                    formattedError += ANSI.RESET + "  " + ANSI.DIM + line.trim() + ANSI.RESET + "\n"
                }
            }
        })

        return formattedError.trim()
    }, [])

    // Helper function to write multi-line content with proper formatting
    const writeMultiLineContent = useCallback((content: string, prefix: string = '', suffix: string = '') => {
        if (!xtermRef.current) return

        const lines = content.split('\n')
        lines.forEach((line, index) => {
            xtermRef.current!.write(prefix + line + suffix)
            // Only add \r\n if we're not on the last line, or if the last line is not empty
            if (index < lines.length - 1) {
                xtermRef.current!.write('\r\n')
            }
        })
        // Always add a final \r\n to end the entry
        xtermRef.current!.write('\r\n')
    }, [])

    // Function to restore terminal history from state
    const restoreTerminalHistory = useCallback(() => {
        if (!xtermRef.current || !activeProjectId) return

        const history = getProjectHistory(activeProjectId)

        // Restore each history entry
        history.forEach((entry) => {
            switch (entry.type) {
                case 'command':
                    // Show the command with prompt
                    const promptToUse = entry.activeFile && project?.files[entry.activeFile]?.process
                        ? ANSI.RESET + ANSI.DIM + entry.activeFile + ANSI.RESET + ANSI.DIM + ">" + ANSI.RESET + (project?.files[entry.activeFile]?.processPrompt || "no-file-process?> ")
                        : project?.processPrompt || "no-project-process?> "
                    xtermRef.current!.write(promptToUse + entry.content + '\r\n')
                    break
                case 'output':
                case 'error':
                    // Show the output/error
                    writeMultiLineContent(entry.content)
                    break
                case 'system':
                    // Show system messages (like ls output)
                    writeMultiLineContent(entry.content)
                    break
            }
        })
    }, [activeProjectId, getProjectHistory, project?.files, project?.processPrompt, writeMultiLineContent])

    // Function to show initial terminal state (ASCII art + connection message)
    const showInitialTerminalState = useCallback((restoreHistory: boolean = false) => {
        if (!xtermRef.current || !project?.process) return

        // Clear terminal first
        xtermRef.current.clear()

        // Show ASCII art
        const asciiLines = AOS_ASCII.split('\n')
        xtermRef.current.writeln("")
        asciiLines.forEach((line, index) => {
            if (index === 0 && line.trim() === '') return // Skip first empty line
            xtermRef.current!.write(ANSI.RESET + ANSI.LIGHTBLUE + line + ANSI.RESET)
            if (index < asciiLines.length - 1) {
                xtermRef.current!.write('\r\n') // Add proper carriage return + line feed
            }
        })

        // Determine which process and file info to show
        const activeFile = window.activeTerminalFile
        const isFileProcess = activeFile && project?.files[activeFile]?.process && project?.files[activeFile]?.process !== project?.process

        let connectionMessage = "\n" + ANSI.RESET + ANSI.DIM + "Connected to process: " + ANSI.RESET + ANSI.LIGHTBLUE +
            (isFileProcess ? project?.files[activeFile]?.process : project?.process) + ANSI.RESET

        // Add file information if there's an active file
        if (activeFile) {
            connectionMessage += "\n\r" + ANSI.RESET + ANSI.DIM + "Active file: " + ANSI.RESET + ANSI.YELLOW + activeFile + ANSI.RESET
            if (isFileProcess) {
                connectionMessage += ANSI.RESET + ANSI.DIM + " (using file process)" + ANSI.RESET
            } else {
                connectionMessage += ANSI.RESET + ANSI.DIM + " (using project process)" + ANSI.RESET
            }
        }

        xtermRef.current.write(connectionMessage)
        xtermRef.current.write('\n\r\n')

        // Restore history if requested
        if (restoreHistory) {
            restoreTerminalHistory()
        }
    }, [project?.process, project?.files, restoreTerminalHistory])



    // Get theme configuration
    const getThemeConfig = (currentTheme: string) => {
        return {
            background: currentTheme === "dark" ? "black" : "white",
            foreground: currentTheme === "dark" ? "white" : "black",
            cursor: currentTheme === "dark" ? "white" : "black",
            selectionBackground: currentTheme === "dark" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
            selectionForeground: currentTheme === "dark" ? "black" : "white",
            cursorAccent: currentTheme === "dark" ? "white" : "black",
        }
    }

    // Initialize terminal
    useEffect(() => {
        if (!terminalRef.current) return

        // Initialize terminal
        const xterm = new XTerm({
            smoothScrollDuration: 0,
            cursorBlink: true,
            cursorStyle: "bar",
            fontSize: 14,
            fontFamily: '"DM Mono", monospace',
            cursorWidth: 25,
            theme: getThemeConfig(theme),
            allowTransparency: false,
            cols: 80,
            rows: 30,
            lineHeight: 1,
            letterSpacing: 0,
            fontWeight: 'normal',
            fontWeightBold: 'bold',
        })

        // Initialize addons
        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()
        const readline = new Readline()

        // Load addons
        xterm.loadAddon(fitAddon)
        xterm.loadAddon(webLinksAddon)
        xterm.loadAddon(readline)

        // Add keyboard handler for Ctrl+L
        xterm.onKey(({ key, domEvent }) => {
            if (domEvent.ctrlKey && (domEvent.key === 'l' || domEvent.key === 'L')) {
                domEvent.preventDefault()
                domEvent.stopPropagation()

                if (!project?.process || !xtermRef.current) return false

                // Update prompt first to reflect current active file
                updatePrompt()

                // Show initial state
                showInitialTerminalState()

                // Show the current prompt in the terminal so user knows where to type
                xtermRef.current.write(ANSI.RESET + window.xtermPrompt)
                return false
            }
        })

        // Also add a global keydown listener to catch Ctrl+L before it reaches the browser
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
                // Only handle if the terminal is focused or if we're in the terminal container
                const terminalContainer = terminalRef.current
                if (terminalContainer && (document.activeElement === terminalContainer || terminalContainer.contains(document.activeElement))) {
                    event.preventDefault()
                    event.stopPropagation()

                    if (!project?.process || !xtermRef.current) return

                    // Update prompt first to reflect current active file
                    updatePrompt()

                    // Show initial state
                    showInitialTerminalState()

                    // Show the current prompt in the terminal so user knows where to type
                    xtermRef.current.write(ANSI.RESET + window.xtermPrompt)
                }
            }
        }

        document.addEventListener('keydown', handleGlobalKeyDown, true)

        // Open terminal
        xterm.open(terminalRef.current)

        // Store references
        xtermRef.current = xterm
        fitAddonRef.current = fitAddon
        readlineRef.current = readline

        // Fit terminal to container (with safety check)
        setTimeout(() => {
            if (terminalRef.current) {
                const rect = terminalRef.current.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    try {
                        fitAddon.fit()
                    } catch (error) {
                        console.warn('Initial terminal fit error:', error)
                    }
                }
            }
        }, 10)

        setIsReady(true)

        // Initialize terminal after terminal is ready
        setTimeout(() => {
            if (!xtermRef.current || !project?.process) return

            // Update prompt first to reflect current active file
            updatePrompt()

            // Show initial state with history restoration
            showInitialTerminalState(true)

            // Show the current prompt in the terminal so user knows where to type
            xtermRef.current.write(ANSI.RESET + window.xtermPrompt)
        }, 100)

        function logOutput(event: Event) {
            const eventDetail = (event as CustomEvent<{ output: string; eventId?: string }>).detail
            const output = eventDetail.output
            const eventId = eventDetail.eventId

            console.log(output)
            if (xtermRef.current && readlineRef.current) {
                // Clear the current line before logging output
                xtermRef.current.write(ANSI.CLEARLINE)

                // Use println to properly handle the output with newlines
                readlineRef.current.println(ANSI.RESET + output.trim() + ANSI.RESET)

                // Ensure the prompt is shown after the output
                xtermRef.current.write(window.xtermPrompt)

                // Send response back to the triggering component if eventId is provided
                if (eventId) {
                    const responseEvent = new CustomEvent(`terminal-response-${eventId}`);
                    window.dispatchEvent(responseEvent);
                }
            }
        }

        window.addEventListener("log-output", logOutput)

        // Cleanup
        return () => {
            // Clean up spinner
            if (spinnerIntervalRef.current) {
                clearInterval(spinnerIntervalRef.current)
                spinnerIntervalRef.current = null
            }

            // Remove global keydown listener
            document.removeEventListener('keydown', handleGlobalKeyDown, true)

            xterm.dispose()
            xtermRef.current = null
            fitAddonRef.current = null
            readlineRef.current = null
            setIsReady(false)

            window.removeEventListener("log-output", logOutput)
        }
    }, [theme])

    // Fit terminal to container with debouncing
    const fitTerminal = useCallback(() => {
        if (fitAddonRef.current && xtermRef.current && isReady && terminalRef.current) {
            // Check if the terminal container has proper dimensions
            const container = terminalRef.current
            const rect = container.getBoundingClientRect()

            // Only fit if container has actual dimensions
            if (rect.width > 0 && rect.height > 0) {
                try {
                    fitAddonRef.current.fit()
                } catch (error) {
                    console.warn('Terminal fit error:', error)
                }
            }
        }
    }, [isReady, xtermRef, terminalRef, fitAddonRef])

    // Update theme when it changes
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getThemeConfig(theme)
        }
    }, [theme])

    // Handle dynamic resizing with ResizeObserver and window resize
    useEffect(() => {
        if (!terminalRef.current || !isReady) return

        let resizeTimeout: NodeJS.Timeout

        const debouncedFit = () => {
            clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(fitTerminal, 50)
        }

        // Use ResizeObserver for container size changes
        if (window.ResizeObserver) {
            resizeObserverRef.current = new ResizeObserver(debouncedFit)
            resizeObserverRef.current.observe(terminalRef.current)
        }

        // Fallback to window resize events
        const handleWindowResize = debouncedFit
        window.addEventListener('resize', handleWindowResize)

        // Initial fit after a short delay to ensure DOM is ready
        setTimeout(fitTerminal, 150)

        return () => {
            clearTimeout(resizeTimeout)
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect()
                resizeObserverRef.current = null
            }
            window.removeEventListener('resize', handleWindowResize)
        }
    }, [isReady, fitTerminal])

    useEffect(() => {
        if (!isReady) return
        if (!readlineRef.current) return
        if (!xtermRef.current) return

        function readLine() {
            if (!readlineRef.current) return
            while (!readlineRef.current.writeReady()) { }
            if (!project?.process) {
                readlineRef.current.println("");
                readlineRef.current.println(ANSI.RESET + ANSI.RED + "[No process found on project]" + ANSI.RESET);
                readlineRef.current.println(ANSI.RESET + ANSI.RED + "[Go into Settings > Project and set or create a new process]" + ANSI.RESET);
                return
            }
            readlineRef.current.read(window.xtermPrompt).then(processLine);
        }

        async function processLine(text: string) {
            if (!text || text.trim() == "") {
                return setTimeout(readLine, 100);
            }

            // Save command to history
            if (activeProjectId) {
                addHistoryEntry(activeProjectId, {
                    type: 'command',
                    content: text,
                    activeFile: window.activeTerminalFile
                })
            }

            switch (text.split(" ")[0]) {
                case "clear":
                    if (!project?.process || !xtermRef.current) break

                    // Clear history for this project when user runs clear
                    if (activeProjectId) {
                        clearProjectHistory(activeProjectId)
                    }

                    // Update prompt first to reflect current active file
                    updatePrompt()

                    // Show initial state (without history since we just cleared it)
                    showInitialTerminalState(false)

                    // Show the current prompt in the terminal so user knows where to type
                    xtermRef.current.write(ANSI.RESET + window.xtermPrompt)
                    break;
                case "ls": case ".list":
                    // print files and their processes with index starting from 1
                    const files = project?.files
                    if (!files) {
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "No files found" + ANSI.RESET)
                        break;
                    }

                    const fileEntries = Object.entries(files)
                    if (fileEntries.length === 0) {
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "No files found" + ANSI.RESET)
                        break;
                    }

                    // Calculate column widths for proper alignment
                    const maxIndexWidth = Math.max(1, fileEntries.length.toString().length)
                    const maxFileWidth = Math.max(4, ...fileEntries.map(([filename]) => filename.length))
                    // Use full process width but set a reasonable minimum
                    const maxProcessWidth = Math.max(7, ...fileEntries.map(([, file]) => (file.process || 'none').length))

                    // Create table header - calculate exact width
                    // Format: │ index │ file │ process │
                    // Width: 1 + 1 + maxIndexWidth + 1 + 1 + 1 + maxFileWidth + 1 + 1 + 1 + maxProcessWidth + 1 + 1
                    const totalTableWidth = maxIndexWidth + maxFileWidth + maxProcessWidth + 8
                    const headerSeparator = "─".repeat(totalTableWidth)
                    readlineRef.current.println("")
                    readlineRef.current.println(ANSI.RESET + ANSI.CYAN + "┌" + headerSeparator + "┐" + ANSI.RESET)

                    // Header row
                    const indexHeader = "#".padStart(maxIndexWidth)
                    const fileHeader = "File".padEnd(maxFileWidth)
                    const processHeader = "Process".padEnd(maxProcessWidth)
                    readlineRef.current.println(ANSI.RESET + ANSI.CYAN + "│ " + ANSI.RESET + ANSI.BOLD + ANSI.WHITE + indexHeader + ANSI.RESET + ANSI.CYAN + " │ " + ANSI.RESET + ANSI.BOLD + ANSI.WHITE + fileHeader + ANSI.RESET + ANSI.CYAN + " │ " + ANSI.RESET + ANSI.BOLD + ANSI.WHITE + processHeader + ANSI.RESET + ANSI.CYAN + " │" + ANSI.RESET)

                    // Header separator
                    readlineRef.current.println(ANSI.RESET + ANSI.CYAN + "├" + "─".repeat(maxIndexWidth + 2) + "┼" + "─".repeat(maxFileWidth + 2) + "┼" + "─".repeat(maxProcessWidth + 2) + "┤" + ANSI.RESET)

                    // File rows
                    fileEntries.forEach(([filename, file], index) => {
                        const isActive = window.activeTerminalFile === filename
                        const indexStr = (index + 1).toString().padStart(maxIndexWidth)
                        const filenameStr = filename.padEnd(maxFileWidth)
                        const processStr = (file.process || 'none').padEnd(maxProcessWidth)

                        // Apply highlighting for active file
                        if (isActive) {
                            // Active file - highlighted with green background and bold text
                            readlineRef.current.println(
                                ANSI.RESET + ANSI.CYAN + "│ " +
                                ANSI.RESET + ANSI.BG_GREEN + ANSI.BLACK + ANSI.BOLD + indexStr.slice(0, -1) + "►" + ANSI.RESET +
                                ANSI.CYAN + " │ " +
                                ANSI.RESET + ANSI.BG_GREEN + ANSI.BLACK + ANSI.BOLD + filenameStr + ANSI.RESET +
                                ANSI.CYAN + " │ " +
                                ANSI.RESET + ANSI.BG_GREEN + ANSI.BLACK + ANSI.BOLD + processStr + ANSI.RESET +
                                ANSI.CYAN + " │" + ANSI.RESET
                            )
                        } else {
                            // Regular file
                            readlineRef.current.println(
                                ANSI.RESET + ANSI.CYAN + "│ " +
                                ANSI.RESET + ANSI.WHITE + indexStr + ANSI.RESET +
                                ANSI.CYAN + " │ " +
                                ANSI.RESET + ANSI.LIGHTCYAN + filenameStr + ANSI.RESET +
                                ANSI.CYAN + " │ " +
                                ANSI.RESET + ANSI.DIM + processStr + ANSI.RESET +
                                ANSI.CYAN + " │" + ANSI.RESET
                            )
                        }
                    })

                    // Table footer
                    readlineRef.current.println(ANSI.RESET + ANSI.CYAN + "└" + headerSeparator + "┘" + ANSI.RESET)
                    readlineRef.current.println("")

                    // Instructions
                    if (window.activeTerminalFile) {
                        readlineRef.current.println(ANSI.RESET + ANSI.GREEN + "► Currently active: " + ANSI.BOLD + window.activeTerminalFile + ANSI.RESET)
                    }
                    readlineRef.current.println(ANSI.RESET + ANSI.DIM + "Use " + ANSI.RESET + ANSI.YELLOW + ".select <index>" + ANSI.RESET + ANSI.DIM + " to switch files or " + ANSI.RESET + ANSI.YELLOW + ".reset" + ANSI.RESET + ANSI.DIM + " to use project process" + ANSI.RESET)

                    // Save ls output to history
                    if (activeProjectId) {
                        // Capture the entire ls output for history
                        let lsOutput = "\n"
                        lsOutput += ANSI.RESET + ANSI.CYAN + "┌" + headerSeparator + "┐" + ANSI.RESET + "\n"
                        lsOutput += ANSI.RESET + ANSI.CYAN + "│ " + ANSI.RESET + ANSI.BOLD + ANSI.WHITE + indexHeader + ANSI.RESET + ANSI.CYAN + " │ " + ANSI.RESET + ANSI.BOLD + ANSI.WHITE + fileHeader + ANSI.RESET + ANSI.CYAN + " │ " + ANSI.RESET + ANSI.BOLD + ANSI.WHITE + processHeader + ANSI.RESET + ANSI.CYAN + " │" + ANSI.RESET + "\n"
                        lsOutput += ANSI.RESET + ANSI.CYAN + "├" + "─".repeat(maxIndexWidth + 2) + "┼" + "─".repeat(maxFileWidth + 2) + "┼" + "─".repeat(maxProcessWidth + 2) + "┤" + ANSI.RESET + "\n"

                        fileEntries.forEach(([filename, file], index) => {
                            const isActive = window.activeTerminalFile === filename
                            const indexStr = (index + 1).toString().padStart(maxIndexWidth)
                            const filenameStr = filename.padEnd(maxFileWidth)
                            const processStr = (file.process || 'none').padEnd(maxProcessWidth)

                            if (isActive) {
                                lsOutput += ANSI.RESET + ANSI.CYAN + "│ " +
                                    ANSI.RESET + ANSI.BG_GREEN + ANSI.BLACK + ANSI.BOLD + indexStr.slice(0, -1) + "►" + ANSI.RESET +
                                    ANSI.CYAN + " │ " +
                                    ANSI.RESET + ANSI.BG_GREEN + ANSI.BLACK + ANSI.BOLD + filenameStr + ANSI.RESET +
                                    ANSI.CYAN + " │ " +
                                    ANSI.RESET + ANSI.BG_GREEN + ANSI.BLACK + ANSI.BOLD + processStr + ANSI.RESET +
                                    ANSI.CYAN + " │" + ANSI.RESET + "\n"
                            } else {
                                lsOutput += ANSI.RESET + ANSI.CYAN + "│ " +
                                    ANSI.RESET + ANSI.WHITE + indexStr + ANSI.RESET +
                                    ANSI.CYAN + " │ " +
                                    ANSI.RESET + ANSI.LIGHTCYAN + filenameStr + ANSI.RESET +
                                    ANSI.CYAN + " │ " +
                                    ANSI.RESET + ANSI.DIM + processStr + ANSI.RESET +
                                    ANSI.CYAN + " │" + ANSI.RESET + "\n"
                            }
                        })

                        lsOutput += ANSI.RESET + ANSI.CYAN + "└" + headerSeparator + "┘" + ANSI.RESET + "\n\n"

                        if (window.activeTerminalFile) {
                            lsOutput += ANSI.RESET + ANSI.GREEN + "► Currently active: " + ANSI.BOLD + window.activeTerminalFile + ANSI.RESET + "\n"
                        }
                        lsOutput += ANSI.RESET + ANSI.DIM + "Use " + ANSI.RESET + ANSI.YELLOW + ".select <index>" + ANSI.RESET + ANSI.DIM + " to switch files or " + ANSI.RESET + ANSI.YELLOW + ".reset" + ANSI.RESET + ANSI.DIM + " to use project process" + ANSI.RESET

                        addHistoryEntry(activeProjectId, {
                            type: 'system',
                            content: lsOutput
                        })
                    }
                    break;
                case ".select":
                    // select a file by index
                    // sets activeTerminalFile to the selected file
                    // sets prompt to the selected file's process prompt
                    const selectedFileIndex = parseInt(text.split(" ")[1]) - 1
                    const selectedFile = Object.keys(project?.files || {})[selectedFileIndex]
                    console.log(selectedFile)
                    if (!selectedFile) {
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "No file selected" + ANSI.RESET)
                        break;
                    }
                    const file = project?.files[selectedFile]
                    if (!file) {
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "File not found" + ANSI.RESET)
                        break;
                    }

                    window.activeTerminalFile = selectedFile
                    updatePrompt()
                    break;
                case ".reset":
                    window.activeTerminalFile = ""
                    updatePrompt()
                    break;
                default:
                    // Start spinner
                    startSpinner();

                    try {
                        const isFileProcess = project?.files[window.activeTerminalFile]?.process && project?.files[window.activeTerminalFile]?.process !== project?.process
                        const result = await ao.runLua({ processId: isFileProcess ? project?.files[window.activeTerminalFile]?.process : project?.process, code: text })
                        console.log(result)
                        console.log(isFileProcess)
                        if (isFileProcess) {
                            projectsActions.setFileProcessPrompt(activeProject, window.activeTerminalFile, result.output.prompt)
                        } else {
                            projectsActions.setProjectProcessPrompt(activeProject, project?.process, result.output.prompt)
                        }

                        // Stop spinner and clear only the spinner line
                        stopSpinner()

                        // Check if execution resulted in an error
                        const hasError = isExecutionError(result)
                        const parsedOutput = parseOutput(result)

                        // Prepare output content with appropriate styling
                        const displayContent = hasError ? beautifyErrorOutput(parsedOutput) : parsedOutput

                        // Print the output with appropriate styling
                        readlineRef.current.println(displayContent)

                        // Save output to history
                        if (activeProjectId) {
                            addHistoryEntry(activeProjectId, {
                                type: hasError ? 'error' : 'output',
                                content: displayContent,
                                activeFile: window.activeTerminalFile
                            })
                        }
                    } catch (error) {
                        // Stop spinner and clear only the spinner line
                        stopSpinner()

                        const beautifiedCatchError = ANSI.RESET + ANSI.RED + "✗ Connection Error:" + ANSI.RESET + "\n" +
                            ANSI.RESET + "  " + ANSI.RED + (error.message || 'Unknown error') + ANSI.RESET + "\n" +
                            ANSI.RESET + ANSI.DIM + "  Check your connection and try again" + ANSI.RESET

                        // Print the error on a new line (command remains visible)
                        readlineRef.current.println(beautifiedCatchError)

                        // Save catch error to history
                        if (activeProjectId) {
                            addHistoryEntry(activeProjectId, {
                                type: 'error',
                                content: beautifiedCatchError,
                                activeFile: window.activeTerminalFile
                            })
                        }
                    }
            }

            setTimeout(readLine, 100);
        }

        readLine()

    }, [isReady, readlineRef, xtermRef, theme, project?.process, ao, startSpinner, stopSpinner, beautifyErrorOutput, updatePrompt])

    return (
        <div className={cn("h-full w-full flex flex-col px-1.5 m-0", theme === "dark" ? "bg-black" : "bg-white")}>
            <div
                ref={terminalRef}
                className="flex-1 overflow-hidden"
                style={{
                    minHeight: 0,
                    padding: '0px',
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '14px',
                    lineHeight: '1',
                    letterSpacing: 'normal'
                }}
            />
        </div>
    )
}