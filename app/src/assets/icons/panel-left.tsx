interface PanelLeftProps {
    filled?: boolean;
    onClick?: () => void;
}

export default function PanelLeft({ filled = false, onClick }: PanelLeftProps) {
    return (
        <svg
            onClick={onClick}
            xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left-icon lucide-panel-left cursor-pointer">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            {filled && <path d="M5 3h4v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" />}
        </svg>
    )
}
