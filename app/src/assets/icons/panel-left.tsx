interface PanelLeftProps {
    filled?: boolean;
    onClick?: () => void;
}

export default function PanelLeft({ filled = false, onClick }: PanelLeftProps) {
    return (
        <svg
            onClick={onClick}
            xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-panel-left-icon lucide-panel-left cursor-pointer">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            {filled && <rect width="6" height="18" x="3" y="3" rx="2 0 0 2" fill="currentColor" />}
        </svg>
    )
}
