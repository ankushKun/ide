import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { useGlobalState } from "@/hooks/use-global-state"
import { useProjects, type File } from "@/hooks/use-projects"
import { useSettings } from "@/hooks/use-settings"
import { Logger, validateArweaveId } from "@/lib/utils"
import { CheckCircle, AlertCircle, Plus, X, Tag as TagIcon } from "lucide-react"
import { MainnetAO } from "@/lib/ao"
import Constants from "@/lib/constants"
import { useActiveAddress, useApi } from "@arweave-wallet-kit/react"
import { createSigner } from "@permaweb/aoconnect"
import { toast } from "sonner"

interface ValidationError {
    field: string
    message: string
}

type FileType = "lua" | "luanb" | "md"

const FILE_TYPES: { [key in FileType]: string } = {
    lua: "lua",
    luanb: "luanb",
    md: "md"
}

export default function NewFile() {
    const [fileName, setFileName] = useState("")
    const [fileType, setFileType] = useState<FileType>("lua")
    const [errors, setErrors] = useState<ValidationError[]>([])
    const [isCreating, setIsCreating] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string>("")
    const [generalError, setGeneralError] = useState<string>("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Process assignment state
    const [processOption, setProcessOption] = useState<"default" | "paste" | "spawn">("default")
    const [customProcessId, setCustomProcessId] = useState("")
    const [isSpawningProcess, setIsSpawningProcess] = useState(false)
    const [customTags, setCustomTags] = useState<{ name: string; value: string }[]>([])
    const [newTagName, setNewTagName] = useState("")
    const [newTagValue, setNewTagValue] = useState("")
    const [tagErrors, setTagErrors] = useState<string[]>([])

    const globalState = useGlobalState()
    const { projects, actions } = useProjects()
    const settings = useSettings()
    const activeAddress = useActiveAddress()
    const api = useApi()

    // Clear errors and messages when inputs change
    useEffect(() => {
        if (errors.length > 0 || successMessage || generalError) {
            setErrors([])
            setSuccessMessage("")
            setGeneralError("")
        }
    }, [fileName, fileType, processOption, customProcessId])

    // Clear tag errors when tags change
    useEffect(() => {
        if (tagErrors.length > 0) {
            setTagErrors([])
        }
    }, [customTags, newTagName, newTagValue])

    const validateForm = (): ValidationError[] => {
        const validationErrors: ValidationError[] = []

        // Check if there's an active project
        if (!globalState.activeProject) {
            validationErrors.push({
                field: "project",
                message: "No active project. Please select or create a project first."
            })
            return validationErrors
        }

        // File name validation
        if (!fileName.trim()) {
            validationErrors.push({
                field: "fileName",
                message: "File name is required"
            })
        } else if (fileName.trim().length < 1) {
            validationErrors.push({
                field: "fileName",
                message: "File name must be at least 1 character long"
            })
        } else if (fileName.trim().length > 100) {
            validationErrors.push({
                field: "fileName",
                message: "File name must be less than 100 characters"
            })
        } else if (!/^[a-zA-Z0-9\s\-_.]+$/.test(fileName.trim())) {
            validationErrors.push({
                field: "fileName",
                message: "File name can only contain letters, numbers, spaces, hyphens, underscores, and dots"
            })
        } else {
            // Check if file already exists in the current project
            const activeProject = projects[globalState.activeProject]
            const fullFileName = `${fileName.trim()}.${fileType}`

            if (activeProject && activeProject.files[fullFileName]) {
                validationErrors.push({
                    field: "fileName",
                    message: "A file with this name already exists in the current project"
                })
            }
        }

        // Process validation for .lua and .luanb files
        if ((fileType === "lua" || fileType === "luanb") && processOption === "paste") {
            if (!customProcessId.trim()) {
                validationErrors.push({
                    field: "processId",
                    message: "Process ID is required when using custom process"
                })
            } else {
                const validation = validateArweaveId(customProcessId.trim(), "Process ID")
                if (!validation.isValid) {
                    validationErrors.push({
                        field: "processId",
                        message: validation.error || "Invalid Process ID format"
                    })
                }
            }
        }

        // Spawn process validation
        if ((fileType === "lua" || fileType === "luanb") && processOption === "spawn") {
            const activeProject = projects[globalState.activeProject]
            if (!activeProject?.isMainnet) {
                validationErrors.push({
                    field: "spawn",
                    message: "Process spawning is only available for mainnet projects"
                })
            }
            if (!activeAddress) {
                validationErrors.push({
                    field: "spawn",
                    message: "Wallet connection required to spawn new process"
                })
            }
        }

        return validationErrors
    }

    // Tag management functions
    const addTag = () => {
        if (!newTagName.trim() || !newTagValue.trim()) return

        const tagName = newTagName.trim()
        const tagValue = newTagValue.trim()

        // Clear previous errors
        setTagErrors([])

        // Check for reserved tag names
        const reservedTags = ["Name", "Module", "Scheduler", "SDK"]
        if (reservedTags.some(reserved => reserved.toLowerCase() === tagName.toLowerCase())) {
            setTagErrors([`"${tagName}" is a reserved tag name`])
            return
        }

        // Check if tag name already exists
        const existingTag = customTags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase())
        if (existingTag) {
            setTagErrors(["A tag with this name already exists"])
            return
        }

        // Validate tag name format (alphanumeric, hyphens, underscores)
        if (!/^[a-zA-Z0-9\-_]+$/.test(tagName)) {
            setTagErrors(["Tag name can only contain letters, numbers, hyphens, and underscores"])
            return
        }

        setCustomTags([...customTags, { name: tagName, value: tagValue }])
        setNewTagName("")
        setNewTagValue("")
    }

    const removeTag = (index: number) => {
        setCustomTags(customTags.filter((_, i) => i !== index))
        setTagErrors([]) // Clear errors when removing tags
    }

    // Process spawning function
    const spawnNewProcess = async (fileName: string): Promise<string> => {
        if (!activeAddress || !api) {
            throw new Error("Wallet connection required")
        }

        const activeProject = projects[globalState.activeProject]
        if (!activeProject?.isMainnet) {
            throw new Error("Process spawning is only available for mainnet projects")
        }

        const signer = createSigner(api)
        const ao = new MainnetAO({
            GATEWAY_URL: settings.actions.getGatewayUrl(),
            HB_URL: settings.actions.getHbUrl(),
            signer
        })

        const tags = [
            { name: "Name", value: `${activeProject.name}-${fileName}` },
            ...customTags
        ]

        const processId = await ao.spawn({
            tags,
            module_: Constants.modules.mainnet.hyperAos
        })

        return processId
    }

    const handleCreate = async () => {
        // Clear previous messages
        setSuccessMessage("")
        setGeneralError("")

        const validationErrors = validateForm()

        if (validationErrors.length > 0) {
            setErrors(validationErrors)
            return
        }

        if (!globalState.activeProject) {
            setGeneralError("No active project selected.")
            return
        }

        setIsCreating(true)

        try {
            const fullFileName = `${fileName.trim()}.${fileType}`

            // Get the active project
            const activeProject = projects[globalState.activeProject]
            if (!activeProject) {
                throw new Error("Active project not found")
            }

            // Handle process assignment for .lua and .luanb files
            let assignedProcessId: string | undefined = undefined

            if (fileType === "lua" || fileType === "luanb") {
                if (processOption === "paste" && customProcessId.trim()) {
                    assignedProcessId = customProcessId.trim()
                } else if (processOption === "spawn") {
                    setIsSpawningProcess(true)
                    try {
                        assignedProcessId = await spawnNewProcess(fileName.trim())
                        toast.success(`New process spawned for ${fullFileName}`)
                    } catch (error) {
                        throw new Error(`Failed to spawn process: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    } finally {
                        setIsSpawningProcess(false)
                    }
                }
                // If processOption is "default", assignedProcessId remains undefined (uses project default)
            }

            // Create default file structure based on file type
            let newFile: File
            const cellId = `cell-${Date.now()}`

            switch (fileType) {
                case "lua":
                    newFile = {
                        name: fullFileName,
                        cellOrder: [cellId],
                        cells: {
                            [cellId]: {
                                id: cellId,
                                content: 'print("Hello AO!")\n',
                                output: "",
                                type: "CODE",
                                editing: false
                            }
                        },
                        isMainnet: activeProject.isMainnet,
                        ownerAddress: activeProject.ownerAddress,
                        process: assignedProcessId
                    }
                    break
                case "luanb":
                    newFile = {
                        name: fullFileName,
                        cellOrder: [cellId],
                        cells: {
                            [cellId]: {
                                id: cellId,
                                content: 'print("Hello AO!")\n',
                                output: "",
                                type: "CODE",
                                editing: false
                            }
                        },
                        isMainnet: activeProject.isMainnet,
                        ownerAddress: activeProject.ownerAddress,
                        process: assignedProcessId
                    }
                    break
                case "md":
                    newFile = {
                        name: fullFileName,
                        cellOrder: [cellId],
                        cells: {
                            [cellId]: {
                                id: cellId,
                                content: `# ${fileName.trim()}\n\nNew markdown file.\n`,
                                output: "",
                                type: "MARKDOWN",
                                editing: false
                            }
                        },
                        isMainnet: activeProject.isMainnet,
                        ownerAddress: activeProject.ownerAddress
                        // No process assignment for markdown files
                    }
                    break
            }

            // Add the new file to the project
            const updatedProject = {
                ...activeProject,
                files: {
                    ...activeProject.files,
                    [fullFileName]: newFile
                }
            }

            // Update the project in the store
            actions.setProject(updatedProject)

            // Set the new file as active
            globalState.actions.setActiveFile(fullFileName)

            setSuccessMessage(`File "${fullFileName}" created successfully!`)

            // Close dialog and reset form after a short delay to show success message
            setTimeout(() => {
                setIsDialogOpen(false)
                setFileName("")
                setFileType("lua")
                setProcessOption("default")
                setCustomProcessId("")
                setCustomTags([])
                setNewTagName("")
                setNewTagValue("")
                setTagErrors([])
                setErrors([])
                setSuccessMessage("")
                setGeneralError("")
            }, 1500)

        } catch (error) {
            Logger.error('Failed to create file', error)
            setGeneralError(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsCreating(false)
        }
    }

    const getFieldError = (fieldName: string): string | undefined => {
        return errors.find(error => error.field === fieldName)?.message
    }

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open)
        if (open) {
            // Reset form state when dialog opens
            setErrors([])
            setSuccessMessage("")
            setGeneralError("")
            setTagErrors([])
        } else {
            // Reset all form fields when dialog closes
            setFileName("")
            setFileType("lua")
            setProcessOption("default")
            setCustomProcessId("")
            setCustomTags([])
            setNewTagName("")
            setNewTagValue("")
            setTagErrors([])
            setErrors([])
            setSuccessMessage("")
            setGeneralError("")
        }
    }

    return <div>
        <AlertDialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <AlertDialogTrigger id="new-file"></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>New File</AlertDialogTitle>
                    <AlertDialogDescription>
                        Create a new file in the current project.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Success Message */}
                {successMessage && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                    </div>
                )}

                {/* General Error Message */}
                {generalError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <p className="text-sm text-red-800 dark:text-red-200">{generalError}</p>
                    </div>
                )}

                {/* Validation Errors Summary */}
                {errors.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">Please fix the following errors:</p>
                            <ul className="text-sm text-red-700 dark:text-red-300 mt-1 space-y-1">
                                {errors.map((error, index) => (
                                    <li key={index}>• {error.message}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <Input
                        placeholder="File Name (without extension)"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        className={getFieldError("fileName") ? "border-red-500" : ""}
                    />
                    {getFieldError("fileName") && (
                        <p className="text-sm text-red-500">{getFieldError("fileName")}</p>
                    )}
                </div>

                <div className="flex gap-2 text-sm items-center">
                    <div className="text-muted-foreground mr-auto">File Type</div>
                    {Object.entries(FILE_TYPES).map(([key, value]) => (
                        <Badge
                            key={key}
                            className={`cursor-pointer bg-muted ${fileType === value ? "bg-primary" : ""}`}
                            onClick={() => setFileType(value as FileType)}
                        >
                            {key}
                        </Badge>
                    ))}
                </div>

                {/* Process Assignment Options - only for .lua and .luanb files */}
                {(fileType === "lua" || fileType === "luanb") && (
                    <div className="space-y-4">
                        <div className="flex gap-2 text-sm items-center">
                            <div className="text-muted-foreground mr-auto">Process Assignment</div>
                            <Badge
                                className={`cursor-pointer bg-muted ${processOption === "default" ? "bg-primary" : ""}`}
                                onClick={() => setProcessOption("default")}
                            >
                                Default
                            </Badge>
                            <Badge
                                className={`cursor-pointer bg-muted ${processOption === "paste" ? "bg-primary" : ""}`}
                                onClick={() => setProcessOption("paste")}
                            >
                                Custom ID
                            </Badge>
                            {(() => {
                                const activeProject = projects[globalState.activeProject]
                                return activeProject?.isMainnet && activeAddress && (
                                    <Badge
                                        className={`cursor-pointer bg-muted ${processOption === "spawn" ? "bg-primary" : ""}`}
                                        onClick={() => setProcessOption("spawn")}
                                    >
                                        Spawn New
                                    </Badge>
                                )
                            })()}
                        </div>

                        {/* Custom Process ID Input */}
                        {processOption === "paste" && (
                            <div className="space-y-1">
                                <Input
                                    placeholder="Enter process ID"
                                    value={customProcessId}
                                    onChange={(e) => setCustomProcessId(e.target.value)}
                                    className={`font-btr-code ${getFieldError("processId") ? "border-red-500" : ""}`}
                                />
                                {getFieldError("processId") && (
                                    <p className="text-sm text-red-500">{getFieldError("processId")}</p>
                                )}
                            </div>
                        )}

                        {/* Spawn Process Section */}
                        {processOption === "spawn" && !isSpawningProcess && (
                            <div className="space-y-3">
                                <div className="p-3 bg-muted/50 rounded-md">
                                    <p className="text-xs text-muted-foreground">
                                        This will create a new process on the blockchain using the HyperAOS module for this file.
                                    </p>
                                </div>

                                {/* Custom Tags Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <TagIcon className="w-4 h-4" />
                                        <Label className="text-sm font-medium">Custom Tags</Label>
                                    </div>

                                    {/* Display existing tags */}
                                    {customTags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {customTags.map((tag, index) => (
                                                <div key={index} className="group relative inline-flex items-center">
                                                    <div className="flex items-center border border-border rounded-md overflow-hidden bg-background group-hover:pr-3 transition-all duration-150">
                                                        <div className="px-2 py-1 text-xs font-medium bg-primary/50 border-r border-border">
                                                            {tag.name}
                                                        </div>
                                                        <div className="px-2 py-1 text-xs font-btr-code">
                                                            {tag.value}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 mr-0.5 rounded-sm hover:bg-muted/60 dark:hover:bg-muted/40 transition-all duration-150 opacity-0 group-hover:opacity-100"
                                                        onClick={() => removeTag(index)}
                                                        aria-label={`Remove ${tag.name} tag`}
                                                    >
                                                        <X size={12} className="text-muted-foreground/70 hover:text-foreground/90" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add new tag form */}
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Tag name"
                                                value={newTagName}
                                                onChange={(e) => setNewTagName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newTagName.trim() && newTagValue.trim()) {
                                                        e.preventDefault()
                                                        addTag()
                                                    }
                                                }}
                                                className="flex-1"
                                            />
                                            <Input
                                                placeholder="Tag value"
                                                value={newTagValue}
                                                onChange={(e) => setNewTagValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newTagName.trim() && newTagValue.trim()) {
                                                        e.preventDefault()
                                                        addTag()
                                                    }
                                                }}
                                                className="flex-1 font-btr-code"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addTag}
                                                disabled={!newTagName.trim() || !newTagValue.trim()}
                                                className="px-3"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        {tagErrors.length > 0 && (
                                            <div className="space-y-1">
                                                {tagErrors.map((error, index) => (
                                                    <p key={index} className="text-sm text-red-500">{error}</p>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">Press Enter to add tag</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Spawning Process Loading State */}
                        {processOption === "spawn" && isSpawningProcess && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    🔄 Spawning process on the blockchain... This may take a few moments.
                                </p>
                            </div>
                        )}

                        {/* Show warning for non-mainnet or no wallet */}
                        {(() => {
                            const activeProject = projects[globalState.activeProject]
                            if (!activeProject?.isMainnet || !activeAddress) {
                                return (
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            {!activeProject?.isMainnet && "Process spawning is only available for mainnet projects. "}
                                            {!activeAddress && "Please connect your wallet to spawn new processes."}
                                        </p>
                                    </div>
                                )
                            }
                            return null
                        })()}
                    </div>
                )}

                <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel disabled={isCreating || isSpawningProcess || !!successMessage}>Cancel</AlertDialogCancel>
                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || isSpawningProcess || !!successMessage}
                    >
                        {isSpawningProcess ? "Spawning Process..." : isCreating ? "Creating..." : successMessage ? "Created!" : "Create"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
}