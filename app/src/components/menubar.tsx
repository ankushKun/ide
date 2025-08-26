
import { FaDiscord, FaGithub, FaXTwitter } from "react-icons/fa6"
import { Link } from "react-router"
import { Menubar as MainMenubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger, MenubarSub, MenubarSubTrigger, MenubarSubContent } from "@/components/ui/menubar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { useGlobalState } from "@/hooks/use-global-state"
import { useProjects, type Project } from "@/hooks/use-projects"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import NewProject from "./menubar/new-project"
import NewFile from "./menubar/new-file"
import RenameFile from "./menubar/rename-file"
import DeleteFile from "./menubar/delete-file"
import RenameProject from "./menubar/rename-project"
import DeleteProject from "./menubar/delete-project"
import HotkeyReference from "./hotkey-reference"
import { useGlobalHotkeys } from "@/hooks/use-hotkeys"
import { HOTKEYS, getHotkeyDisplay } from "@/lib/hotkeys"

import {
    FileText,
    FolderPlus,
    FolderOpen,
    Copy,
    Edit3,
    Share,
    Trash2,
    Plus,
    X,
    Download,
    Upload,
    Settings,
    HelpCircle,
    Keyboard,
    Info,
    Eye,
    Layout,
    Palette,
    Save,
    FileUp,
    FileDown,
    Files,
    Blocks,
    Database,
    FlaskConical,
    Bot,
    BookOpenIcon,
    FileCodeIcon,
    Cannabis
} from "lucide-react"
import { fetchProjectFromProcess, isValidArweaveId, validateArweaveId } from "@/lib/utils"
import { useSettings } from "@/hooks/use-settings"
import { useActiveAddress } from "@arweave-wallet-kit/react"

const link = [
    {
        label: "Twitter",
        icon: FaXTwitter,
        link: "https://x.com/betteridea_dev"
    },
    {
        label: "GitHub",
        icon: FaGithub,
        link: "https://github.com/betteridea-dev"
    },
    {
        label: "Discord",
        icon: FaDiscord,
        link: "https://discord.gg/nm6VKUQBrA"
    }
]

const learningResources = [
    {
        title: "AO Cookbook",
        icon: BookOpenIcon,
        link: "https://cookbook_ao.ar.io",
    },
    {
        title: "Hyperbeam Docs",
        icon: FileCodeIcon,
        link: "https://hyperbeam.ar.io",
    },
    {
        title: "LLM Fuel",
        icon: Cannabis,
        link: "https://fuel_permawebllms.arweave.net/",
    }
]

