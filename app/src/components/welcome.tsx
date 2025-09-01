import { useGlobalState } from "@/hooks/use-global-state"
import { useProjects } from "@/hooks/use-projects"
import { useEffect, useState } from "react"
import {
    FileCodeIcon,
    FileStack,
    PlusSquare,
    NewspaperIcon,
    CodeIcon,
    TerminalIcon,
    BookOpenIcon,
    RocketIcon,
    SparklesIcon,
    GithubIcon,
    Cannabis,
    Unplug,
    Plug,
    PartyPopper
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router"
import { ConnectButton, useActiveAddress, useConnection, useProfileModal } from "@arweave-wallet-kit/react"
import HotkeyReference from "./hotkey-reference"
import { MenubarShortcut } from "./ui/menubar"
import { getHotkeyDisplay, HOTKEYS } from "@/lib/hotkeys"
import { shortenAddress } from "@/lib/utils"

const emoticons = [
    "(^･o･^)ﾉ' ",
    "ฅ^•ﻌ•^ฅ",
    "(⁠ ⁠╹⁠▽⁠╹⁠ ⁠)",
    "(⁠≧⁠▽⁠≦⁠)",
    "<⁠(⁠￣⁠︶⁠￣⁠)⁠>",
    "＼⁠(⁠^⁠o⁠^⁠)⁠／",
    "/⁠ᐠ⁠｡⁠ꞈ⁠｡⁠ᐟ⁠\\",
    "▼⁠・⁠ᴥ⁠・⁠▼",
    "〜⁠(⁠꒪⁠꒳⁠꒪⁠)⁠〜",
    "ᕙ⁠(⁠ ⁠ ⁠•⁠ ⁠‿⁠ ⁠•⁠ ⁠ ⁠)⁠ᕗ"
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
        link: "https://fuel_permawebllms.ar.io/",
    }
]

