import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import React from "react"
import { createDataItemSigner } from "@permaweb/aoconnect"
import {
  Code,
  FileText,
  FileJson,
  Database,
  Package,
  FileQuestion,
  Image,
  Settings
} from "lucide-react"
import type { Project } from "@/hooks/use-projects"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-6)
}

/**
 * Get the appropriate file icon component and color classes based on filename
 * @param filename - The name of the file
 * @param size - The size of the icon (default: 16)
 * @returns Object with icon component and className
 */
export function getFileIcon(filename: string, size: number = 16) {
  const extension = filename.split(".").pop()?.toLowerCase()
  const type = filename.split(":")[0]

  switch (extension) {
    case "lua":
    case "luanb":
      return {
        icon: Code,
        className: "text-blue-500 dark:text-blue-400",
        size
      }
    case "js":
    case "jsx":
      return {
        icon: Code,
        className: "text-yellow-600 dark:text-yellow-400",
        size
      }
    case "ts":
    case "tsx":
      return {
        icon: Code,
        className: "text-blue-600 dark:text-blue-400",
        size
      }
    case "json":
      return {
        icon: FileJson,
        className: "text-orange-600 dark:text-orange-400",
        size
      }
    case "md":
    case "txt":
      return {
        icon: FileText,
        className: "text-slate-500 dark:text-slate-400",
        size
      }
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return {
        icon: Image,
        className: "text-purple-500 dark:text-purple-400",
        size
      }
    case "css":
    case "scss":
    case "sass":
      return {
        icon: Code,
        className: "text-pink-500 dark:text-pink-400",
        size
      }
    case "html":
    case "htm":
      return {
        icon: Code,
        className: "text-red-500 dark:text-red-400",
        size
      }
    case "xml":
    case "yaml":
    case "yml":
      return {
        icon: Settings,
        className: "text-gray-600 dark:text-gray-400",
        size
      }
    default:
      switch (type) {
        case "PKG":
          return {
            icon: Package,
            className: "text-green-600 dark:text-green-400",
            size
          }
        case "TBL":
          return {
            icon: Database,
            className: "text-purple-600 dark:text-purple-400",
            size
          }
        default:
          return {
            icon: FileQuestion,
            className: "text-slate-500 dark:text-slate-400",
            size
          }
      }
  }
}

/**
 * Get a rendered file icon component based on filename
 * @param filename - The name of the file
 * @param size - The size of the icon (default: 16)
 * @returns JSX element with the appropriate icon
 */
export function getFileIconElement(filename: string, size: number = 16) {
  const { icon: Icon, className } = getFileIcon(filename, size)
  return React.createElement(Icon, { size, className })
}

/**
 * Validates if a string is a valid Arweave transaction ID
 * @param id - The ID string to validate
 * @returns boolean - true if valid Arweave ID, false otherwise
 */
export function isValidArweaveId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false
  }

  // Arweave transaction IDs are 43 characters long and use base64url encoding
  // Valid characters: A-Z, a-z, 0-9, -, _
  const arweaveIdRegex = /^[A-Za-z0-9_-]{43}$/
  return arweaveIdRegex.test(id.trim())
}

/**
 * Validates if a string is a valid Arweave transaction ID with detailed error message
 * @param id - The ID string to validate
 * @param fieldName - The name of the field being validated (for error messages)
 * @returns object with isValid boolean and error message if invalid
 */
export function validateArweaveId(id: string, fieldName: string = "ID"): { isValid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return {
      isValid: false,
      error: `${fieldName} is required`
    }
  }

  const trimmedId = id.trim()

  if (!trimmedId) {
    return {
      isValid: false,
      error: `${fieldName} is required`
    }
  }

  if (trimmedId.length !== 43) {
    return {
      isValid: false,
      error: `${fieldName} must be exactly 43 characters long`
    }
  }

  // Check for valid base64url characters
  if (!/^[A-Za-z0-9_-]+$/.test(trimmedId)) {
    return {
      isValid: false,
      error: `${fieldName} contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed`
    }
  }

  return { isValid: true }
}

/**
 * Check if a string is valid JSON
 * @param str - The string to check
 * @returns boolean indicating if the string is valid JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * Detect the type of a simple value for syntax highlighting
 * @param value - The string value to analyze
 * @returns Object with type and the original value
 */
export function detectValueType(value: string): { type: 'number' | 'boolean' | 'string' | 'unknown', value: string } {
  const trimmed = value.trim()

  // Check if it's a number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { type: 'number', value: trimmed }
  }

  // Check if it's a boolean
  if (trimmed === 'true' || trimmed === 'false') {
    return { type: 'boolean', value: trimmed }
  }

  // Everything else is treated as string
  return { type: 'string', value }
}

/**
 * Check if a text string contains error patterns
 * @param text - The text to check for error patterns
 * @returns true if the text contains error indicators, false otherwise
 */
