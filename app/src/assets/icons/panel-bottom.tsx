interface PanelBottomProps {
    filled?: boolean;
    onClick?: () => void;
}

export default function PanelBottom({ filled = false, onClick }: PanelBottomProps) {
    return (
        <svg
            onClick={onClick}
            xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-bottom-icon lucide-panel-bottom cursor-pointer">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 15h18" />
            {filled && <path d="M3 15h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z" fill="currentColor" />}
        </svg>
    )
}