interface PanelBottomProps {
    filled?: boolean;
    onClick?: () => void;
}

export default function PanelBottom({ filled = false, onClick }: PanelBottomProps) {
    return (
        <svg
            onClick={onClick}
            xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-panel-bottom-icon lucide-panel-bottom cursor-pointer">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 15h18" />
            {filled && <rect width="18" height="6" x="3" y="15" rx="0 0 2 2" fill="currentColor" />}
        </svg>
    )
}