export function isErrorText(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();
  return lowerText.includes('error:') ||
    lowerText.includes('error ') ||
    lowerText.includes('syntax error') ||
    lowerText.includes('runtime error') ||
    lowerText.includes('parse error') ||
    lowerText.includes('compilation error') ||
    lowerText.startsWith('error') ||
    lowerText.includes('exception:') ||
    lowerText.includes('failed:') ||
    lowerText.includes('invalid:');
}

/**
 * Check if AO execution result indicates an error
 * @param result - The raw result object from AO process execution
 * @returns true if the result indicates an error, false otherwise
 */
export function isExecutionError(result: any): boolean {
  console.log("isExecutionError", result)
  // Only check status field and error field, not content
  if (result?.status === "error" || !!result?.error || result.status != 200) {
    return true;
  }

  return false;
}

/**
 * Parse AO process execution output to extract meaningful data or errors
 * @param result - The raw result object from AO process execution
 * @returns Formatted output string showing data or error information
 */
export function parseOutput(result: any): string {
  try {
    // Handle null or undefined results
    if (!result) {
      return "No output received"
    }

    // Check for error status
    if (result.status === "error" || result.error) {
      // For AO errors, check output.data first, then fallback to other error fields
      // If output.data exists (even if empty string), use it as-is without adding "Error:" prefix
      if (result.output?.data !== undefined) {
        return result.output.data
      }
      // Only add error text if there's an actual error message in other fields
      const errorMessage = result.error || result.message
      if (errorMessage) {
        return `Error: ${errorMessage}`
      }
      // If status is error but no error text anywhere, return empty string
      return ""
    }

    // Extract output data if available
    if (result.output && result.output.data) {
      // Clean up the data by removing trailing "nil" if present
      let outputData = result.output.data
      if (typeof outputData === 'string') {
        // Remove trailing "\nnil" that AO often appends
        outputData = outputData.replace(/\nnil$/, '')

        // Strip ANSI color codes from string outputs
        outputData = stripAnsiCodes(outputData)

        // For simple string outputs, return as-is without quotes
        return outputData
      }

      // For non-string data, JSON stringify with formatting
      return JSON.stringify(outputData, null, 2)
    }

    // Check for direct data property
    if (result.data) {
      if (typeof result.data === 'string') {
        // Strip ANSI color codes from string outputs
        return stripAnsiCodes(result.data)
      }
      return JSON.stringify(result.data, null, 2)
    }

    // If we have a result but no clear output, show the whole result
    return JSON.stringify(result, null, 2)
  } catch (error) {
    return `Error parsing output: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * ANSI color constants for terminal output formatting
 */
export const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',

  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',
  STRIKETHROUGH: '\x1b[9m',

  // Foreground colors
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',

  // Bright foreground colors
  LIGHTRED: '\x1b[91m',
  LIGHTGREEN: '\x1b[92m',
  LIGHTYELLOW: '\x1b[93m',
  LIGHTBLUE: '\x1b[94m',
  LIGHTMAGENTA: '\x1b[95m',
  LIGHTCYAN: '\x1b[96m',

  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // Special sequences
  CLEARLINE: '\r\x1b[K',
  CLEAR: '\x1b[2J\x1b[H'
} as const

/**
 * Strip ANSI escape sequences from a string
 * @param str - String containing ANSI escape sequences
 * @returns Clean string without ANSI codes
 */
export function stripAnsiCodes(str: string): string {
  // Remove standard ANSI escape sequences (\x1b[...m)
  let cleaned = str.replace(/\x1b\[[0-9;]*m/g, '')

  // Also remove ANSI sequences that might be missing the escape character ([...m)
  cleaned = cleaned.replace(/\[[0-9;]*m/g, '')

  return cleaned
}

/**
 * Create a new project with default structure
 * @param projectName - The name of the new project
 * @param ownerAddress - The wallet address of the project owner
 * @param isMainnet - Whether the project is on mainnet
 * @param processId - Optional existing process ID
 * @returns A new Project object with default files and structure
 */
export function createNewProject(
  projectName: string,
  ownerAddress: string,
  isMainnet: boolean = true,
  processId?: string
): Project {
  return {
    name: projectName,
    files: {
      "main.lua": {
        name: "main.lua",
        cellOrder: ["init"],
        cells: {
          "init": {
            id: "init",
            content: 'print("Hello AO!")',
            output: "",
            type: "CODE",
            editing: false
          }
        },
        isMainnet,
        ownerAddress
      }
    },
    process: processId || "",
    ownerAddress,
    isMainnet
  }
}


export async function fetchProjectFromProcess({ procesId, HB_URL = "https://hb.arweave.tech" }: { procesId: string, HB_URL: string }) {
  const hashpath = `${HB_URL}/${procesId}/now/betteridea/~json@1.0/serialize`
  const res = await fetch(hashpath)
  const data = await res.json()
  return JSON.parse(data.body)
}

/**
 * Beautiful console logging utility with grouped, collapsible, and colored output
 */
export class Logger {
  private static groupStack: string[] = []
  private static colors = {
    primary: '#3b82f6',    // blue-500
    success: '#10b981',    // emerald-500
    warning: '#f59e0b',    // amber-500
    error: '#ef4444',      // red-500
    info: '#6366f1',       // indigo-500
    debug: '#8b5cf6',      // violet-500
    input: '#06b6d4',      // cyan-500
    output: '#84cc16',     // lime-500
    muted: '#6b7280'       // gray-500
  }

  private static getCallerInfo(): string {
    const stack = new Error().stack
    if (!stack) return ''

    const lines = stack.split('\n')
    // Skip the first few lines (Error, getCallerInfo, formatMessage, and the Logger method)
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i]
      if (line && !line.includes('Logger.') && !line.includes('formatMessage') && !line.includes('getCallerInfo')) {
        // Extract file name and line number from stack trace
        const match = line.match(/at\s+(?:.*\s+\()?(.+):(\d+):(\d+)\)?/)
        if (match) {
          const [, filePath, lineNum] = match
          const fileName = filePath.split('/').pop() || filePath
          return ` (${fileName}:${lineNum})`
        }
      }
    }
    return ''
  }

  private static formatMessage(level: string, message: any, color: string): void {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })

    const callerInfo = this.getCallerInfo()
    const prefix = `%c[${timestamp}] ${level.toUpperCase()}${callerInfo}`
    const styles = `color: ${color}; font-weight: bold; font-family: 'DM Mono', monospace;`

    if (typeof message === 'object' && message !== null) {
      console.log(prefix, styles, message)
    } else {
      console.log(prefix, styles, String(message))
    }
  }

  static info(message: any, ...args: any[]): void {
    this.formatMessage('info', message, this.colors.info)
    if (args.length > 0) {
      console.log(...args)
    }
  }

  static success(message: any, ...args: any[]): void {
    this.formatMessage('success', message, this.colors.success)
    if (args.length > 0) {
      console.log(...args)
    }
  }

  static warning(message: any, ...args: any[]): void {
    this.formatMessage('warn', message, this.colors.warning)
    if (args.length > 0) {
      console.log(...args)
    }
  }

  static error(message: any, ...args: any[]): void {
    this.formatMessage('error', message, this.colors.error)
    if (args.length > 0) {
      console.log(...args)
    }
  }

  static debug(message: any, ...args: any[]): void {
    this.formatMessage('debug', message, this.colors.debug)
    if (args.length > 0) {
      console.log(...args)
    }
  }

  static input(label: string, data: any): void {
    const callerInfo = this.getCallerInfo()
    console.groupCollapsed(
      `%c📥 INPUT: ${label}${callerInfo}`,
      `color: ${this.colors.input}; font-weight: bold; font-family: 'DM Mono', monospace;`
    )
    if (typeof data === 'object' && data !== null) {
      console.log('%cData:', `color: ${this.colors.muted}; font-weight: bold;`, data)
    } else {
      console.log('%cValue:', `color: ${this.colors.muted}; font-weight: bold;`, String(data))
    }
    console.groupEnd()
  }

  static output(label: string, data: any, isError: boolean = false): void {
    const color = isError ? this.colors.error : this.colors.output
    const icon = isError ? '❌' : '📤'
    const callerInfo = this.getCallerInfo()

    console.groupCollapsed(
      `%c${icon} OUTPUT: ${label}${callerInfo}`,
      `color: ${color}; font-weight: bold; font-family: 'DM Mono', monospace;`
    )

    if (isError) {
      console.log('%cError:', `color: ${this.colors.error}; font-weight: bold;`, data)
    } else if (typeof data === 'object' && data !== null) {
      console.log('%cResult:', `color: ${this.colors.muted}; font-weight: bold;`, data)
    } else {
      console.log('%cValue:', `color: ${this.colors.muted}; font-weight: bold;`, String(data))
    }
    console.groupEnd()
  }

  static group(label: string, color: string = this.colors.primary): void {
    this.groupStack.push(label)
    console.group(
      `%c🔗 ${label}`,
      `color: ${color}; font-weight: bold; font-family: 'DM Mono', monospace; font-size: 14px;`
    )
  }

  static groupCollapsed(label: string, color: string = this.colors.primary): void {
    this.groupStack.push(label)
    console.groupCollapsed(
      `%c📁 ${label}`,
      `color: ${color}; font-weight: bold; font-family: 'DM Mono', monospace; font-size: 14px;`
    )
  }

  static groupEnd(): void {
    if (this.groupStack.length > 0) {
      this.groupStack.pop()
      console.groupEnd()
    }
  }

  static execution(operation: string, input: any, output: any, isError: boolean = false): void {
    const color = isError ? this.colors.error : this.colors.primary
    const icon = isError ? '💥' : '⚡'
    const callerInfo = this.getCallerInfo()

    this.groupCollapsed(`${icon} ${operation}${callerInfo}`, color)

    // Input section
    console.groupCollapsed(
      `%c📥 Input`,
      `color: ${this.colors.input}; font-weight: bold; font-family: 'DM Mono', monospace;`
    )
    console.log(input)
    console.groupEnd()

    // Output section
    const outputColor = isError ? this.colors.error : this.colors.output
    const outputIcon = isError ? '❌' : '✅'
    console.groupCollapsed(
      `%c${outputIcon} Output`,
      `color: ${outputColor}; font-weight: bold; font-family: 'DM Mono', monospace;`
    )
    console.log(output)
    console.groupEnd()

    this.groupEnd()
  }

  static table(label: string, data: any[]): void {
    this.groupCollapsed(`📊 ${label}`, this.colors.info)
    console.table(data)
    this.groupEnd()
  }

  static time(label: string): void {
    console.time(`⏱️ ${label}`)
  }

  static timeEnd(label: string): void {
    console.timeEnd(`⏱️ ${label}`)
  }

  static clear(): void {
    console.clear()
    this.groupStack = []
  }
}


export async function pingUrl(url: string, timeoutMs: number = 5000) {
  try {
    // Validate URL format
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }

    const startTime = performance.now();

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // First try with manual redirect handling to capture 302 responses
      const response = await fetch(url, {
        method: 'HEAD', // HEAD request is lighter than GET
        cache: 'no-cache',
        mode: 'cors',
        redirect: 'manual', // Don't follow redirects automatically
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      // Only treat 5xx server errors as failures
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      // All other responses (2xx, 3xx, 4xx) are considered successful pings
      // This includes 302 redirects which we explicitly want to capture
      return {
        success: true,
        latency,
        status: response.status,
        url
      };

    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle specific error types
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }

      // If it's a server error we threw, re-throw it
      if (fetchError.message.includes('Server error:')) {
        throw fetchError;
      }

      // Log the error for debugging
      console.log(`Ping error for ${url}:`, fetchError.message, fetchError);

      // For any fetch error that might be CORS-related, try fallback methods
      // This includes CORS errors, network errors, and generic fetch failures
      try {
        const noCorsResponse = await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        return {
          success: true,
          latency,
          status: 0, // Status will be 0 in no-cors mode
          url
        };
      } catch (noCorsError) {
        console.log(`No-cors also failed for ${url}:`, noCorsError.message);
        // If no-cors also fails, try image ping as final fallback
        try {
          return await imagePing(url, startTime);
        } catch (imagePingError) {
          console.log(`Image ping also failed for ${url}:`, imagePingError);
          // If all methods fail, it's a true network error
          throw fetchError;
        }
      }

      // Network-level errors (DNS, connection refused, etc.) are true failures
      throw fetchError;
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url
    };
  }
}

// Fallback ping method using image loading (works around CORS)
async function imagePing(url: string, startTime: number): Promise<{ success: boolean, latency: number, status?: number, url: string }> {
  return new Promise<{ success: boolean, latency: number, status?: number, url: string }>((resolve) => {
    const img = document.createElement('img');

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      resolve({
        success: true,
        latency,
        status: 200, // Assume 200 if image loads
        url
      });
    };

    img.onerror = () => {
      cleanup();
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      // Even if image fails to load, we got a response (server is reachable)
      resolve({
        success: true,
        latency,
        status: 404, // Assume 404 if image fails but server responds
        url
      });
    };

    // Try to load a favicon or small resource from the domain
    const urlObj = new URL(url);
    img.src = `${urlObj.protocol}//${urlObj.host}/favicon.ico?t=${Date.now()}`;
  });
}

export async function pingGraphql(url: string = "https://arweave.tech/graphql"): Promise<{ success: boolean, latency: number, status?: number, url: string, error?: string }> {
  try {
    // Extract base domain from GraphQL URL
    const urlObj = new URL(url);
    const baseDomain = `${urlObj.protocol}//${urlObj.host}`;

    // Use the existing pingUrl function to do a simple ping on the base domain
    const result = await pingUrl(baseDomain, 10000); // 10 second timeout

    if (result.success) {
      return {
        success: result.success,
        latency: 'latency' in result ? result.latency : 0,
        status: 'status' in result ? result.status : undefined,
        url,
        error: undefined
      };
    } else {
      return {
        success: result.success,
        latency: 0,
        status: undefined,
        url,
        error: 'error' in result ? result.error : "Unknown error"
      };
    }
  } catch (error) {
    return {
      success: false,
      latency: 0,
      url,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
