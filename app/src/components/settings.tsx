import { useState } from "react"
import { ArrowLeft, Moon, Sun, Save, RotateCcw, Settings as SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/components/theme-provider"
import { useGlobalState } from "@/hooks/use-global-state"
import { useProjects } from "@/hooks/use-projects"
import { useSettings } from "@/hooks/use-settings"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function Settings() {
    const { theme, setTheme } = useTheme()
    const globalState = useGlobalState()
    const projects = useProjects()
    const settings = useSettings()

    // Local state for UI inputs (for URLs and API key)
    const [customCuUrl, setCustomCuUrl] = useState(settings.actions.getCuUrl())
    const [customMuUrl, setCustomMuUrl] = useState(settings.actions.getMuUrl())
    const [customGatewayUrl, setCustomGatewayUrl] = useState(settings.actions.getGatewayUrl())
    const [geminiApiKey, setGeminiApiKey] = useState(() => {
        const key = settings.actions.getGeminiApiKey()
        return key ? "*".repeat(key.length) : ""
    })

    const activeProject = globalState.activeProject ? projects.projects[globalState.activeProject] : null

    const handleVimModeChange = (enabled: boolean) => {
        settings.actions.setVimMode(enabled)
        toast.success(`VIM mode ${enabled ? "enabled" : "disabled"}`)
    }

    const handleUrlSave = (type: "cu" | "mu" | "gateway", url: string) => {
        if (!settings.actions.isValidUrl(url)) {
            toast.error("Invalid URL format")
            return
        }

        switch (type) {
            case "cu":
                settings.actions.setCU_URL(url)
                break
            case "mu":
                settings.actions.setMU_URL(url)
                break
            case "gateway":
                settings.actions.setGATEWAY_URL(url)
                break
        }
        toast.success(`${type.toUpperCase()} URL saved`)
    }

    const handleUrlReset = (type: "cu" | "mu" | "gateway") => {
        switch (type) {
            case "cu":
                settings.actions.resetCuUrl()
                setCustomCuUrl(settings.actions.getCuUrl())
                break
            case "mu":
                settings.actions.resetMuUrl()
                setCustomMuUrl(settings.actions.getMuUrl())
                break
            case "gateway":
                settings.actions.resetGatewayUrl()
                setCustomGatewayUrl(settings.actions.getGatewayUrl())
                break
        }
        toast.success(`${type.toUpperCase()} URL reset to default`)
    }

    const handleGeminiKeySave = () => {
        if (geminiApiKey.match(/^\*+$/)) return

        if (!settings.actions.isValidGeminiKey(geminiApiKey)) {
            toast.error("Invalid Gemini API Key")
            return
        }

        settings.actions.setGeminiApiKey(geminiApiKey)
        toast.success("Gemini API Key saved")
        setGeminiApiKey("*".repeat(geminiApiKey.length))
    }

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border/40 bg-sidebar/30">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => globalState.actions.setActiveView(null)}
                >
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                </Button>
                <Separator orientation="vertical" className="h-4" />
                <SettingsIcon size={16} className="text-muted-foreground" />
                <h1 className="text-sm font-medium">Settings</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto p-6 space-y-6">

                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1">
                            <TabsTrigger
                                value="general"
                                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            >
                                General
                            </TabsTrigger>
                            <TabsTrigger
                                value="editor"
                                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            >
                                Editor
                            </TabsTrigger>
                            <TabsTrigger
                                value="network"
                                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            >
                                Network
                            </TabsTrigger>
                            <TabsTrigger
                                value="project"
                                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            >
                                Project
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 mt-6">
                            <Card className="border-border/40 bg-card/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-medium">Appearance</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Customize the look and feel of your IDE
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-medium">Theme</Label>
                                            <div className="text-xs text-muted-foreground">
                                                Choose your preferred color scheme
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Button
                                                variant={theme === "light" ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => setTheme("light")}
                                                className={cn(
                                                    "h-8 px-3 text-xs",
                                                    theme === "light" && "bg-primary text-primary-foreground"
                                                )}
                                            >
                                                <Sun className="h-3 w-3 mr-1.5" />
                                                Light
                                            </Button>
                                            <Button
                                                variant={theme === "dark" ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => setTheme("dark")}
                                                className={cn(
                                                    "h-8 px-3 text-xs",
                                                    theme === "dark" && "bg-primary text-primary-foreground"
                                                )}
                                            >
                                                <Moon className="h-3 w-3 mr-1.5" />
                                                Dark
                                            </Button>
                                            <Button
                                                variant={theme === "system" ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => setTheme("system")}
                                                className={cn(
                                                    "h-8 px-3 text-xs",
                                                    theme === "system" && "bg-primary text-primary-foreground"
                                                )}
                                            >
                                                System
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="editor" className="space-y-4 mt-6">
                            <Card className="border-border/40 bg-card/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-medium">Editor Preferences</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Configure your code editing experience
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label htmlFor="vim-mode" className="text-sm font-medium">VIM Mode</Label>
                                            <div className="text-xs text-muted-foreground">
                                                Enable VIM keybindings in the editor
                                            </div>
                                        </div>
                                        <Switch
                                            id="vim-mode"
                                            checked={settings.actions.getVimMode()}
                                            onCheckedChange={handleVimModeChange}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/40 bg-card/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-medium">AI Integration</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Configure AI services for code assistance
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="gemini-key" className="text-sm font-medium">Gemini API Key</Label>
                                        <div className="flex space-x-2">
                                            <Input
                                                id="gemini-key"
                                                type="password"
                                                placeholder="Enter your Gemini API key"
                                                value={geminiApiKey}
                                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                                className="bg-background/50 border-border/60 text-sm"
                                            />
                                            <Button
                                                onClick={handleGeminiKeySave}
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <Save className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Your API key is stored locally and never shared
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="network" className="space-y-4 mt-6">
                            <Card className="border-border/40 bg-card/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-medium">AO Network Configuration</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Configure custom URLs for AO services
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="cu-url" className="text-sm font-medium">CU URL</Label>
                                        <div className="flex space-x-2">
                                            <Input
                                                id="cu-url"
                                                placeholder="https://cu.arnode.asia"
                                                value={customCuUrl}
                                                onChange={(e) => setCustomCuUrl(e.target.value)}
                                                className="bg-background/50 border-border/60 text-sm font-mono"
                                            />
                                            <Button
                                                onClick={() => handleUrlSave("cu", customCuUrl)}
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <Save className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                onClick={() => handleUrlReset("cu")}
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="mu-url" className="text-sm font-medium">MU URL</Label>
                                        <div className="flex space-x-2">
                                            <Input
                                                id="mu-url"
                                                placeholder="https://mu.ao-testnet.xyz"
                                                value={customMuUrl}
                                                onChange={(e) => setCustomMuUrl(e.target.value)}
                                                className="bg-background/50 border-border/60 text-sm font-mono"
                                            />
                                            <Button
                                                onClick={() => handleUrlSave("mu", customMuUrl)}
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <Save className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                onClick={() => handleUrlReset("mu")}
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="gateway-url" className="text-sm font-medium">Gateway URL</Label>
                                        <div className="flex space-x-2">
                                            <Input
                                                id="gateway-url"
                                                placeholder="https://arweave.net"
                                                value={customGatewayUrl}
                                                onChange={(e) => setCustomGatewayUrl(e.target.value)}
                                                className="bg-background/50 border-border/60 text-sm font-mono"
                                            />
                                            <Button
                                                onClick={() => handleUrlSave("gateway", customGatewayUrl)}
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <Save className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                onClick={() => handleUrlReset("gateway")}
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-3"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground bg-muted/50 border border-border/40 p-3 rounded-md">
                                        <strong>Note:</strong> When using custom URLs, it is recommended to use the same providers for CU, MU & Gateway for optimal performance.
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="project" className="space-y-4 mt-6">
                            {activeProject ? (
                                <Card className="border-border/40 bg-card/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-medium">Current Project</CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground">
                                            Settings for {activeProject.name}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owner Wallet</Label>
                                                <p className="text-sm font-mono bg-muted/30 p-2 rounded border border-border/40">
                                                    {activeProject.ownerAddress || "Not set"}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Default Process</Label>
                                                <p className="text-sm font-mono bg-muted/30 p-2 rounded border border-border/40">
                                                    {activeProject.process || "Not set"}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Network</Label>
                                                <p className="text-sm bg-muted/30 p-2 rounded border border-border/40">
                                                    {activeProject.isMainnet ? "Mainnet" : "Testnet"}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files</Label>
                                                <p className="text-sm bg-muted/30 p-2 rounded border border-border/40">
                                                    {Object.keys(activeProject.files).length} files
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-border/40 bg-card/50">
                                    <CardContent className="flex items-center justify-center py-12">
                                        <div className="text-center space-y-2">
                                            <p className="text-muted-foreground text-sm">No active project</p>
                                            <p className="text-xs text-muted-foreground">
                                                Open a project to view its settings
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
