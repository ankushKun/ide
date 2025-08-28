import { useState, useEffect, useCallback, memo } from "react"
import { useGlobalState } from "@/hooks/use-global-state"
import { useProjects } from "@/hooks/use-projects"
import { useSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Search,
    Play,
    Copy,
    Check,
    Loader2,
    Database,
    ChevronDown,
    ChevronRight,
    Filter
} from "lucide-react"
import JsonViewer from "../ui/json-viewer"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface FieldSelection {
    [key: string]: boolean | FieldSelection
}

interface QueryFilters {
    first?: number
    after?: string
    ids?: string[]
    owners?: string[]
    recipients?: string[]
    bundledIn?: string[]
    tags?: Array<{
        name: string;
        values: string[];
        op?: 'EQ' | 'NEQ';
        match?: 'EXACT' | 'WILDCARD' | 'FUZZY_AND' | 'FUZZY_OR';
    }>
    block?: {
        min?: number
        max?: number
    }
    ingested_at?: {
        min?: number
        max?: number
    }
    sort?: 'HEIGHT_DESC' | 'HEIGHT_ASC' | 'INGESTED_AT_DESC' | 'INGESTED_AT_ASC'
}

const GraphQL = memo(function GraphQL() {
    const globalState = useGlobalState()
    const projectsState = useProjects()
    const settings = useSettings()

    const activeProject = globalState.activeProject ? projectsState.projects[globalState.activeProject] : null

    // Get GraphQL endpoint from settings
    const endpoint = settings.actions.getGraphqlUrl()

    // Field selections - start with no fields selected
    const [selectedFields, setSelectedFields] = useState<FieldSelection>({})

    // Query filters
    const [filters, setFilters] = useState<QueryFilters>({
        first: 10,
        sort: 'HEIGHT_DESC'
    })

    // Raw input values for comma-separated fields (to preserve user typing)
    const [rawInputs, setRawInputs] = useState({
        ids: '',
        owners: '',
        recipients: '',
        bundledIn: ''
    })

    // Query type selection
    const [queryType, setQueryType] = useState<'transactions' | 'transaction'>('transactions')
    const [singleTransactionId, setSingleTransactionId] = useState('')

    // Handle query type change with state clearing
    const handleQueryTypeChange = (newQueryType: 'transactions' | 'transaction') => {
        setQueryType(newQueryType)

        // Clear previous state when switching query types
        setOutput(null)

        if (newQueryType === 'transactions') {
            // Switching to transactions list - clear single transaction ID and deselect all fields
            setSingleTransactionId('')
            setSelectedFields({})
        } else {
            // Switching to single transaction - reset filters and deselect all fields
            setFilters({ first: 10, sort: 'HEIGHT_DESC' })
            setSelectedFields({})
        }

        // Clear raw inputs when switching query types
        setRawInputs({
            ids: '',
            owners: '',
            recipients: '',
            bundledIn: ''
        })
    }

    // UI state
    const [isLoading, setIsLoading] = useState(false)
    const [output, setOutput] = useState<any>(null)
    const [generatedQuery, setGeneratedQuery] = useState("")
    const [isCopied, setIsCopied] = useState(false)
    const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
        pageInfo: false,
        edges: true,
        node: true,
        owner: false,
        fee: false,
        quantity: false,
        data: true,
        tags: true,
        block: false,
        bundledIn: false,
        filters: false,
        advancedFilters: false
    })

    // Helper function to process raw input into array
    const processRawInput = (rawValue: string): string[] | undefined => {
        if (!rawValue.trim()) return undefined
        return rawValue.split(',').map(s => s.trim()).filter(Boolean)
    }

    // Generate GraphQL query from selections
    const generateQuery = useCallback(() => {
        const buildFieldString = (fields: FieldSelection, indent = 0): string => {
            const indentStr = "    ".repeat(indent)
            const lines: string[] = []

            Object.entries(fields).forEach(([key, value]) => {
                if (typeof value === "boolean" && value) {
                    lines.push(`${indentStr}${key}`)
                } else if (typeof value === "object" && value !== null) {
                    const nestedFields = buildFieldString(value, indent + 1)
                    if (nestedFields.trim()) {
                        lines.push(`${indentStr}${key} {`)
                        lines.push(nestedFields)
                        lines.push(`${indentStr}}`)
                    }
                }
            })

            return lines.join('\n')
        }

        // Build filter arguments
        const filterArgs: string[] = []
        if (filters.first) filterArgs.push(`first: ${filters.first}`)
        if (filters.after) filterArgs.push(`after: "${filters.after}"`)

        // Process raw inputs for comma-separated fields
        const processedIds = processRawInput(rawInputs.ids)
        const processedOwners = processRawInput(rawInputs.owners)
        const processedRecipients = processRawInput(rawInputs.recipients)
        const processedBundledIn = processRawInput(rawInputs.bundledIn)

        if (processedIds?.length) filterArgs.push(`ids: [${processedIds.map(id => `"${id}"`).join(', ')}]`)
        if (processedOwners?.length) filterArgs.push(`owners: [${processedOwners.map(owner => `"${owner}"`).join(', ')}]`)
        if (processedRecipients?.length) filterArgs.push(`recipients: [${processedRecipients.map(recipient => `"${recipient}"`).join(', ')}]`)

        if (filters.tags?.length) {
            const tagFilters = filters.tags.map(tag => {
                let tagFilter = `{name: "${tag.name}", values: [${tag.values.map(v => `"${v}"`).join(', ')}]`
                if (tag.op && tag.op !== 'EQ') tagFilter += `, op: ${tag.op}`
                if (tag.match && tag.match !== 'EXACT') tagFilter += `, match: ${tag.match}`
                tagFilter += '}'
                return tagFilter
            }).join(', ')
            filterArgs.push(`tags: [${tagFilters}]`)
        }

        if (processedBundledIn?.length) filterArgs.push(`bundledIn: [${processedBundledIn.map(id => `"${id}"`).join(', ')}]`)

        if (filters.ingested_at?.min || filters.ingested_at?.max) {
            const ingestedFilter: string[] = []
            if (filters.ingested_at.min) ingestedFilter.push(`min: ${filters.ingested_at.min}`)
            if (filters.ingested_at.max) ingestedFilter.push(`max: ${filters.ingested_at.max}`)
            filterArgs.push(`ingested_at: {${ingestedFilter.join(', ')}}`)
        }

        if (filters.sort && filters.sort !== 'HEIGHT_DESC') {
            filterArgs.push(`sort: ${filters.sort}`)
        }

        if (filters.block?.min || filters.block?.max) {
            const blockFilter: string[] = []
            if (filters.block.min) blockFilter.push(`min: ${filters.block.min}`)
            if (filters.block.max) blockFilter.push(`max: ${filters.block.max}`)
            filterArgs.push(`block: {${blockFilter.join(', ')}}`)
        }

        const argsString = filterArgs.length > 0 ? `(${filterArgs.join(', ')})` : ""
        const fieldsString = buildFieldString(selectedFields, 1)

        let query: string
        if (queryType === 'transaction' && singleTransactionId) {
            // Single transaction query - only show node fields
            const nodeFields = (selectedFields.edges && typeof selectedFields.edges === 'object' && 'node' in selectedFields.edges)
                ? buildFieldString(selectedFields.edges.node as FieldSelection, 1)
                : buildFieldString(selectedFields, 1)

            if (!nodeFields.trim()) {
                query = `# No fields selected`
            } else {
                query = `query {
    transaction(id: "${singleTransactionId}") {
${nodeFields}
    }
}`
            }
        } else {
            // Transactions connection query
            if (!fieldsString.trim()) {
                query = `# No fields selected`
            } else {
                query = `query {
    transactions${argsString} {
${fieldsString}
    }
}`
            }
        }

        setGeneratedQuery(query)
    }, [selectedFields, filters, queryType, singleTransactionId, rawInputs])

    useEffect(() => {
        generateQuery()
    }, [generateQuery])

    // Toggle field selection
    const toggleField = (path: string[], value: boolean) => {
        setSelectedFields(prev => {
            const newFields = { ...prev }
            let current: any = newFields

            for (let i = 0; i < path.length - 1; i++) {
                if (typeof current[path[i]] !== "object") {
                    current[path[i]] = {}
                }
                current = current[path[i]]
            }

            current[path[path.length - 1]] = value
            return newFields
        })
    }

    // Toggle section expansion
    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    // Execute GraphQL query
    const executeQuery = async () => {
        if (!generatedQuery.trim()) return

        setIsLoading(true)
        setOutput("Executing GraphQL query...")

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: generatedQuery
                })
            })

            const result = await response.json()
            setOutput(result)

        } catch (error) {
            setOutput(`Error: ${error}`)
        } finally {
            setIsLoading(false)
        }
    }

    const copyQuery = () => {
        navigator.clipboard.writeText(generatedQuery)
        setIsCopied(true)
        setTimeout(() => {
            setIsCopied(false)
        }, 1000)
    }

    const loadExample = () => {
        // Set example based on current query type
        if (queryType === 'transactions') {
            setSelectedFields({
                pageInfo: {
                    hasNextPage: true
                },
                count: true,
                edges: {
                    cursor: true,
                    node: {
                        id: true,
                        owner: {
                            address: true,
                            key: false
                        },
                        data: {
                            size: true,
                            type: true
                        },
                        tags: {
                            name: true,
                            value: true
                        },
                        block: {
                            timestamp: true,
                            height: true
                        }
                    }
                }
            })
        } else {
            setSelectedFields({
                id: true,
                owner: {
                    address: true,
                    key: false
                },
                data: {
                    size: true,
                    type: true
                },
                tags: {
                    name: true,
                    value: true
                },
                block: {
                    timestamp: true,
                    height: true
                }
            })
        }
        setFilters({ first: 5, sort: 'HEIGHT_DESC' })
    }

    const clearAll = () => {
        setSelectedFields({})
        setFilters({ first: 10, sort: 'HEIGHT_DESC' })
        setRawInputs({
            ids: '',
            owners: '',
            recipients: '',
            bundledIn: ''
        })
        setOutput(null)
        handleQueryTypeChange('transactions')
    }

    // Field checkbox component
    const FieldCheckbox = ({ label, path, checked }: { label: string; path: string[]; checked: boolean }) => (
        <div className="flex items-center space-x-2">
            <Checkbox
                id={path.join('.')}
                checked={checked}
                onCheckedChange={(value) => toggleField(path, !!value)}
            />
            <Label htmlFor={path.join('.')} className="text-sm font-mono">
                {label}
            </Label>
        </div>
    )

    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-3 py-2 border-b border-border/40 bg-sidebar/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            GraphQL Explorer
                        </span>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 hover:bg-accent hidden sm:flex"
                            onClick={loadExample}
                        >
                            <span className="text-xs">Example</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 hover:bg-accent hidden sm:flex"
                            onClick={clearAll}
                        >
                            <span className="text-xs">Clear</span>
                        </Button>
                    </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                    Visual GraphQL query builder
                </div>
            </div>

            <ScrollArea className="flex-1 max-h-[calc(100vh-107px)] overflow-y-auto">
                <div className="p-2.5 space-y-4">


                    {/* Query Type Selection */}
                    <div className="space-y-3">
                        <div className="flex gap-2 text-sm items-center">
                            <div className="text-muted-foreground mr-auto">Query Type</div>
                            <Badge
                                className={`cursor-pointer bg-muted ${queryType === 'transactions' ? "bg-primary" : ""}`}
                                onClick={() => handleQueryTypeChange('transactions')}
                            >
                                Transactions
                            </Badge>
                            <Badge
                                className={`cursor-pointer bg-muted ${queryType === 'transaction' ? "bg-primary" : ""}`}
                                onClick={() => handleQueryTypeChange('transaction')}
                            >
                                Single
                            </Badge>
                        </div>
                    </div>

                    <Separator />

                    {queryType === 'transaction' && (
                        <div className="space-y-1">
                            <Label className="text-xs">Transaction ID</Label>
                            <Input
                                placeholder="Enter transaction ID"
                                value={singleTransactionId}
                                onChange={(e) => setSingleTransactionId(e.target.value)}
                                className="text-xs font-mono"
                            />
                        </div>
                    )}

                    {/* Query Filters */}
                    {queryType === 'transactions' && (
                        <Card className="p-3 gap-0">
                            <CardHeader className="px-0 pt-0 pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    Query Filters
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-0 pb-0 space-y-3">
                                {/* Basic Filters */}
                                <div className="flex gap-3">
                                    <div className="space-y-1 w-full">
                                        <Label className="text-xs">Limit</Label>
                                        <Input
                                            type="number"
                                            placeholder="10"
                                            value={filters.first || ""}
                                            onChange={(e) => setFilters(prev => ({ ...prev, first: parseInt(e.target.value) || undefined }))}
                                            className="text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Sort Order</Label>
                                        <Select value={filters.sort || 'HEIGHT_DESC'} onValueChange={(value: any) => setFilters(prev => ({ ...prev, sort: value }))}>
                                            <SelectTrigger className="text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="HEIGHT_DESC">Height ↓ (Newest)</SelectItem>
                                                <SelectItem value="HEIGHT_ASC">Height ↑ (Oldest)</SelectItem>
                                                <SelectItem value="INGESTED_AT_DESC">Ingested ↓ (Recent)</SelectItem>
                                                <SelectItem value="INGESTED_AT_ASC">Ingested ↑ (Oldest)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">After Cursor</Label>
                                    <Input
                                        placeholder="cursor..."
                                        value={filters.after || ""}
                                        onChange={(e) => setFilters(prev => ({ ...prev, after: e.target.value || undefined }))}
                                        className="text-xs font-mono"
                                    />
                                </div>

                                {/* Advanced Filters Toggle */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 justify-start w-full"
                                    onClick={() => toggleSection('advancedFilters')}
                                >
                                    {expandedSections.advancedFilters ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    <span className="text-sm ml-1">Advanced Filters</span>
                                </Button>

                                {expandedSections.advancedFilters && (
                                    <div className="space-y-3 border-l border-border pl-3">
                                        {/* IDs Filter */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Transaction IDs</Label>
                                            <Input
                                                placeholder="id1,id2,id3..."
                                                value={rawInputs.ids}
                                                onChange={(e) => setRawInputs(prev => ({
                                                    ...prev,
                                                    ids: e.target.value
                                                }))}
                                                className="text-xs font-mono"
                                            />
                                        </div>

                                        {/* Owners Filter */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Owner Addresses</Label>
                                            <Input
                                                placeholder="address1,address2..."
                                                value={rawInputs.owners}
                                                onChange={(e) => setRawInputs(prev => ({
                                                    ...prev,
                                                    owners: e.target.value
                                                }))}
                                                className="text-xs font-mono"
                                            />
                                        </div>

                                        {/* Recipients Filter */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Recipient Addresses</Label>
                                            <Input
                                                placeholder="address1,address2..."
                                                value={rawInputs.recipients}
                                                onChange={(e) => setRawInputs(prev => ({
                                                    ...prev,
                                                    recipients: e.target.value
                                                }))}
                                                className="text-xs font-mono"
                                            />
                                        </div>

                                        {/* Bundle IDs Filter */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Bundle IDs</Label>
                                            <Input
                                                placeholder="bundle1,bundle2..."
                                                value={rawInputs.bundledIn}
                                                onChange={(e) => setRawInputs(prev => ({
                                                    ...prev,
                                                    bundledIn: e.target.value
                                                }))}
                                                className="text-xs font-mono"
                                            />
                                        </div>

                                        {/* Block Height Range */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Block Height Range</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Min height"
                                                    value={filters.block?.min || ""}
                                                    onChange={(e) => setFilters(prev => ({
                                                        ...prev,
                                                        block: { ...prev.block, min: parseInt(e.target.value) || undefined }
                                                    }))}
                                                    className="text-xs"
                                                />
                                                <Input
                                                    type="number"
                                                    placeholder="Max height"
                                                    value={filters.block?.max || ""}
                                                    onChange={(e) => setFilters(prev => ({
                                                        ...prev,
                                                        block: { ...prev.block, max: parseInt(e.target.value) || undefined }
                                                    }))}
                                                    className="text-xs"
                                                />
                                            </div>
                                        </div>

                                        {/* Ingested At Range */}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Ingested At Range (Unix timestamps)</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Min timestamp"
                                                    value={filters.ingested_at?.min || ""}
                                                    onChange={(e) => setFilters(prev => ({
                                                        ...prev,
                                                        ingested_at: { ...prev.ingested_at, min: parseInt(e.target.value) || undefined }
                                                    }))}
                                                    className="text-xs"
                                                />
                                                <Input
                                                    type="number"
                                                    placeholder="Max timestamp"
                                                    value={filters.ingested_at?.max || ""}
                                                    onChange={(e) => setFilters(prev => ({
                                                        ...prev,
                                                        ingested_at: { ...prev.ingested_at, max: parseInt(e.target.value) || undefined }
                                                    }))}
                                                    className="text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Separator />

                    {/* Field Selection */}
                    <Card className="p-3">
                        <CardHeader className="px-0 pt-0 pb-3">
                            <CardTitle className="text-sm">Select Fields</CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 pb-0 space-y-3">
                            {queryType === 'transactions' && (
                                <>
                                    {/* Connection level fields */}
                                    <FieldCheckbox
                                        label="count"
                                        path={["count"]}
                                        checked={!!selectedFields.count}
                                    />

                                    {/* PageInfo fields */}
                                    <div className="space-y-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-1 justify-start"
                                            onClick={() => toggleSection('pageInfo')}
                                        >
                                            {expandedSections.pageInfo ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            <span className="text-sm font-mono ml-1">pageInfo</span>
                                        </Button>
                                        {expandedSections.pageInfo && (
                                            <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                <FieldCheckbox label="hasNextPage" path={["pageInfo", "hasNextPage"]} checked={!!(selectedFields.pageInfo as any)?.hasNextPage} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Edges fields */}
                                    <div className="space-y-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-1 justify-start"
                                            onClick={() => toggleSection('edges')}
                                        >
                                            {expandedSections.edges ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            <span className="text-sm font-mono ml-1">edges</span>
                                        </Button>
                                        {expandedSections.edges && (
                                            <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                <FieldCheckbox label="cursor" path={["edges", "cursor"]} checked={!!(selectedFields.edges as any)?.cursor} />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Node fields */}
                            <div className="space-y-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 justify-start"
                                    onClick={() => toggleSection('node')}
                                >
                                    {expandedSections.node ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    <span className="text-sm font-mono ml-1">{queryType === 'transactions' ? 'edges.node' : 'transaction'}</span>
                                </Button>

                                {expandedSections.node && (
                                    <div className="ml-4 space-y-2 border-l border-border pl-3">
                                        {(() => {
                                            const basePath = queryType === 'transactions' ? ["edges", "node"] : []
                                            const nodeData = queryType === 'transactions' ? (selectedFields.edges as any)?.node : selectedFields

                                            return (
                                                <>
                                                    <FieldCheckbox label="id" path={[...basePath, "id"]} checked={!!nodeData?.id} />
                                                    <FieldCheckbox label="anchor" path={[...basePath, "anchor"]} checked={!!nodeData?.anchor} />
                                                    <FieldCheckbox label="signature" path={[...basePath, "signature"]} checked={!!nodeData?.signature} />
                                                    <FieldCheckbox label="recipient" path={[...basePath, "recipient"]} checked={!!nodeData?.recipient} />
                                                    <FieldCheckbox label="ingested_at" path={[...basePath, "ingested_at"]} checked={!!nodeData?.ingested_at} />
                                                </>
                                            )
                                        })()}

                                        {/* Owner fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('owner')}
                                            >
                                                {expandedSections.owner ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">owner</span>
                                            </Button>
                                            {expandedSections.owner && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "owner"] : ["owner"]
                                                        const ownerData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.owner : (selectedFields as any)?.owner

                                                        return (
                                                            <>
                                                                <FieldCheckbox label="address" path={[...basePath, "address"]} checked={!!ownerData?.address} />
                                                                <FieldCheckbox label="key" path={[...basePath, "key"]} checked={!!ownerData?.key} />
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Fee fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('fee')}
                                            >
                                                {expandedSections.fee ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">fee</span>
                                            </Button>
                                            {expandedSections.fee && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "fee"] : ["fee"]
                                                        const feeData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.fee : (selectedFields as any)?.fee

                                                        return (
                                                            <>
                                                                <FieldCheckbox label="winston" path={[...basePath, "winston"]} checked={!!feeData?.winston} />
                                                                <FieldCheckbox label="ar" path={[...basePath, "ar"]} checked={!!feeData?.ar} />
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Quantity fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('quantity')}
                                            >
                                                {expandedSections.quantity ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">quantity</span>
                                            </Button>
                                            {expandedSections.quantity && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "quantity"] : ["quantity"]
                                                        const quantityData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.quantity : (selectedFields as any)?.quantity

                                                        return (
                                                            <>
                                                                <FieldCheckbox label="winston" path={[...basePath, "winston"]} checked={!!quantityData?.winston} />
                                                                <FieldCheckbox label="ar" path={[...basePath, "ar"]} checked={!!quantityData?.ar} />
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Data fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('data')}
                                            >
                                                {expandedSections.data ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">data</span>
                                            </Button>
                                            {expandedSections.data && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "data"] : ["data"]
                                                        const dataData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.data : (selectedFields as any)?.data

                                                        return (
                                                            <>
                                                                <FieldCheckbox label="size" path={[...basePath, "size"]} checked={!!dataData?.size} />
                                                                <FieldCheckbox label="type" path={[...basePath, "type"]} checked={!!dataData?.type} />
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Tags fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('tags')}
                                            >
                                                {expandedSections.tags ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">tags</span>
                                            </Button>
                                            {expandedSections.tags && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "tags"] : ["tags"]
                                                        const tagsData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.tags : (selectedFields as any)?.tags

                                                        return (
                                                            <>
                                                                <FieldCheckbox label="name" path={[...basePath, "name"]} checked={!!tagsData?.name} />
                                                                <FieldCheckbox label="value" path={[...basePath, "value"]} checked={!!tagsData?.value} />
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Block fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('block')}
                                            >
                                                {expandedSections.block ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">block</span>
                                            </Button>
                                            {expandedSections.block && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "block"] : ["block"]
                                                        const blockData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.block : (selectedFields as any)?.block

                                                        return (
                                                            <>
                                                                <FieldCheckbox label="id" path={[...basePath, "id"]} checked={!!blockData?.id} />
                                                                <FieldCheckbox label="timestamp" path={[...basePath, "timestamp"]} checked={!!blockData?.timestamp} />
                                                                <FieldCheckbox label="height" path={[...basePath, "height"]} checked={!!blockData?.height} />
                                                                <FieldCheckbox label="previous" path={[...basePath, "previous"]} checked={!!blockData?.previous} />
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* BundledIn fields */}
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-1 justify-start"
                                                onClick={() => toggleSection('bundledIn')}
                                            >
                                                {expandedSections.bundledIn ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm font-mono ml-1">bundledIn</span>
                                            </Button>
                                            {expandedSections.bundledIn && (
                                                <div className="ml-4 space-y-1 border-l border-border pl-3">
                                                    {(() => {
                                                        const basePath = queryType === 'transactions' ? ["edges", "node", "bundledIn"] : ["bundledIn"]
                                                        const bundledData = queryType === 'transactions' ? (selectedFields.edges as any)?.node?.bundledIn : (selectedFields as any)?.bundledIn

                                                        return (
                                                            <FieldCheckbox label="id" path={[...basePath, "id"]} checked={!!bundledData?.id} />
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Separator />

                    {/* Generated Query Preview */}
                    <Card className="gap-1 p-2.5">
                        <CardHeader className="px-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                                Generated Query
                                <Button size="sm" variant="ghost" onClick={copyQuery}>
                                    {isCopied ? (
                                        <Check className="!w-3 !h-3" size={10} />
                                    ) : (
                                        <Copy className="!w-3 !h-3" size={10} />
                                    )}
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                            <SyntaxHighlighter
                                language="graphql"
                                style={oneDark}
                                wrapLines={true}
                                wrapLongLines={true}
                                customStyle={{
                                    fontSize: '0.75rem',
                                    fontFamily: 'var(--font-btr-code)',
                                    margin: 0,
                                    borderRadius: '0.375rem',
                                    background: 'hsl(var(--muted))',
                                    whiteSpace: 'pre-wrap',
                                    padding: "0px",
                                    wordBreak: 'break-all',
                                    overflowWrap: 'break-word',
                                }}
                                codeTagProps={{
                                    style: {
                                        fontFamily: 'var(--font-btr-code)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        overflowWrap: 'break-word',
                                    }
                                }}
                            >
                                {generatedQuery}
                            </SyntaxHighlighter>
                        </CardContent>
                    </Card>

                    {/* Execute Button */}
                    <Button
                        onClick={executeQuery}
                        disabled={isLoading || !generatedQuery.trim() || generatedQuery.startsWith('#') || (queryType === 'transaction' && !singleTransactionId.trim())}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Executing Query...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Execute Query
                            </>
                        )}
                    </Button>

                    {/* Results */}
                    {output && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Results</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {typeof output === "string" ? (
                                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono whitespace-pre-wrap break-all">
                                        {output}
                                    </pre>
                                ) : (
                                    <JsonViewer data={output} />
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
})

export default GraphQL