export default function Menubar() {
    const { activeProject, activeFile, activeView, actions: globalActions } = useGlobalState()
    const { projects, actions: projectActions } = useProjects()
    const [isCreatingProject, setIsCreatingProject] = useState(false)
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
    const [processId, setProcessId] = useState("")
    const [isDragOver, setIsDragOver] = useState(false)
    const [projectPreview, setProjectPreview] = useState<Project | null>(null)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
    const settings = useSettings()
    const address = useActiveAddress()

    // Use the Arweave ID validator from utils.ts for process ID validation
    const isValidProcessId = (id: string) => {
        return isValidArweaveId(id)
    }

    const fetchProjectPreview = async (processIdValue: string) => {
        if (!processIdValue.trim()) return

        setIsLoadingPreview(true)
        setPreviewError(null)
        setProjectPreview(null)

        try {
            const res: Project = await fetchProjectFromProcess({
                procesId: processIdValue.trim(),
                HB_URL: settings.actions.getHbUrl()
            })

            if (res && res.name) {
                setProjectPreview(res)
                // Don't show separate confirmation dialog, show in same popup
            } else {
                setPreviewError("Invalid project data received")
            }
        } catch (error) {
            console.error("Failed to fetch project:", error)
            setPreviewError("Failed to fetch project. Please check the process ID and try again.")
        } finally {
            setIsLoadingPreview(false)
        }
    }

    // Debounced function to fetch project preview
    const debouncedFetchProject = useCallback(
        (() => {
            let timeoutId: NodeJS.Timeout
            return (processIdValue: string) => {
                clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    if (isValidProcessId(processIdValue)) {
                        fetchProjectPreview(processIdValue)
                    }
                }, 500) // 500ms delay
            }
        })(),
        [settings]
    )

    // Auto-fetch project when process ID changes
    useEffect(() => {
        if (processId.trim() && isValidProcessId(processId.trim())) {
            debouncedFetchProject(processId.trim())
        } else if (processId.trim() && processId.trim().length > 10) {
            // Clear previous data if ID is not valid but user is typing
            setProjectPreview(null)
            setPreviewError(null)
        }
    }, [processId, debouncedFetchProject])

    const handleNewProject = () => {
        // Trigger the new project dialog
        const trigger = document.getElementById("new-project")
        if (trigger) {
            trigger.click()
        }
    }

    const handleOpenProject = () => {
        globalActions.setActiveView("project")
        globalActions.setActiveTab("files")
    }

    const handleNewFile = () => {
        // Trigger the new file dialog
        const trigger = document.getElementById("new-file")
        if (trigger) {
            trigger.click()
        }
    }

    const handleRenameProject = () => {
        // Trigger the rename project dialog
        const trigger = document.getElementById("rename-project")
        if (trigger) {
            trigger.click()
        }
    }

    const handleDuplicateProject = () => {
        if (!activeProject) {
            toast.error("No active project selected")
            return
        }

        const timestamp = Date.now()
        // Check if the project name already has a timestamp pattern (_numbers at the end)
        const timestampPattern = /_\d+$/
        const baseNameWithoutTimestamp = activeProject.replace(timestampPattern, '')
        const defaultName = `${baseNameWithoutTimestamp}_${timestamp}`
        const newName = prompt("Enter name for duplicated project:", defaultName)
        if (newName && newName.trim()) {
            const trimmedName = newName.trim()

            // Check if project with new name already exists
            if (projects[trimmedName]) {
                toast.error("Project with this name already exists")
                return
            }

            const project = projects[activeProject]
            if (project) {
                const duplicatedProject = {
                    ...project,
                    name: trimmedName,
                    process: "" // Reset process for duplicated project
                }
                projectActions.setProject(duplicatedProject)
                toast.success(`Project duplicated as "${trimmedName}"`)
            }
        }
    }

    const handleShareProject = () => {
        if (!activeProject) {
            toast.error("No active project selected")
            return
        }

        // For now, just copy project data to clipboard as JSON
        const project = projects[activeProject]
        if (project) {
            const shareData = JSON.stringify(project, null, 2)
            navigator.clipboard.writeText(shareData).then(() => {
                toast.success("Project data copied to clipboard")
            }).catch(() => {
                toast.error("Failed to copy to clipboard")
            })
        }
    }

    const handleCloseProject = () => {
        if (!activeProject) {
            toast.error("No active project selected")
            return
        }

        globalActions.closeProject()
        toast.success(`Project "${activeProject}" closed`)
    }

    const handleDeleteProject = () => {
        // Trigger the delete project dialog
        const trigger = document.getElementById("delete-project")
        if (trigger) {
            trigger.click()
        }
    }

    const handleImportProject = () => {
        setIsImportDialogOpen(true)
    }

    const validateAndPreviewProject = (projectData: any) => {
        try {
            // Basic validation
            if (!projectData || typeof projectData !== 'object') {
                throw new Error("Invalid project format")
            }

            if (!projectData.name || typeof projectData.name !== 'string') {
                throw new Error("Project must have a valid name")
            }

            if (!projectData.files || typeof projectData.files !== 'object') {
                throw new Error("Project must have files")
            }

            // Set preview in same dialog
            setProjectPreview(projectData as Project)
            setPreviewError(null)
        } catch (error) {
            setPreviewError(error instanceof Error ? error.message : "Invalid project file format")
        }
    }

    const handleImportFromJSON = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const projectData = JSON.parse(e.target?.result as string)
                        validateAndPreviewProject(projectData)
                    } catch (error) {
                        setPreviewError("Invalid JSON file format")
                    }
                }
                reader.readAsText(file)
            }
        }
        input.click()
    }





    const confirmImportProject = () => {
        if (!projectPreview) return

        // Create a copy of the project and clear the process ID
        const projectToImport = { ...projectPreview }

        let name = projectToImport.name
        const existingProject = projects[name]
        if (existingProject) {
            const timestamp = Date.now()
            projectToImport.name = `${name}_${timestamp}`
            name = projectToImport.name
        }

        if (projectToImport.ownerAddress != address) {
            projectToImport.process = ""

        }

        projectActions.setProject(projectToImport)
        projectActions.addRecent(name)
        globalActions.setActiveProject(name)
        toast.success(`Project "${name}" imported successfully`)


        // Reset state
        setProcessId("")
        setProjectPreview(null)
        setIsImportDialogOpen(false)
    }

    const cancelImport = () => {
        setProjectPreview(null)
        setPreviewError(null)
        setIsLoadingPreview(false)
    }

    const getFileCount = (project: Project) => {
        return Object.keys(project.files || {}).length
    }

    const truncateAddress = (address: string, length = 8) => {
        if (!address) return "Unknown"
        return address.length > length * 2
            ? `${address.slice(0, length)}...${address.slice(-length)}`
            : address
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        const jsonFile = files.find(file => file.type === 'application/json' || file.name.endsWith('.json'))

        if (jsonFile) {
            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const projectData = JSON.parse(e.target?.result as string)
                    validateAndPreviewProject(projectData)
                } catch (error) {
                    setPreviewError("Invalid JSON file format")
                }
            }
            reader.readAsText(jsonFile)
        } else {
            setPreviewError("Please drop a valid JSON file")
        }
    }

    const handleExportProject = () => {
        if (!activeProject) {
            toast.error("No active project selected")
            return
        }

        const project = projects[activeProject]
        if (project) {
            const dataStr = JSON.stringify(project, null, 2)
            const dataBlob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(dataBlob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${activeProject}.json`
            link.click()
            URL.revokeObjectURL(url)
            toast.success(`Project "${activeProject}" exported successfully`)
        }
    }

    const handleRenameFile = () => {
        // Trigger the rename file dialog
        const trigger = document.getElementById("rename-file")
        if (trigger) {
            trigger.click()
        }
    }

    const handleDuplicateFile = () => {
        if (!activeProject || !activeFile) {
            toast.error("No file selected")
            return
        }

        const project = projects[activeProject]
        if (project) {
            // Generate a unique name for the duplicate using timestamp
            const timestamp = Date.now()
            const lastDotIndex = activeFile.lastIndexOf('.')
            const nameWithoutExt = lastDotIndex > 0 ? activeFile.substring(0, lastDotIndex) : activeFile
            const extension = lastDotIndex > 0 ? activeFile.substring(lastDotIndex) : ''

            // Check if the name already has a timestamp pattern (_numbers at the end)
            const timestampPattern = /_\d+$/
            const baseNameWithoutTimestamp = nameWithoutExt.replace(timestampPattern, '')

            const duplicateName = `${baseNameWithoutTimestamp}_${timestamp}${extension}`

            // Create duplicate file
            const originalFile = project.files[activeFile]
            const duplicateFile = {
                ...originalFile,
                name: duplicateName,
                // Generate new cell IDs to avoid conflicts
                cellOrder: originalFile.cellOrder.map(cellId => `${cellId}-copy-${Date.now()}`),
                cells: Object.fromEntries(
                    Object.entries(originalFile.cells).map(([cellId, cell]) => {
                        const newCellId = `${cellId}-copy-${Date.now()}`
                        return [newCellId, { ...cell, id: newCellId }]
                    })
                )
            }

            projectActions.setFile(activeProject, duplicateFile)
            toast.success(`File duplicated as "${duplicateName}"`)
        }
    }

    const handleDeleteFile = () => {
        // Trigger the delete file dialog
        const trigger = document.getElementById("delete-file")
        if (trigger) {
            trigger.click()
        }
    }

    const handleSaveProject = () => {
        // if (!activeProject) {
        //     toast.error("No active project selected")
        //     return
        // }
        // // TODO: Implement save logic
        // toast.success(`Project "${activeProject}" saved`)
    }

    const handleSettings = () => {
        globalActions.setActiveView("settings")
    }

    const handleShowKeyboardShortcuts = () => {
        setIsShortcutsOpen(true)
    }

    const handleShowCommands = () => {
        console.log("show commands")
        // setIsCommandsOpen(true)
    }

    const handleShowAbout = () => {
        // TODO: Implement about modal
        toast.info("About BetterIDEa coming soon!")
    }

    // Global hotkey handlers
    useGlobalHotkeys({
        newProject: handleNewProject,
        openProject: handleOpenProject,
        saveProject: handleSaveProject,
        showCommands: handleShowCommands,
        closeProject: handleCloseProject,
        importProject: handleImportProject,
        exportProject: handleExportProject,
        newFile: handleNewFile,
        renameFile: handleRenameFile,
        duplicateFile: handleDuplicateFile,
        deleteFile: handleDeleteFile,
        renameProject: handleRenameProject,
        duplicateProject: handleDuplicateProject,
        shareProject: handleShareProject,
        openSettings: handleSettings,
        showShortcuts: handleShowKeyboardShortcuts
    })

    return <div className="h-[25px] flex items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pr-2">
        <Link to="https://betteridea.dev" target="_blank" className="h-full w-10 hover:bg-accent/80 flex items-center justify-center transition-colors">
            <img src="/icon.svg" alt="logo" className="w-6 h-6 p-0.5 pl-1" />
        </Link>

        {/* Main Menubar */}
        <MainMenubar className="h-[24px] border-none shadow-none bg-transparent p-0">
            {/* Project Menu - Project-level operations */}
            <MenubarMenu>
                <MenubarTrigger className="h-[24px] px-2 py-0 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground transition-colors">
                    Project
                </MenubarTrigger>
                <MenubarContent sideOffset={0} alignOffset={0} className="min-w-[180px] bg-popover supports-[backdrop-filter]:bg-popover border-border shadow-md">
                    <MenubarItem
                        onClick={handleNewProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                    >
                        <FolderPlus className="w-4 h-4 text-muted-foreground" />
                        New Project
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.NEW_PROJECT.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem
                        onClick={handleOpenProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                    >
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        Open Project
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.OPEN_PROJECT.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarItem
                        onClick={handleRenameProject}
                        disabled={!activeProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                        Rename Project
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.RENAME_PROJECT.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem
                        onClick={handleDuplicateProject}
                        disabled={!activeProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <Copy className="w-4 h-4 text-muted-foreground" />
                        Duplicate Project
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarItem
                        onClick={handleImportProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                    >
                        <FileUp className="w-4 h-4 text-muted-foreground" />
                        Import Project
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.IMPORT_PROJECT.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem
                        onClick={handleExportProject}
                        disabled={!activeProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <FileDown className="w-4 h-4 text-muted-foreground" />
                        Export Project
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.EXPORT_PROJECT.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarItem
                        onClick={handleDeleteProject}
                        disabled={!activeProject}
                        className="gap-2 cursor-pointer !text-destructive-foreground hover:!bg-destructive/20"
                    >
                        <Trash2 className="w-4 h-4 text-destructive-foreground" />
                        Delete Project
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarItem
                        onClick={handleCloseProject}
                        disabled={!activeProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                        Close Project
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.CLOSE_PROJECT.key)}</MenubarShortcut>
                    </MenubarItem>
                </MenubarContent>
            </MenubarMenu>

            {/* File Menu - File-level operations */}
            <MenubarMenu>
                <MenubarTrigger className="h-[24px] px-2 py-0 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground transition-colors">
                    File
                </MenubarTrigger>
                <MenubarContent sideOffset={0} alignOffset={0} className="min-w-[180px] bg-popover supports-[backdrop-filter]:bg-popover border-border shadow-md">
                    <MenubarItem
                        onClick={handleNewFile}
                        disabled={!activeProject}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4 text-muted-foreground" />
                        New File
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.NEW_FILE.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarItem
                        onClick={handleRenameFile}
                        disabled={!activeProject || !activeFile}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                        Rename File
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.RENAME_FILE.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem
                        onClick={handleDuplicateFile}
                        disabled={!activeProject || !activeFile}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                    >
                        <Copy className="w-4 h-4 text-muted-foreground" />
                        Duplicate File
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.DUPLICATE_FILE.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarItem
                        onClick={handleDeleteFile}
                        disabled={!activeProject || !activeFile}
                        className="gap-2 cursor-pointer !text-destructive-foreground hover:!bg-destructive/20"
                    >
                        <Trash2 className="w-4 h-4 text-destructive-foreground" />
                        Delete File
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.DELETE_FILE.key)}</MenubarShortcut>
                    </MenubarItem>
                </MenubarContent>
            </MenubarMenu>


            {/* Help Menu - Documentation and support */}
            <MenubarMenu>
                <MenubarTrigger className="h-[24px] px-2 py-0 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground transition-colors">
                    Help
                </MenubarTrigger>
                <MenubarContent sideOffset={0} alignOffset={0} className="min-w-[180px] bg-popover supports-[backdrop-filter]:bg-popover border-border shadow-md">
                    <MenubarItem
                        onClick={handleShowKeyboardShortcuts}
                        className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                    >
                        <Keyboard className="w-4 h-4 text-muted-foreground" />
                        Keyboard Shortcuts
                        <MenubarShortcut className="text-muted-foreground">{getHotkeyDisplay(HOTKEYS.SHOW_SHORTCUTS.key)}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator className="bg-border" />
                    <MenubarSub>
                        <MenubarSubTrigger className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground">
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            Documentation
                        </MenubarSubTrigger>
                        <MenubarSubContent className="min-w-[200px] bg-popover supports-[backdrop-filter]:bg-popover border-border shadow-md">
                            <MenubarItem
                                onClick={() => window.open('https://docs.betteridea.dev', '_blank')}
                                className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                            >
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                BetterIDEa Docs
                            </MenubarItem>
                            {learningResources.map((resource, index) => (
                                <MenubarItem
                                    key={index}
                                    onClick={() => window.open(resource.link, '_blank')}
                                    className="gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                                >
                                    <resource.icon className="w-4 h-4 text-muted-foreground" />
                                    {resource.title}
                                </MenubarItem>
                            ))}
                        </MenubarSubContent>
                    </MenubarSub>
                    <MenubarSeparator className="bg-border" />
                </MenubarContent>
            </MenubarMenu>
        </MainMenubar>

        {/* hidden menubar items with actual functionality */}
        {/* all other buttons will be a proxy to these items */}
        <div className="">
            <NewProject />
            <NewFile />
            <RenameFile />
            <DeleteFile />
            <RenameProject />
            <DeleteProject />
        </div>

        {/* Import Project Dialog */}
        <AlertDialog open={isImportDialogOpen} onOpenChange={(open) => {
            setIsImportDialogOpen(open)
            if (!open) {
                // Reset state when dialog is closed
                setProcessId("")
                setProjectPreview(null)
                setPreviewError(null)
                setIsLoadingPreview(false)
            }
        }}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle>Import Project</AlertDialogTitle>
                    <AlertDialogDescription>
                        Drag and drop a JSON file or enter a process ID to import your project.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-6">
                    {/* Drag and Drop Zone - only show if no project preview */}
                    {!projectPreview && (
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragOver
                                ? 'border-primary bg-primary/5'
                                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={handleImportFromJSON}
                        >
                            <FileUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-1">
                                Drag and drop your project JSON file here
                            </p>
                            <p className="text-xs text-muted-foreground">
                                or click to browse files
                            </p>
                        </div>
                    )}

                    {/* JSON Project Preview */}
                    {projectPreview && !processId && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-sm">Project Name</h3>
                                        <p className="text-sm text-muted-foreground font-btr-code">{projectPreview.name}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-medium text-xs text-muted-foreground">Files</h4>
                                        <p className="text-sm font-btr-code">{getFileCount(projectPreview)}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-xs text-muted-foreground">Network</h4>
                                        <p className="text-sm font-btr-code">{projectPreview.isMainnet ? "Mainnet" : "Testnet"}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-xs text-muted-foreground">Process ID</h4>
                                    <p className="text-sm text-muted-foreground font-btr-code break-all">
                                        {projectPreview.process || "Not specified"}
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-medium text-xs text-muted-foreground">Owner</h4>
                                    <p className="text-sm text-muted-foreground font-btr-code">
                                        {truncateAddress(projectPreview.ownerAddress)}
                                    </p>
                                </div>

                                {Object.keys(projectPreview.files).length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-xs text-muted-foreground mb-1">Files</h4>
                                        <div className="max-h-20 overflow-y-auto space-y-1">
                                            {Object.keys(projectPreview.files).slice(0, 5).map((fileName) => (
                                                <p key={fileName} className="text-xs text-muted-foreground font-btr-code">
                                                    {fileName}
                                                </p>
                                            ))}
                                            {Object.keys(projectPreview.files).length > 5 && (
                                                <p className="text-xs text-muted-foreground">
                                                    ... and {Object.keys(projectPreview.files).length - 5} more files
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={confirmImportProject}
                                className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Import Project
                            </button>
                        </div>
                    )}

                    {/* OR Separator - only show if no project preview */}
                    {!projectPreview && (
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-muted-foreground/25" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">OR</span>
                            </div>
                        </div>
                    )}

                    {/* Process ID Input - only show if no JSON project preview */}
                    {(!projectPreview || processId) && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Import from Process ID</label>
                            <div className="relative">
                                <Input
                                    placeholder="Paste process ID here (auto-fetches on valid ID)..."
                                    value={processId}
                                    onChange={(e) => setProcessId(e.target.value)}
                                    disabled={isLoadingPreview}
                                    className="pr-10"
                                />
                                {isLoadingPreview && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    </div>
                                )}
                                {processId && !isLoadingPreview && !isValidProcessId(processId) && processId.length > 10 && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <X className="w-4 h-4 text-destructive" />
                                    </div>
                                )}
                                {processId && !isLoadingPreview && isValidProcessId(processId) && !projectPreview && !previewError && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Database className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            {processId && !isValidProcessId(processId) && processId.length > 10 && (
                                <p className="text-xs text-destructive">
                                    {validateArweaveId(processId, "Process ID").error}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoadingPreview && (
                        <div className="flex items-center justify-center p-8">
                            <div className="flex flex-col items-center space-y-3">
                                <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                <p className="text-sm text-muted-foreground">Fetching project data...</p>
                            </div>
                        </div>
                    )}

                    {/* Project Preview */}
                    {projectPreview && !isLoadingPreview && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-sm">Project Name</h3>
                                        <p className="text-sm text-muted-foreground font-btr-code">{projectPreview.name}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-medium text-xs text-muted-foreground">Files</h4>
                                        <p className="text-sm font-btr-code">{getFileCount(projectPreview)}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-xs text-muted-foreground">Network</h4>
                                        <p className="text-sm font-btr-code">{projectPreview.isMainnet ? "Mainnet" : "Testnet"}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-xs text-muted-foreground">Process ID</h4>
                                    <p className="text-sm text-muted-foreground font-btr-code break-all">
                                        {projectPreview.process || "Not specified"}
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-medium text-xs text-muted-foreground">Owner</h4>
                                    <p className="text-sm text-muted-foreground font-btr-code">
                                        {truncateAddress(projectPreview.ownerAddress)}
                                    </p>
                                </div>

                                {Object.keys(projectPreview.files).length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-xs text-muted-foreground mb-1">Files</h4>
                                        <div className="max-h-20 overflow-y-auto space-y-1">
                                            {Object.keys(projectPreview.files).slice(0, 5).map((fileName) => (
                                                <p key={fileName} className="text-xs text-muted-foreground font-btr-code">
                                                    {fileName}
                                                </p>
                                            ))}
                                            {Object.keys(projectPreview.files).length > 5 && (
                                                <p className="text-xs text-muted-foreground">
                                                    ... and {Object.keys(projectPreview.files).length - 5} more files
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={confirmImportProject}
                                className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Import Project
                            </button>
                        </div>
                    )}

                    {/* Error Display */}
                    {previewError && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive">{previewError}</p>
                        </div>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Hotkey Reference Dialog */}
        <HotkeyReference
            open={isShortcutsOpen}
            onOpenChange={setIsShortcutsOpen}
        />

        <div className="grow"></div>
        {link.map((item, index) => (
            <Link key={index} to={item.link} target="_blank" className="h-full w-6 hover:bg-accent/80 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground">
                <item.icon size={16} />
            </Link>
        ))}
    </div>
}