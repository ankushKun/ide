import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { useTheme } from './theme-provider'
import { ANSI, cn, isExecutionError, parseOutput } from '@/lib/utils'
import { useSettings } from '@/hooks/use-settings'
import { useProjects, type File } from '@/hooks/use-projects'
import { useGlobalState } from '@/hooks/use-global-state'
import { useTerminalState, type TerminalHistoryEntry } from '@/hooks/use-terminal-state'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Readline } from 'xterm-readline'
import '@xterm/xterm/css/xterm.css'
import { MainnetAO } from '@/lib/ao'
import { createSigner } from '@permaweb/aoconnect'
import { useApi } from '@arweave-wallet-kit/react'

// Utility function for pretty printing tables
interface TableColumn {
    header: string
    key: string
    align?: 'left' | 'right' | 'center'
    maxWidth?: number
}

interface TableRow {
    [key: string]: string | number
}

function createPrettyTable(data: TableRow[], columns: TableColumn[], highlightRowIndex?: number): string[] {
    if (!data.length) return ['No data to display']

    // Calculate column widths
    const columnWidths = columns.map(col => {
        const headerWidth = col.header.length
        const maxDataWidth = Math.max(
            ...data.map(row => String(row[col.key] || '').length)
        )
        const width = Math.max(headerWidth, maxDataWidth)
        return col.maxWidth ? Math.min(width, col.maxWidth) : width
    })

    // Helper function to pad text based on alignment
    const padText = (text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string => {
        const truncated = text.length > width ? text.substring(0, width - 3) + '...' : text
        const padding = width - truncated.length

        switch (align) {
            case 'right':
                return ' '.repeat(padding) + truncated
            case 'center':
                const leftPad = Math.floor(padding / 2)
                const rightPad = padding - leftPad
                return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad)
            default:
                return truncated + ' '.repeat(padding)
        }
    }

    const lines: string[] = []

    // Create header row
    const headerRow = columns.map((col, i) =>
        padText(col.header, columnWidths[i], col.align)
    ).join(' │ ')
    lines.push('┌─' + columnWidths.map(w => '─'.repeat(w)).join('─┬─') + '─┐')
    lines.push('│ ' + headerRow + ' │')

    // Create separator
    lines.push('├─' + columnWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤')

    // Create data rows
    data.forEach((row, rowIndex) => {
        const dataRow = columns.map((col, i) =>
            padText(String(row[col.key] || ''), columnWidths[i], col.align)
        ).join(' │ ')

        // Highlight the row if it matches the highlightRowIndex
        if (highlightRowIndex !== undefined && rowIndex === highlightRowIndex) {
            lines.push('│ ' + ANSI.LIGHTGREEN + dataRow + ANSI.RESET + ' │')
        } else {
            lines.push('│ ' + dataRow + ' │')
        }
    })

    // Create bottom border
    lines.push('└─' + columnWidths.map(w => '─'.repeat(w)).join('─┴─') + '─┘')

    return lines
}

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

export default function Terminal() {
    const settings = useSettings()
    const activeProjectId = useGlobalState(s => s.activeProject)
    const project = useProjects(s => s.projects[activeProjectId])
    const process = project?.process

    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const readlineRef = useRef<Readline | null>(null)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [prompt, setPrompt] = useState("aos> ")
    const [activeFile, setActiveFile] = useState<File | null>(null)

    // Terminal state management
    const { addTerminalEntry, setTerminalPrompt, clearTerminalHistory, getTerminalState, processQueue, setActiveFile: setTerminalActiveFile } = useTerminalState(s => s.actions)
    const terminalState = process ? getTerminalState(process) : { history: [], prompt: "aos> " }

    // Spinner state
    const spinnerIntervalRef = useRef<NodeJS.Timeout | null>(null)
    // const spinnerChars = ['▖', '▘', '▝', '▗']
    // const spinnerChars = "⢎⡰,⢎⡡,⢎⡑,⢎⠱,⠎⡱,⢊⡱,⢌⡱,⢆⡱".split(",")
    const spinnerChars = "⣷⣯⣟⡿⢿⣻⣽⣾".split("")
    // const spinnerChars = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏".split("")
    const spinnerIndexRef = useRef(0)

    // Spinner functions
    const startSpinner = useCallback(() => {
        if (spinnerIntervalRef.current) {
            clearInterval(spinnerIntervalRef.current)
        }
        spinnerIntervalRef.current = setInterval(() => {
            if (xtermRef.current) {
                const spinnerChar = spinnerChars[spinnerIndexRef.current++ % spinnerChars.length]
                xtermRef.current.write(ANSI.RESET + ANSI.GREEN + "\r" + spinnerChar + " computing... " + ANSI.RESET)
            }
        }, 100)
    }, [])

    const stopSpinner = useCallback(() => {
        if (spinnerIntervalRef.current) {
            clearInterval(spinnerIntervalRef.current)
            spinnerIntervalRef.current = null
        }
        if (xtermRef.current) {
            xtermRef.current.write('\r' + ' '.repeat(15) + '\r') // Clear the spinner area (computing [x] is ~13 chars)
        }
    }, [])

    const { theme } = useTheme()
    const api = useApi()
    const ao = new MainnetAO({
        HB_URL: settings.HB_URL,
        GATEWAY_URL: settings.GATEWAY_URL,
        signer: createSigner(api)
    })

    // Function to show initial terminal state (ASCII art + connection message)
    const showInitialTerminalState = useCallback(() => {
        if (!xtermRef.current || !process) return

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
        xtermRef.current.write("\n" + ANSI.RESET + ANSI.DIM + "Connected to process: " + ANSI.RESET + ANSI.LIGHTBLUE + process + ANSI.RESET)
        xtermRef.current.write('\n\r\n')
    }, [process])

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

    // Function to restore terminal history
    const restoreTerminalHistory = useCallback(() => {
        if (!xtermRef.current || !process) return

        const state = getTerminalState(process)

        // Show initial state first
        showInitialTerminalState()

        // Restore history
        state.history.forEach(entry => {
            switch (entry.type) {
                case 'input':
                    xtermRef.current!.write(ANSI.RESET + state.prompt + entry.content + '\r\n')
                    break
                case 'output':
                    writeMultiLineContent(entry.content, ANSI.RESET)
                    break
                case 'error':
                    writeMultiLineContent(entry.content, ANSI.RESET + ANSI.RED, ANSI.RESET)
                    break
                case 'system':
                    writeMultiLineContent(entry.content, ANSI.RESET + ANSI.DIM, ANSI.RESET)
                    break
            }
        })

        // Process queued entries and display them
        const queuedEntries = processQueue(process)
        queuedEntries.forEach(entry => {
            switch (entry.type) {
                case 'input':
                    xtermRef.current!.write(ANSI.RESET + state.prompt + entry.content + '\r\n')
                    break
                case 'output':
                    writeMultiLineContent(entry.content, ANSI.RESET)
                    break
                case 'error':
                    writeMultiLineContent(entry.content, ANSI.RESET + ANSI.RED, ANSI.RESET)
                    break
                case 'system':
                    writeMultiLineContent(entry.content, ANSI.RESET + ANSI.DIM, ANSI.RESET)
                    break
            }
        })

        // Set the current prompt
        setPrompt(state.prompt)

        // Always show the current prompt in the terminal so user knows where to type
        xtermRef.current!.write(ANSI.RESET + state.prompt)
    }, [process, getTerminalState, showInitialTerminalState, processQueue, writeMultiLineContent])

    // Function to clear terminal to initial state
    const clearTerminalToInitialState = useCallback(() => {
        if (!process || !xtermRef.current) return

        // Get current prompt before clearing
        const currentPrompt = prompt

        // Clear the stored history but preserve the prompt
        clearTerminalHistory(process)

        // Restore the prompt that was cleared
        setTerminalPrompt(process, currentPrompt)

        // Show initial state
        showInitialTerminalState()

        // Show the current prompt in the terminal so user knows where to type
        xtermRef.current.write(ANSI.RESET + currentPrompt)
    }, [process, prompt, clearTerminalHistory, setTerminalPrompt, showInitialTerminalState])


    useEffect(() => {
        if (!process) return

        // Always use stored prompt first, then fetch from server if needed
        const storedState = getTerminalState(process)

        // Set the stored prompt immediately
        setPrompt(storedState.prompt)

        // Only fetch from server if we don't have a stored prompt or it's the default
        if (!storedState.prompt || storedState.prompt === "aos> ") {
            const hashpath = `${settings.HB_URL}/${process}/now/results/output/prompt/~json@1.0/serialize`
            fetch(hashpath).then(res => res.json()).then(data => {
                const newPrompt = data.body || "aos> "
                setPrompt(newPrompt)
                setTerminalPrompt(process, newPrompt)
            }).catch(() => {
                // Keep the current stored prompt on error
                const currentPrompt = getTerminalState(process).prompt
                setPrompt(currentPrompt)
            })
        }
    }, [process, theme, getTerminalState, setTerminalPrompt])

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
                clearTerminalToInitialState()
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
                    clearTerminalToInitialState()
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

        // Restore terminal history after terminal is ready
        setTimeout(() => {
            restoreTerminalHistory()
        }, 100)

        function logOutput(event: Event) {
            const eventDetail = (event as CustomEvent<{ output: string; eventId?: string }>).detail
            const output = eventDetail.output
            const eventId = eventDetail.eventId

            console.log(output)
            if (xtermRef.current && readlineRef.current && process) {
                // Clear the current line before logging output
                xtermRef.current.write(ANSI.CLEARLINE)

                // Add the output to terminal history so it persists
                addTerminalEntry(process, {
                    type: 'output',
                    content: output.trim(),
                    timestamp: Date.now()
                })

                // Use println to properly handle the output with newlines
                readlineRef.current.println(ANSI.RESET + output.trim() + ANSI.RESET)

                // Ensure the prompt is shown after the output
                const safePrompt = typeof prompt === 'string' && prompt.length > 0 ? prompt : "aos> "
                xtermRef.current.write(safePrompt)

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
    }, [theme, restoreTerminalHistory, clearTerminalToInitialState])



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
            if (!process) {
                readlineRef.current.println("");
                readlineRef.current.println(ANSI.RESET + ANSI.RED + "[No process found on project]" + ANSI.RESET);
                readlineRef.current.println(ANSI.RESET + ANSI.RED + "[Go into Settings > Project and set or create a new process]" + ANSI.RESET);
                return
            }
            const safePrompt = typeof prompt === 'string' && prompt.length > 0 ? prompt : "aos> "
            readlineRef.current.read(safePrompt).then(processLine);
        }

        function clearLines(count: number) {
            for (let i = 0; i < count; i++) {
                xtermRef.current.write('\x1b[A'); // Move up 1 line
                xtermRef.current.write('\x1b[2K'); // Clear current line
            }
        }

        async function processLine(text: string) {
            if (!text || text.trim() == "") {
                return setTimeout(readLine, 100);
            }

            switch (text.split(" ")[0]) {
                case "clear":
                    clearTerminalToInitialState()
                    break;
                case ".list":
                    // Add input to history
                    if (process) {
                        addTerminalEntry(process, {
                            type: 'input',
                            content: text,
                            timestamp: Date.now()
                        })
                    }
                    // list project files and their processes in a table format (lua and luanb only)
                    const files = project?.files
                    if (!files || Object.keys(files).length === 0) {
                        readlineRef.current.println(ANSI.RESET + ANSI.YELLOW + "No files found in project" + ANSI.RESET)
                        break
                    }

                    const tableData = Object.entries(files)
                        .filter(([filename, file]: [string, any]) =>
                            filename.endsWith('.lua') || filename.endsWith('.luanb')
                        )
                        .map(([filename, file]: [string, any], index) => ({
                            index: index.toString(),
                            name: filename,
                            process: file.process || 'default'
                        }))

                    if (tableData.length === 0) {
                        readlineRef.current.println(ANSI.RESET + ANSI.YELLOW + "No Lua files found in project" + ANSI.RESET)
                        break
                    }

                    // Find the index of the active file to highlight it (from terminal state)
                    const terminalState = getTerminalState(process)
                    const activeFileName = terminalState.activeFile?.name
                    const activeFileIndex = activeFileName ? tableData.findIndex(row => row.name === activeFileName) : -1

                    const columns: TableColumn[] = [
                        { header: '#', key: 'index', align: 'right', maxWidth: 3 },
                        { header: 'File Name', key: 'name', align: 'left', maxWidth: 20 },
                        { header: 'Process ID', key: 'process', align: 'left', maxWidth: 45 }
                    ]

                    const tableLines = createPrettyTable(tableData, columns, activeFileIndex >= 0 ? activeFileIndex : undefined)

                    // Apply green color to table lines for both display and history storage
                    const coloredTableLines = tableLines.map(line => ANSI.RESET + ANSI.GREEN + line + ANSI.RESET)

                    // Add instructional message
                    const instructionalMessage = "\n" + ANSI.RESET + ANSI.DIM + "Use " + ANSI.RESET + ANSI.CYAN + ".select <#>" + ANSI.RESET + ANSI.DIM + " to set the active file for this terminal" + ANSI.RESET

                    // Add terminal entry for the table output with colors preserved
                    if (process) {
                        addTerminalEntry(process, {
                            type: 'output',
                            content: coloredTableLines.join('\n') + instructionalMessage,
                            timestamp: Date.now()
                        })
                    }

                    // Print each line of the table
                    coloredTableLines.forEach(line => {
                        readlineRef.current.println(line)
                    })

                    // Add instructional message
                    readlineRef.current.println("")
                    readlineRef.current.println(ANSI.RESET + ANSI.DIM + "Use " + ANSI.RESET + ANSI.CYAN + ".select <#>" + ANSI.RESET + ANSI.DIM + " to set the active file for this terminal" + ANSI.RESET)
                    break;
                case ".select":
                    // Add input to history
                    if (process) {
                        addTerminalEntry(process, {
                            type: 'input',
                            content: text,
                            timestamp: Date.now()
                        })
                    }

                    const indexStr = text.split(" ")[1]

                    // Validate input
                    if (!indexStr) {
                        const errorMessage = "\n" + ANSI.RESET + ANSI.RED + "✗ Error: " + ANSI.RESET + "Please specify a file index\n" +
                            ANSI.RESET + ANSI.DIM + "  Usage: " + ANSI.RESET + ANSI.CYAN + ".select <#>" + ANSI.RESET + "\n" +
                            ANSI.RESET + ANSI.DIM + "  Run " + ANSI.RESET + ANSI.CYAN + ".list" + ANSI.RESET + ANSI.DIM + " to see available files" + ANSI.RESET

                        if (process) {
                            addTerminalEntry(process, {
                                type: 'error',
                                content: errorMessage,
                                timestamp: Date.now()
                            })
                        }

                        readlineRef.current.println("")
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "✗ Error: " + ANSI.RESET + "Please specify a file index")
                        readlineRef.current.println(ANSI.RESET + ANSI.DIM + "  Usage: " + ANSI.RESET + ANSI.CYAN + ".select <#>" + ANSI.RESET)
                        readlineRef.current.println(ANSI.RESET + ANSI.DIM + "  Run " + ANSI.RESET + ANSI.CYAN + ".list" + ANSI.RESET + ANSI.DIM + " to see available files" + ANSI.RESET)
                        break
                    }

                    const index = parseInt(indexStr)

                    if (isNaN(index)) {
                        const errorMessage = "\n" + ANSI.RESET + ANSI.RED + "✗ Error: " + ANSI.RESET + "Invalid file index '" + indexStr + "'\n" +
                            ANSI.RESET + ANSI.DIM + "  Please use a numeric index from the " + ANSI.RESET + ANSI.CYAN + ".list" + ANSI.RESET + ANSI.DIM + " command" + ANSI.RESET

                        if (process) {
                            addTerminalEntry(process, {
                                type: 'error',
                                content: errorMessage,
                                timestamp: Date.now()
                            })
                        }

                        readlineRef.current.println("")
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "✗ Error: " + ANSI.RESET + "Invalid file index '" + indexStr + "'")
                        readlineRef.current.println(ANSI.RESET + ANSI.DIM + "  Please use a numeric index from the " + ANSI.RESET + ANSI.CYAN + ".list" + ANSI.RESET + ANSI.DIM + " command" + ANSI.RESET)
                        break
                    }

                    // Filter to only Lua files (same as .list command)
                    const luaFiles = Object.entries(project?.files || {})
                        .filter(([filename, file]: [string, any]) =>
                            filename.endsWith('.lua') || filename.endsWith('.luanb')
                        )

                    if (index < 0 || index >= luaFiles.length) {
                        const errorMessage = "\n" + ANSI.RESET + ANSI.RED + "✗ Error: " + ANSI.RESET + "File index " + index + " is out of range\n" +
                            ANSI.RESET + ANSI.DIM + "  Available indices: 0-" + (luaFiles.length - 1) + ANSI.RESET + "\n" +
                            ANSI.RESET + ANSI.DIM + "  Run " + ANSI.RESET + ANSI.CYAN + ".list" + ANSI.RESET + ANSI.DIM + " to see available files" + ANSI.RESET

                        if (process) {
                            addTerminalEntry(process, {
                                type: 'error',
                                content: errorMessage,
                                timestamp: Date.now()
                            })
                        }

                        readlineRef.current.println("")
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + "✗ Error: " + ANSI.RESET + "File index " + index + " is out of range")
                        readlineRef.current.println(ANSI.RESET + ANSI.DIM + "  Available indices: 0-" + (luaFiles.length - 1) + ANSI.RESET)
                        readlineRef.current.println(ANSI.RESET + ANSI.DIM + "  Run " + ANSI.RESET + ANSI.CYAN + ".list" + ANSI.RESET + ANSI.DIM + " to see available files" + ANSI.RESET)
                        break
                    }

                    const file = luaFiles[index]

                    // Set the active file in terminal state
                    if (process) {
                        setTerminalActiveFile(process, file[1])
                    }
                    setActiveFile(file[1])

                    // Beautiful success message
                    const successMessage = "\n" + ANSI.RESET + ANSI.GREEN + "✓ Active file selected:" + ANSI.RESET + "\n" +
                        ANSI.RESET + "  " + ANSI.LIGHTBLUE + "File: " + ANSI.RESET + ANSI.WHITE + file[0] + ANSI.RESET + "\n" +
                        ANSI.RESET + "  " + ANSI.LIGHTBLUE + "Process: " + ANSI.RESET + ANSI.WHITE + (file[1].process || "default") + ANSI.RESET + "\n"

                    if (process) {
                        addTerminalEntry(process, {
                            type: 'output',
                            content: successMessage,
                            timestamp: Date.now()
                        })
                    }

                    readlineRef.current.println("")
                    readlineRef.current.println(ANSI.RESET + ANSI.GREEN + "✓ Active file selected:" + ANSI.RESET)
                    readlineRef.current.println(ANSI.RESET + "  " + ANSI.LIGHTBLUE + "File: " + ANSI.RESET + ANSI.WHITE + file[0] + ANSI.RESET)
                    readlineRef.current.println(ANSI.RESET + "  " + ANSI.LIGHTBLUE + "Process: " + ANSI.RESET + ANSI.WHITE + (file[1].process || "default") + ANSI.RESET)


                    break;
                default:
                    // Add input to history
                    if (process) {
                        addTerminalEntry(process, {
                            type: 'input',
                            content: text,
                            timestamp: Date.now()
                        })
                    }

                    // Start spinner
                    startSpinner();

                    try {
                        const result = await ao.runLua({ processId: process, code: text })
                        console.log(result)

                        // Stop spinner and clear only the spinner line
                        stopSpinner()

                        // Check if execution resulted in an error
                        const hasError = isExecutionError(result)
                        const parsedOutput = parseOutput(result)

                        const newPrompt = result.output?.prompt || result.prompt
                        const finalPrompt = typeof newPrompt === 'string' && newPrompt.length > 0 ? newPrompt : prompt
                        setPrompt(finalPrompt)

                        // Update stored prompt and add to history with appropriate type
                        if (process) {
                            setTerminalPrompt(process, finalPrompt)
                            addTerminalEntry(process, {
                                type: hasError ? 'error' : 'output',
                                content: parsedOutput,
                                timestamp: Date.now()
                            })
                        }

                        // Print the output with appropriate styling
                        if (hasError) {
                            readlineRef.current.println(ANSI.RESET + ANSI.RED + parsedOutput + ANSI.RESET)
                        } else {
                            readlineRef.current.println(parsedOutput)
                        }
                    } catch (error) {
                        // Stop spinner and clear only the spinner line
                        stopSpinner()

                        const errorMessage = `[Error: ${error.message || 'Unknown error'}]`

                        // Add error to history
                        if (process) {
                            addTerminalEntry(process, {
                                type: 'error',
                                content: errorMessage,
                                timestamp: Date.now()
                            })
                        }

                        // Print the error on a new line (command remains visible)
                        readlineRef.current.println(ANSI.RESET + ANSI.RED + errorMessage + ANSI.RESET)
                    }
            }

            setTimeout(readLine, 100);
        }

        readLine()

    }, [isReady, readlineRef, xtermRef, prompt, theme, process, addTerminalEntry, setTerminalPrompt, clearTerminalHistory, restoreTerminalHistory, clearTerminalToInitialState, ao, startSpinner, stopSpinner])

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