export default function Welcome() {
    const globalState = useGlobalState()
    const projects = useProjects()
    const [randomWord] = useState(() => emoticons[Math.floor(Math.random() * emoticons.length)])
    const { connected, connect, disconnect } = useConnection()
    const { setOpen } = useProfileModal()
    const address = useActiveAddress()

    const handleQuickAction = (action: string) => {
        switch (action) {
            case "new-project":
                // Trigger the new project dialog
                const trigger = document.getElementById("new-project")
                if (trigger) {
                    trigger.click()
                }
                break
            case "all-projects":
                globalState.actions.setActiveView("project")
                break
            case "terminal":
                // Open interact tab (closest to terminal functionality)
                globalState.actions.setActiveTab("interact")
                break
        }
    }

    const openRecentProject = (projectName: string) => {
        try {
            const project = projects.projects[projectName]
            if (project) {
                globalState.actions.setActiveProject(projectName)
                const firstFile = Object.keys(project.files)[0]
                if (firstFile) {
                    globalState.actions.setActiveFile(firstFile)
                    globalState.actions.setActiveView(null)
                } else {
                    globalState.actions.setActiveView("project")
                }
                projects.actions.addRecent(projectName)
            }
        } catch (e) {
            console.error("Failed to open project:", e)
        }
    }

    return (
        <div className="p-5 text-foreground overflow-scroll h-full flex flex-col items-center justify-center">
            {/* Hero Section - Outside Grid */}
            <div className="text-left mb-20 max-w-4xl w-full">
                <h1 className="text-6xl font-bold mb-2" suppressHydrationWarning>
                    BetterIDEa
                </h1>
                <p className="text-lg">
                    <span className="text-primary font-medium">ao&apos;s</span> development environment. {randomWord}
                </p>
            </div>

            {/* 2x2 Grid Content */}
            <div className="grid grid-cols-2 gap-8 max-w-4xl w-full items-start">

                {/* Top Left - Quick Actions */}
                <div className="flex flex-col">
                    <div className="flex flex-col gap-1 -ml-3">
                        {/* {quickActions.map((action) => (
                            <Button
                                key={action.action}
                                variant="link"
                                className="justify-start items-start h-7 text-foreground/90 gap-2 px-0"
                                onClick={() => handleQuickAction(action.action)}
                            >
                                <action.icon size={18} /> {action.title}
                            </Button>
                        ))} */}
                        {<Button variant="link" data-connected={connected} className="justify-center disabled:opacity-100 w-fit text-primary hover:text-primary data-[connected=true]:text-foreground data-[connected=true]:hover:text-primary items-center h-7 rounded-sm gap-2 !px-1.5 ml-1.5 " onClick={async () => { if (connected) { setOpen(true) } else { try { await disconnect() } finally { await connect() } } }}>
                            {!connected ? <><Unplug size={20} /> Connect Wallet</> : <><PartyPopper size={20} className="" /> {address ? shortenAddress(address) : "Connecting..."}</>}
                        </Button>}
                        <Button variant="link" className="justify-center w-fit items-center h-7 text-foreground hover:text-primary gap-2 px-0" onClick={() => handleQuickAction("new-project")}>
                            <PlusSquare size={18} /> New Project
                        </Button>
                        <Button variant="link" className="justify-center w-fit items-center h-7 text-foreground hover:text-primary gap-2 px-0" onClick={() => handleQuickAction("all-projects")}>
                            <FileStack size={18} /> All Projects
                        </Button>
                    </div>
                </div>

                {/* Top Right - Learning Resources */}
                <div className="flex flex-col">
                    <h3 className="font-medium text-foreground mb-3">Learning Resources</h3>
                    <div className="space-y-1">
                        {learningResources.map((resource, i) => (
                            <Link
                                to={resource.link}
                                target="_blank"
                                key={i}
                                className="px-2 py-1.5 block rounded hover:bg-muted/30 transition-colors cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <resource.icon
                                        size={16}
                                        className={`group-hover:scale-105 transition-transform opacity-70 text-primary`}
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm text-foreground">{resource.title}</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Bottom Left - Recent Projects */}
                <div className="flex flex-col">
                    <h3 className="font-medium text-foreground mb-3">Recent Projects</h3>
                    <div className="space-y-1">
                        {projects.recents && projects.recents.length > 0 ? (
                            projects.recents.slice(0, 5).map((projectName, i) => (
                                <Button
                                    key={i}
                                    variant="link"
                                    className="flex h-7 gap-2 px-1 justify-start text-foreground tracking-wide"
                                    onClick={() => openRecentProject(projectName)}
                                >
                                    <FileCodeIcon size={16} className="text-primary" />
                                    <span className="text-sm">{projectName}</span>
                                </Button>
                            ))
                        ) : (
                            <div className="text-sm text-foreground px-2">No recent projects</div>
                        )}
                    </div>
                </div>

                {/* Bottom Right - Quick Tips */}
                <div className="flex flex-col">
                    <h3 className="font-medium text-foreground mb-3">Quick Tips</h3>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 px-2 py-1">
                            <SparklesIcon size={12} className="text-primary opacity-60" />
                            <span className="text-xs text-foreground">Check keybinds with <kbd className="bg-muted/60 p-0.5 px-1 rounded-sm"><MenubarShortcut className="text-foreground">{getHotkeyDisplay(HOTKEYS.SHOW_SHORTCUTS.key)}</MenubarShortcut></kbd></span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1">
                            <SparklesIcon size={12} className="text-primary opacity-60" />
                            <span className="text-xs text-foreground">Press <kbd className="bg-muted/60 p-0.5 px-1 rounded-sm"><MenubarShortcut className="text-foreground">{getHotkeyDisplay(HOTKEYS.NEW_PROJECT.key)}</MenubarShortcut></kbd> to create a new project</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1">
                            <SparklesIcon size={12} className="text-primary opacity-60" />
                            <span className="text-xs text-foreground">Hyperbeam is in beta- eat glass and keep building</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Centered Footer */}
            <div className="text-center py-4 absolute bottom-6">
                <p className="text-xs text-muted-foreground">
                    Built with ❤️ for the permaweb
                </p>
            </div>
        </div>
    )
}