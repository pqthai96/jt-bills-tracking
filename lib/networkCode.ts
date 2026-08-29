// ─── Network codes (Mã BC) ────────────────────────────────────────────────────
export const NETWORK_CODES: { code: string; label: string; agentCode: string }[] = [
    {code: "028M08", label: "028M08", agentCode: "028001"},
    {code: "028W04", label: "028W04", agentCode: "028001"},
    {code: "275H01", label: "275H01", agentCode: "292001"},
];

export const NETWORK_CODE_STORAGE_KEY = "YL_NETWORK_CODE";

// Helper other pages/services can import to read the selected network code
export function getStoredNetworkCode(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(NETWORK_CODE_STORAGE_KEY) || "";
}