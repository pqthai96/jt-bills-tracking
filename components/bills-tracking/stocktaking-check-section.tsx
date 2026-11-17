"use client";

import React, {
    useEffect, useState, useMemo, useRef, useCallback, useDeferredValue, memo,
} from "react";
import axios from "axios";
import {
    Search, Package, Filter, RotateCcw, ArrowLeft,
    Warehouse, CheckCircle2, XCircle, Clock,
    RefreshCw, Copy, Check,
    CalendarDays, ChevronLeft, ChevronRight, ArrowUpDown, X,
} from "lucide-react";
import OrderDetail from "@/components/bills-tracking/order-detail";
import PodHistory from "@/components/bills-tracking/pod-history";
import IssueHistory from "@/components/bills-tracking/issue-history";
import { DetailCache } from "@/components/bills-tracking/bills-tracking-section";
import { NETWORK_CODE_STORAGE_KEY } from "@/lib/networkCode";

// ─── Font loader ───────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        body, body * { font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; }
        .mono { font-family: 'JetBrains Mono', 'Fira Mono', monospace; }
        @keyframes slide-in {
            from { opacity: 0; transform: translateX(-8px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        .slide-in { animation: slide-in 0.2s ease-out; }
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.25s ease-out; }
        @keyframes content-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .content-fade { animation: content-fade 0.18s ease-out; }
        @keyframes progress-shimmer {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
        }
        .progress-shimmer {
            background: linear-gradient(
                90deg,
                #4338ca 0%, #6366f1 40%, #818cf8 50%, #6366f1 60%, #4338ca 100%
            );
            background-size: 200% auto;
            animation: progress-shimmer 1.8s linear infinite;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
    `}</style>
);

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StocktakingCheckSectionProps {
    bills: string[];
    authToken: string;
    selectedDate: string;
    onDateChange: (date: string) => void;
}

type StocktakingStatus = "checked" | "not_checked" | "loading" | "error";
type SortMode = "default" | "dispatch_asc" | "dispatch_desc";

interface BillInfo {
    waybill: string;
    terminalDispatchCode: string;
    groupLevel1: string;
    groupLevel2: string;
    groupColor: string;
    stocktakingStatus: StocktakingStatus;
    latestScanTypeName: string;
    latestScanTime: string;
    latestScanNetworkCode: string;
    stocktakingTime: string;
    stocktakingNetworkCode: string;
    lastIssueScanner: string;
    hasReturnTransfer: boolean;   // Đang chuyển hoàn (đã duyệt)
    hasReturnRegistered: boolean; // Đăng ký chuyển hoàn (chưa duyệt)
    hasDispatchedToday: boolean;  // Quét phát hàng trong ngày hôm nay
    hasGiaoLaiHang: boolean;      // Có Giao lại hàng sau ĐKCH
}

interface LoadProgress {
    total: number;
    done: number;
    failed: number;
    startedAt: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const STOCKTAKING_KEYWORDS = ["kiểm tồn", "stocktaking", "kiểm kho", "tồn kho", "inventory"];
const EXCLUDED_SCAN_TYPE   = 'Lịch sử cuộc gọi-phát';
const BATCH_SIZE     = 5;
const MAX_RETRY      = 3;
const RETRY_DELAY_MS = 800;
const DEFAULT_NETWORK_CODE = "028M08";

const GROUP_COLORS = [
    'bg-blue-50 border-blue-200',
    'bg-emerald-50 border-emerald-200',
    'bg-amber-50 border-amber-200',
    'bg-purple-50 border-purple-200',
    'bg-pink-50 border-pink-200',
    'bg-indigo-50 border-indigo-200',
    'bg-slate-50 border-slate-200',
    'bg-rose-50 border-rose-200',
    'bg-orange-50 border-orange-200',
    'bg-teal-50 border-teal-200',
];

// ─── Batch / Retry helpers ────────────────────────────────────────────────────
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxRetry = MAX_RETRY): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetry; attempt++) {
        try { return await fn(); } catch (err) {
            lastErr = err;
            if (attempt < maxRetry) await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
    }
    throw lastErr;
}

async function runInBatches<T>(
    items: T[],
    handler: (item: T) => Promise<void>,
    onProgress: (done: number, failed: number) => void,
    batchSize = BATCH_SIZE,
) {
    let done = 0; let failed = 0;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(async item => {
            try { await handler(item); done++; }
            catch { failed++; done++; }
            onProgress(done, failed);
        }));
    }
}

function formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}p ${s}s` : `${m}p`;
}

// ─── Chuẩn hóa Mã BC: object / JSON string / string → string (vd: "028M08") ──
function extractNetworkCode(raw: unknown): string {
    if (!raw) return DEFAULT_NETWORK_CODE;

    if (typeof raw === 'object') {
        const obj = raw as { code?: string; label?: string };
        return String(obj.code || obj.label || DEFAULT_NETWORK_CODE).trim();
    }

    if (typeof raw === 'string') {
        const text = raw.trim();
        if (!text) return DEFAULT_NETWORK_CODE;

        if (text.startsWith('{')) {
            try {
                const obj = JSON.parse(text);
                return String(obj?.code || obj?.label || DEFAULT_NETWORK_CODE).trim();
            } catch {
                return DEFAULT_NETWORK_CODE;
            }
        }

        return text.replace(/^"+|"+$/g, '') || DEFAULT_NETWORK_CODE;
    }

    return DEFAULT_NETWORK_CODE;
}

// ─── Phân loại đơn hàng ───────────────────────────────────────────────────────
function isTraditionalOrder(waybill: string): boolean {
    const prefix = waybill.substring(0, 2);
    return prefix === "80" || prefix === "84";
}

// ─── Kiểm tra ngày hôm nay ────────────────────────────────────────────────────
function isScanToday(scanTime: string | number | null | undefined): boolean {
    if (!scanTime) return false;
    let dateObj: Date;
    if (typeof scanTime === 'number') {
        dateObj = new Date(scanTime);
    } else {
        const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(scanTime);
        if (ddmmyyyy) {
            dateObj = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
        } else {
            dateObj = new Date(scanTime);
        }
    }
    if (isNaN(dateObj.getTime())) return false;
    const today = new Date();
    return (
        dateObj.getFullYear() === today.getFullYear() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getDate() === today.getDate()
    );
}

// ─── Parse uploadTime thành timestamp ms ─────────────────────────────────────
function parseUploadTime(uploadTime: string | number | null | undefined): number {
    if (!uploadTime) return 0;
    if (typeof uploadTime === 'number') return uploadTime;
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(uploadTime);
    if (ddmmyyyy) {
        return new Date(
            `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}T${ddmmyyyy[4]}:${ddmmyyyy[5]}:${ddmmyyyy[6]}`
        ).getTime();
    }
    return new Date(uploadTime).getTime() || 0;
}

// ─── Kiểm tra GLH sau ĐKCH ───────────────────────────────────────────────────
function detectGiaoLaiHangAfterDKCH(details: any[]): boolean {
    if (!details || details.length === 0) return false;

    const dkchEntries = details.filter(
        (d: any) =>
            (d.scanTypeName || '').includes('Đăng ký chuyển hoàn') ||
            (d.scanTypeName || '').includes('Đăng ký CH lần 2')
    );
    if (dkchEntries.length === 0) return false;

    const latestDKCHTime = Math.max(
        ...dkchEntries.map((d: any) => parseUploadTime(d.uploadTime))
    );
    if (!latestDKCHTime) return false;

    return details.some(
        (d: any) =>
            (d.scanTypeName || '').includes('Giao lại hàng') &&
            parseUploadTime(d.uploadTime) > latestDKCHTime
    );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function LoadProgressBar({ progress }: { progress: LoadProgress }) {
    const pct     = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    const elapsed = (Date.now() - progress.startedAt) / 1000;
    const rate    = progress.done > 0 ? progress.done / elapsed : 0;
    const etaSec  = rate > 0 ? (progress.total - progress.done) / rate : Infinity;

    return (
        <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-2.5 flex-shrink-0 animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    <span className="text-xs font-bold text-indigo-700">
                        Đang tải dữ liệu... {progress.done}/{progress.total} đơn
                        {progress.failed > 0 && <span className="text-amber-600 ml-1.5">({progress.failed} lỗi)</span>}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-indigo-500 font-semibold">
                    <Clock className="w-3 h-3" />
                    {pct < 100
                        ? <span>Còn lại ~<span className="text-indigo-700">{formatETA(etaSec)}</span></span>
                        : <span className="text-emerald-600">Hoàn tất!</span>
                    }
                    <span className="text-indigo-400">·</span>
                    <span className="text-indigo-700">{pct}%</span>
                </div>
            </div>
            <div className="h-2 bg-indigo-200/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300 ease-out progress-shimmer" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-indigo-400 font-medium">
                    {rate > 0 ? `${rate.toFixed(1)} đơn/s` : "Đang khởi động..."}
                </span>
                <span className="text-[10px] text-indigo-400 font-medium">
                    {progress.total - progress.done > 0 ? `Còn ${progress.total - progress.done} đơn` : "Đang hoàn tất..."}
                </span>
            </div>
        </div>
    );
}

// ─── Tri-state filter (Tất cả / true / false) ─────────────────────────────────
type TriOption = { value: boolean | null; label: string; active: string };

function TriFilter({ value, onChange, options }: {
    value: boolean | null;
    onChange: (v: boolean | null) => void;
    options: TriOption[];
}) {
    return (
        <div className="flex items-center gap-1 border border-indigo-100 rounded-xl px-2.5 py-1.5 bg-white/70 shadow-sm">
            {options.map(opt => (
                <button
                    key={String(opt.value)}
                    onClick={() => onChange(opt.value)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm active:scale-95 ${
                        value === opt.value
                            ? opt.active
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Context & memoized list item ─────────────────────────────────────────────
const SelectedWaybillCtx = React.createContext<string | null>(null);

const StocktakingItem = memo(function StocktakingItem({
                                                          info, onSelect, onHover,
                                                      }: {
    info: BillInfo;
    onSelect: (waybill: string) => void;
    onHover:  (waybill: string) => void;
}) {
    const selectedWaybill = React.useContext(SelectedWaybillCtx);
    const isSelected = selectedWaybill === info.waybill;

    return (
        <div
            onClick={() => onSelect(info.waybill)}
            onMouseEnter={() => onHover(info.waybill)}
            className={`rounded-xl border cursor-pointer transition-all duration-200 py-2.5 relative overflow-hidden ${
                isSelected
                    ? 'bg-indigo-50 border-indigo-300 shadow-sm pl-4 pr-3'
                    : `${info.groupColor || 'bg-slate-50 border-slate-200'} hover:shadow-sm px-3`
            }`}
        >
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
            <div className={`text-center font-mono font-bold text-xs ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                {info.waybill}
            </div>
            {info.terminalDispatchCode && (
                <div className={`text-center text-xs font-mono mt-1 truncate select-none ${isSelected ? 'text-indigo-400' : 'text-blue-500'}`}>
                    {info.terminalDispatchCode}
                </div>
            )}
        </div>
    );
});

// ─── Domain helpers ───────────────────────────────────────────────────────────
function isStocktakingEvent(scanTypeName: string): boolean {
    const lower = (scanTypeName || "").toLowerCase();
    return STOCKTAKING_KEYWORDS.some(kw => lower.includes(kw));
}

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseTerminalCode(code: string) {
    const parts = code.split('-');
    return parts.length >= 3 ? { level1: parts[1], level2: parts[2] } : { level1: '', level2: '' };
}

function assignGroupColors(bills: { terminalDispatchCode: string }[]): Map<string, string> {
    const colorMap = new Map<string, string>();
    let colorIndex = 0;
    bills.forEach(({ terminalDispatchCode }) => {
        const { level1, level2 } = parseTerminalCode(terminalDispatchCode);
        const key = `${level1}-${level2}`;
        if (!colorMap.has(key)) { colorMap.set(key, GROUP_COLORS[colorIndex % GROUP_COLORS.length]); colorIndex++; }
    });
    return colorMap;
}

function pickValidTrackingEntry(details: any[]): { scanTypeName: string; scanNetworkCode: string; scanTime: string } {
    const entry = details.find((d: any) => d?.scanTypeName && d.scanTypeName !== EXCLUDED_SCAN_TYPE);
    return {
        scanTypeName:    entry?.scanTypeName    || 'Không có trạng thái',
        scanNetworkCode: entry?.scanNetworkCode || '',
        scanTime:        entry?.scanTime        || '',
    };
}

// Mã BC của đơn = segment 2 của terminalDispatchCode, bỏ tiền tố chữ (vd: "S028W04" -> "028W04")
function getOrderNetworkCode(terminalDispatchCode: string): string {
    const segments = (terminalDispatchCode || '').split('-');
    return (segments[1] || '').replace(/^[A-Za-z]+/, '');
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function StocktakingCheckSection({ bills, authToken, selectedDate, onDateChange }: StocktakingCheckSectionProps) {
    const [billsInfo, setBillsInfo]             = useState<BillInfo[]>([]);
    const [isLoading, setIsLoading]             = useState(false);
    const [loadProgress, setLoadProgress]       = useState<LoadProgress | null>(null);
    const [selectedWaybill, setSelectedWaybill] = useState<string | null>(null);
    const [copied, setCopied]                   = useState(false);
    const [sortMode, setSortMode]               = useState<SortMode>("default");

    // ── Mã BC hiện tại (đọc từ localStorage, đồng bộ với trang Home) ──────────
    const [networkCode, setNetworkCode] = useState<string>(DEFAULT_NETWORK_CODE);

    // ── Filters ────────────────────────────────────────────────────────────────
    const [filterStocktaking, setFilterStocktaking]       = useState<"all" | "checked" | "not_checked">("all");
    const [selectedLastStatuses, setSelectedLastStatuses] = useState<string[]>([]);
    const [searchQuery, setSearchQuery]                   = useState("");
    const [selectedScanners, setSelectedScanners]         = useState<string[]>([]);
    const [selectedDispatchCode, setSelectedDispatchCode] = useState<string>("");

    const [showNetworkCode, setShowNetworkCode]           = useState(true);
    const [showNonNetworkCode, setShowNonNetworkCode]     = useState(true);
    const [showTraditional, setShowTraditional]           = useState(true);
    const [showEcommerce, setShowEcommerce]               = useState(true);

    // null = tất cả, true = có, false = không
    const [returnTransferFilter, setReturnTransferFilter]     = useState<boolean | null>(null);
    const [returnRegisteredFilter, setReturnRegisteredFilter] = useState<boolean | null>(null);
    const [dispatchedTodayFilter, setDispatchedTodayFilter]   = useState<boolean | null>(null);
    const [giaoLaiHangFilter, setGiaoLaiHangFilter]           = useState<boolean | null>(null);

    // ── Cache & transition ─────────────────────────────────────────────────────
    const detailCacheRef                        = useRef<Map<string, DetailCache>>(new Map());
    const [contentKey, setContentKey]           = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const today = toDateStr(new Date());

    // ── Đọc Mã BC đã lưu + đồng bộ giữa các tab ───────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem(NETWORK_CODE_STORAGE_KEY);
        if (saved) setNetworkCode(extractNetworkCode(saved));

        const handleStorage = (e: StorageEvent) => {
            if (e.key === NETWORK_CODE_STORAGE_KEY && e.newValue) {
                setNetworkCode(extractNetworkCode(e.newValue));
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // ── Date navigation ────────────────────────────────────────────────────────
    const shiftDay = (delta: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + delta);
        onDateChange(toDateStr(d));
    };

    // ── Computed ───────────────────────────────────────────────────────────────
    const hasFilterData = useMemo(
        () => billsInfo.some(b => b.stocktakingStatus !== "loading"),
        [billsInfo]
    );

    const allLastStatuses = useMemo(
        () => Array.from(new Set(
            billsInfo
                .filter(b => b.stocktakingStatus === "not_checked")
                .map(b => b.latestScanTypeName)
                .filter(Boolean)
        )),
        [billsInfo]
    );

    const availableScanners = useMemo(
        () => Array.from(new Set(billsInfo.map(b => b.lastIssueScanner).filter(Boolean))).sort(),
        [billsInfo]
    );

    const availableDispatchCodes = useMemo(
        () => Array.from(new Set(billsInfo.map(b => b.terminalDispatchCode).filter(Boolean))).sort(),
        [billsInfo]
    );

    const baseFiltered = useMemo(() => billsInfo.filter(b => {
        if (searchQuery && !b.waybill.includes(searchQuery.trim())) return false;
        if (filterStocktaking === "checked"     && b.stocktakingStatus !== "checked")     return false;
        if (filterStocktaking === "not_checked" && b.stocktakingStatus !== "not_checked") return false;
        if (
            b.stocktakingStatus === "not_checked" &&
            selectedLastStatuses.length > 0 &&
            selectedLastStatuses.length < allLastStatuses.length &&
            !selectedLastStatuses.includes(b.latestScanTypeName)
        ) return false;

        // Lọc theo Mã BC
        const isNetworkCode = getOrderNetworkCode(b.terminalDispatchCode).toUpperCase() === networkCode.toUpperCase();
        if (isNetworkCode && !showNetworkCode) return false;
        if (!isNetworkCode && !showNonNetworkCode) return false;

        // Lọc theo loại đơn
        const isTraditional = isTraditionalOrder(b.waybill);
        if (isTraditional && !showTraditional) return false;
        if (!isTraditional && !showEcommerce) return false;

        if (selectedScanners.length > 0 && !selectedScanners.includes(b.lastIssueScanner)) return false;
        if (selectedDispatchCode && b.terminalDispatchCode !== selectedDispatchCode) return false;
        if (returnTransferFilter !== null && b.hasReturnTransfer !== returnTransferFilter) return false;
        if (returnRegisteredFilter !== null && b.hasReturnRegistered !== returnRegisteredFilter) return false;
        if (dispatchedTodayFilter !== null && b.hasDispatchedToday !== dispatchedTodayFilter) return false;
        if (giaoLaiHangFilter !== null && b.hasGiaoLaiHang !== giaoLaiHangFilter) return false;
        return true;
    }), [
        billsInfo, filterStocktaking, selectedLastStatuses, searchQuery, allLastStatuses,
        networkCode, showNetworkCode, showNonNetworkCode, showTraditional, showEcommerce,
        selectedScanners, selectedDispatchCode,
        returnTransferFilter, returnRegisteredFilter, dispatchedTodayFilter, giaoLaiHangFilter,
    ]);

    const filtered = useMemo(() => {
        if (sortMode === "default") return baseFiltered;
        const getParts = (code: string) => {
            const parts = (code || "").split('-');
            return { p1: parts[0]||"", p2: parts[1]||"", p3: parts[2]||"" };
        };
        const p2Count = new Map<string, number>();
        baseFiltered.forEach(b => {
            const { p2 } = getParts(b.terminalDispatchCode);
            if (p2) p2Count.set(p2, (p2Count.get(p2) || 0) + 1);
        });
        let mainP2 = ""; let maxCount = 0;
        p2Count.forEach((count, p2) => { if (count > maxCount) { maxCount = count; mainP2 = p2; } });

        return [...baseFiltered].sort((a, b) => {
            const pa = getParts(a.terminalDispatchCode);
            const pb = getParts(b.terminalDispatchCode);
            const aIsMain = pa.p2 === mainP2, bIsMain = pb.p2 === mainP2;
            if (sortMode === "dispatch_asc") {
                if (aIsMain && !bIsMain) return -1;
                if (!aIsMain && bIsMain) return 1;
                if (pa.p2 === pb.p2) return pa.p3.localeCompare(pb.p3, undefined, { numeric: true });
                return pa.p2.localeCompare(pb.p2) || pa.p3.localeCompare(pb.p3, undefined, { numeric: true });
            } else {
                if (aIsMain && !bIsMain) return 1;
                if (!aIsMain && bIsMain) return -1;
                if (pa.p2 === pb.p2) return pb.p3.localeCompare(pa.p3, undefined, { numeric: true });
                return pb.p2.localeCompare(pa.p2) || pb.p3.localeCompare(pa.p3, undefined, { numeric: true });
            }
        });
    }, [baseFiltered, sortMode]);

    const deferredFiltered = useDeferredValue(filtered);

    const checkedCount    = billsInfo.filter(b => b.stocktakingStatus === "checked").length;
    const notCheckedCount = billsInfo.filter(b => b.stocktakingStatus === "not_checked").length;

    // ── Effects ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authToken || !bills.length) return;
        loadData();
    }, [authToken, bills]);

    useEffect(() => {
        if (allLastStatuses.length > 0 && selectedLastStatuses.length === 0)
            setSelectedLastStatuses([...allLastStatuses]);
    }, [allLastStatuses]);

    // Bỏ chọn nếu vận đơn đang chọn không còn trong danh sách sau khi lọc
    useEffect(() => {
        if (!selectedWaybill || !hasFilterData) return;
        if (!filtered.some(b => b.waybill === selectedWaybill)) setSelectedWaybill(null);
    }, [filtered, selectedWaybill, hasFilterData]);

    // ── Load data — batch + retry + progress ───────────────────────────────────
    const loadData = async () => {
        setIsLoading(true);
        setSelectedWaybill(null);
        detailCacheRef.current.clear();

        const startedAt = Date.now();
        setLoadProgress({ total: bills.length, done: 0, failed: 0, startedAt });

        setBillsInfo(bills.map(w => ({
            waybill: w, terminalDispatchCode: '', groupLevel1: '', groupLevel2: '', groupColor: '',
            stocktakingStatus: "loading",
            latestScanTypeName: "", latestScanTime: "", latestScanNetworkCode: "",
            stocktakingTime: "", stocktakingNetworkCode: "",
            lastIssueScanner: "",
            hasReturnTransfer: false,
            hasReturnRegistered: false,
            hasDispatchedToday: false,
            hasGiaoLaiHang: false,
        })));

        const dateStart = `${selectedDate} 00:00:00`;
        const dateEnd   = `${selectedDate} 23:59:59`;
        const rawResults: BillInfo[] = [];

        await runInBatches(
            bills,
            async (waybill) => {
                try {
                    const [orderResp, trackingResp, issueResp]: [any, any, any] = await withRetry(() =>
                        Promise.all([
                            axios.post(
                                "https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                                { waybillNo: waybill, countryId: "1" },
                                { headers: { authToken, lang: "VN", langType: "VN" } }
                            ),
                            axios.post(
                                "https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                                { keywordList: [waybill], trackingTypeEnum: "WAYBILL", countryId: "1" },
                                { headers: { authToken, lang: "VN", langType: "VN" } }
                            ),
                            axios.post(
                                "https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
                                { current: 1, size: 100, waybillId: waybill, countryId: "1" },
                                { headers: { authToken, lang: "VN", langType: "VN" } }
                            ),
                        ])
                    );

                    const terminalDispatchCode = orderResp.data?.data?.details?.terminalDispatchCode || '';
                    const details: any[]       = trackingResp.data?.data?.[0]?.details || [];
                    const allScanTypes: string[] = details.map((d: any) => d.scanTypeName || '');

                    // Kiểm tra kiểm tồn trong ngày được chọn
                    const todayStocktaking = details.find(d =>
                        d.scanTime >= dateStart && d.scanTime <= dateEnd && isStocktakingEvent(d.scanTypeName)
                    );

                    // Trạng thái thực gần nhất (bỏ qua cuộc gọi-phát)
                    const { scanTypeName, scanNetworkCode, scanTime } = pickValidTrackingEntry(details);

                    // Đang chuyển hoàn = đã duyệt hoàn
                    const hasReturnTransfer   = allScanTypes.some(s => s.includes('Đang chuyển hoàn'));
                    // Đăng ký chuyển hoàn = mới đăng ký, chưa duyệt
                    const hasReturnRegistered = allScanTypes.some(s => s.includes('Đăng ký chuyển hoàn'));

                    // Đã quét phát hàng trong ngày hôm nay (xuất kho)
                    const hasDispatchedToday = details.some(
                        (d: any) =>
                            (d.scanTypeName || '').includes('Quét phát hàng') &&
                            isScanToday(d.scanTime)
                    );

                    // Có Giao lại hàng sau lần ĐKCH gần nhất
                    const hasGiaoLaiHang = detectGiaoLaiHangAfterDKCH(details);

                    // Người quét kiện vấn đề gần nhất
                    const issueRecords: any[] = issueResp.data?.data?.records ?? [];
                    const lastIssue           = issueRecords[0];
                    const lastIssueScanner    = lastIssue?.operatorName || lastIssue?.scanUserName || '';

                    // Pre-cache (sẽ bị xóa khi click → fetch fresh)
                    detailCacheRef.current.set(waybill, {
                        orderDetail: orderResp.data?.data?.details ?? null,
                        podHistory: [...details].reverse(),
                        issueHistory: issueRecords,
                    });

                    rawResults.push({
                        waybill, terminalDispatchCode,
                        groupLevel1: '', groupLevel2: '', groupColor: '',
                        stocktakingStatus: todayStocktaking ? "checked" : "not_checked",
                        latestScanTypeName:     scanTypeName,
                        latestScanTime:         scanTime,
                        latestScanNetworkCode:  scanNetworkCode,
                        stocktakingTime:        todayStocktaking?.scanTime        || "",
                        stocktakingNetworkCode: todayStocktaking?.scanNetworkCode || "",
                        lastIssueScanner,
                        hasReturnTransfer,
                        hasReturnRegistered,
                        hasDispatchedToday,
                        hasGiaoLaiHang,
                    });
                } catch {
                    rawResults.push({
                        waybill, terminalDispatchCode: '',
                        groupLevel1: '', groupLevel2: '', groupColor: '',
                        stocktakingStatus: "error",
                        latestScanTypeName: "Lỗi tải dữ liệu",
                        latestScanTime: "", latestScanNetworkCode: "",
                        stocktakingTime: "", stocktakingNetworkCode: "",
                        lastIssueScanner: "",
                        hasReturnTransfer: false,
                        hasReturnRegistered: false,
                        hasDispatchedToday: false,
                        hasGiaoLaiHang: false,
                    });
                    throw new Error("load failed");
                }
            },
            (done, failed) => {
                setLoadProgress({ total: bills.length, done, failed, startedAt });
            },
            BATCH_SIZE,
        );

        // Gán màu nhóm
        const colorMap = assignGroupColors(rawResults);
        const results = rawResults.map(r => {
            const { level1, level2 } = parseTerminalCode(r.terminalDispatchCode);
            return { ...r, groupLevel1: level1, groupLevel2: level2, groupColor: colorMap.get(`${level1}-${level2}`) || 'bg-slate-50 border-slate-200' };
        });

        // Reset các filter khi load lại
        setSelectedScanners([]);
        setSelectedDispatchCode("");
        setReturnTransferFilter(null);
        setReturnRegisteredFilter(null);
        setDispatchedTodayFilter(null);
        setGiaoLaiHangFilter(null);
        setShowTraditional(true);
        setShowEcommerce(true);

        setBillsInfo(results);
        setTimeout(() => { setLoadProgress(null); setIsLoading(false); }, 1200);
    };

    // ── Prefetch đầy đủ (order + pod + issue) khi hover ───────────────────────
    const prefetchDetail = useCallback(async (waybill: string) => {
        if (detailCacheRef.current.has(waybill)) return;
        try {
            const [orderResp, podResp, issueResp]: [any, any, any] = await Promise.all([
                axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                    { waybillNo: waybill, countryId: "1" },
                    { headers: { authToken, lang: 'VN', langType: 'VN' } }
                ),
                axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                    { keywordList: [waybill], trackingTypeEnum: "WAYBILL", countryId: "1" },
                    { headers: { authToken, lang: 'VN', langType: 'VN' } }
                ),
                axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
                    { current: 1, size: 100, waybillId: waybill, countryId: "1" },
                    { headers: { authToken, lang: 'VN', langType: 'VN' } }
                ),
            ]);
            detailCacheRef.current.set(waybill, {
                orderDetail: orderResp.data?.data?.details ?? {},
                podHistory: (podResp.data?.data?.[0]?.details ?? []).reverse(),
                issueHistory: issueResp.data?.data?.records ?? [],
            });
        } catch { }
    }, [authToken]);

    // ── Select waybill — xóa cache cũ, fetch fresh rồi mới render ────────────
    const selectedWaybillRef = useRef(selectedWaybill);
    useEffect(() => { selectedWaybillRef.current = selectedWaybill; }, [selectedWaybill]);

    const handleSelectWaybill = useCallback(async (waybill: string) => {
        if (waybill === selectedWaybillRef.current) return;
        setIsTransitioning(true);
        detailCacheRef.current.delete(waybill);
        await prefetchDetail(waybill);
        setSelectedWaybill(waybill);
        setContentKey(k => k + 1);
        setIsTransitioning(false);
    }, [prefetchDetail]);

    // ── Copy ───────────────────────────────────────────────────────────────────
    const handleCopyFiltered = () => {
        navigator.clipboard.writeText(filtered.map(b => b.waybill).join("\n")).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // ── Sort ───────────────────────────────────────────────────────────────────
    const cycleSortMode = () => setSortMode(prev =>
        prev === "default" ? "dispatch_asc" : prev === "dispatch_asc" ? "dispatch_desc" : "default"
    );
    const sortLabel = sortMode === "dispatch_asc" ? "Mã đoạn ↑" : sortMode === "dispatch_desc" ? "Mã đoạn ↓" : "Mặc định";

    // ── Reset all filters ──────────────────────────────────────────────────────
    const clearFilters = () => {
        setFilterStocktaking("all");
        setSelectedLastStatuses([...allLastStatuses]);
        setSearchQuery("");
        setSelectedScanners([]);
        setSelectedDispatchCode("");
        setShowNetworkCode(true);
        setShowNonNetworkCode(true);
        setShowTraditional(true);
        setShowEcommerce(true);
        setReturnTransferFilter(null);
        setReturnRegisteredFilter(null);
        setDispatchedTodayFilter(null);
        setGiaoLaiHangFilter(null);
        setSortMode("default");
    };

    const toggleBtn = (active: boolean, activeCls: string, hoverCls: string, bold = false) =>
        `whitespace-nowrap px-2 py-0.5 rounded-lg text-[11px] ${bold ? 'font-bold' : 'font-semibold'} border transition-all duration-200 hover:shadow-sm active:scale-95 ${
            active ? activeCls : `bg-white border-slate-200 text-slate-400 ${hoverCls}`
        }`;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <FontLoader />
            <div className="h-screen bg-slate-50 flex flex-col overflow-hidden text-[13px]">

                {/* ── Top bar ── */}
                <header className="bg-white border-b border-slate-200 flex-shrink-0 px-5 h-14 flex items-center gap-4">
                    {/* Left: back / title / date nav */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors font-semibold text-xs"
                        >
                            <ArrowLeft className="w-4 h-4" />Quay lại
                        </button>
                        <div className="w-px h-5 bg-slate-200" />
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <span className="font-bold text-slate-800">Kiểm tra tồn kho</span>
                        </div>
                        <div className="w-px h-5 bg-slate-200" />
                        {/* Date navigation */}
                        <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <button onClick={() => shiftDay(-1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all">
                                <ChevronLeft className="w-3 h-3" />
                            </button>
                            <input type="date" value={selectedDate} max={today}
                                   onChange={e => { if (e.target.value) onDateChange(e.target.value); }}
                                   className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 text-slate-700 cursor-pointer transition-all"
                            />
                            <button onClick={() => shiftDay(1)} disabled={selectedDate >= today}
                                    className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronRight className="w-3 h-3" />
                            </button>
                            {selectedDate !== today && (
                                <button onClick={() => onDateChange(today)}
                                        className="px-2 py-1 text-[11px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-all">
                                    Hôm nay
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Middle: search + stocktaking status filter */}
                    <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                   placeholder="Tìm mã vận đơn..."
                                   className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 transition-all w-48"
                            />
                        </div>

                        <div className="flex items-center gap-1.5">
                            {(["all", "checked", "not_checked"] as const).map(v => (
                                <button key={v} onClick={() => setFilterStocktaking(v)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                                            filterStocktaking === v
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
                                        }`}>
                                    {v === "all" ? "Tất cả" : v === "checked" ? "✓ Đã kiểm" : "✗ Chưa kiểm"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: stats / refresh */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />{checkedCount} đã kiểm
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <XCircle className="w-3.5 h-3.5" />{notCheckedCount} chưa kiểm
                        </span>
                        <span className="text-xs text-slate-500 font-semibold border border-slate-200 px-2.5 py-1 rounded-full bg-slate-50">
                            {hasFilterData ? `${filtered.length} / ${bills.length}` : bills.length} đơn
                        </span>
                        {isLoading && !loadProgress && (
                            <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                        )}
                        <button onClick={loadData} disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-xs transition-all disabled:opacity-40">
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            Làm mới
                        </button>
                    </div>
                </header>

                {/* ── Progress bar ── */}
                {loadProgress && <LoadProgressBar progress={loadProgress} />}

                {/* ── Filter bar ── */}
                {hasFilterData && (
                    <div className="bg-indigo-50/60 border-b border-indigo-100 px-5 py-2 flex-shrink-0 flex flex-col gap-2">

                        {/* Hàng 1: Trạng thái cuối — chỉ khi không filter "đã kiểm" */}
                        {filterStocktaking !== "checked" && allLastStatuses.length > 0 && (
                            <div className="flex items-center gap-1 border border-indigo-100 rounded-xl px-2.5 py-1.5 bg-white/70 shadow-sm">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                                    <button
                                        onClick={() => setSelectedLastStatuses(
                                            selectedLastStatuses.length < allLastStatuses.length ? [...allLastStatuses] : []
                                        )}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all duration-200 hover:shadow-sm active:scale-95 ${
                                            selectedLastStatuses.length === allLastStatuses.length
                                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
                                        }`}
                                    >
                                        Tất cả
                                    </button>
                                    {allLastStatuses.map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setSelectedLastStatuses(prev =>
                                                prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                                            )}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm active:scale-95 ${
                                                selectedLastStatuses.includes(status)
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                                            }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Hàng 2: Loại đơn + Mã BC + Mã đoạn + Người quét KVĐ */}
                        <div className="flex flex-wrap items-stretch gap-2">
                            <div className="flex items-center gap-2 border-2 border-slate-200 rounded-xl px-2 py-1 bg-slate-50 shadow-sm">
                                <button
                                    onClick={() => setShowTraditional(!showTraditional)}
                                    className={toggleBtn(showTraditional, 'bg-teal-100 text-teal-800 border-teal-200', 'hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700', true)}
                                >
                                    TRUYỀN THỐNG
                                </button>
                                <button
                                    onClick={() => setShowEcommerce(!showEcommerce)}
                                    className={toggleBtn(showEcommerce, 'bg-blue-100 text-blue-800 border-blue-200', 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700', true)}
                                >
                                    ĐƠN SÀN
                                </button>
                                <div className="w-px h-4 bg-slate-300" />
                                <button
                                    onClick={() => setShowNetworkCode(!showNetworkCode)}
                                    className={toggleBtn(showNetworkCode, 'bg-teal-100 text-teal-800 border-teal-200', 'hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700')}
                                >
                                    {networkCode}
                                </button>
                                <button
                                    onClick={() => setShowNonNetworkCode(!showNonNetworkCode)}
                                    className={toggleBtn(showNonNetworkCode, 'bg-teal-100 text-teal-800 border-teal-200', 'hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700')}
                                >
                                    Khác
                                </button>

                                {/* Mã đoạn */}
                                {availableDispatchCodes.length > 0 && (<>
                                    <div className="w-px h-4 bg-slate-300" />
                                    <div className="flex items-center gap-0.5">
                                        <select
                                            value={selectedDispatchCode}
                                            onChange={e => setSelectedDispatchCode(e.target.value)}
                                            className={`text-[11px] font-semibold border rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-200 transition-all cursor-pointer ${
                                                selectedDispatchCode
                                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                                    : 'bg-white border-slate-200 text-slate-600'
                                            }`}
                                        >
                                            <option value="">MÃ ĐOẠN ({availableDispatchCodes.length})</option>
                                            {availableDispatchCodes.map(code => (
                                                <option key={code} value={code}>{code}</option>
                                            ))}
                                        </select>
                                        {selectedDispatchCode && (
                                            <button onClick={() => setSelectedDispatchCode("")}
                                                    className="text-amber-400 hover:text-amber-600 transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </>)}

                                {/* Người quét KVĐ */}
                                {availableScanners.length > 0 && (<>
                                    <div className="w-px h-4 bg-slate-300" />
                                    <div className="flex items-center gap-0.5">
                                        <select
                                            value={selectedScanners[0] ?? ""}
                                            onChange={e => setSelectedScanners(e.target.value ? [e.target.value] : [])}
                                            className={`text-[11px] font-semibold border rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-200 transition-all cursor-pointer ${
                                                selectedScanners.length > 0
                                                    ? 'bg-teal-50 border-teal-200 text-teal-800'
                                                    : 'bg-white border-slate-200 text-slate-600'
                                            }`}
                                        >
                                            <option value="">NGƯỜI QUÉT KVĐ ({availableScanners.length})</option>
                                            {availableScanners.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                        {selectedScanners.length > 0 && (
                                            <button onClick={() => setSelectedScanners([])}
                                                    className="text-teal-400 hover:text-teal-600 transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </>)}
                            </div>

                            {/* Chuyển hoàn */}
                            <TriFilter
                                value={returnTransferFilter}
                                onChange={setReturnTransferFilter}
                                options={[
                                    { value: null,  label: 'Tất cả',           active: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                                    { value: true,  label: 'Đã chuyển hoàn',   active: 'bg-rose-100 text-rose-800 border-rose-200' },
                                    { value: false, label: 'Chưa chuyển hoàn', active: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                                ]}
                            />

                            {/* Đăng ký hoàn */}
                            <TriFilter
                                value={returnRegisteredFilter}
                                onChange={setReturnRegisteredFilter}
                                options={[
                                    { value: null,  label: 'Tất cả',     active: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                                    { value: true,  label: 'Đã ĐKCH',    active: 'bg-amber-100 text-amber-800 border-amber-200' },
                                    { value: false, label: 'Chưa ĐKCH',  active: 'bg-slate-200 text-slate-700 border-slate-300' },
                                ]}
                            />

                            {/* Xuất kho */}
                            <TriFilter
                                value={dispatchedTodayFilter}
                                onChange={setDispatchedTodayFilter}
                                options={[
                                    { value: null,  label: 'Tất cả',        active: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                                    { value: true,  label: 'Đã xuất kho',   active: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                                    { value: false, label: 'Chưa xuất kho', active: 'bg-amber-100 text-amber-800 border-amber-200' },
                                ]}
                            />

                            {/* Giao lại hàng sau ĐKCH */}
                            <TriFilter
                                value={giaoLaiHangFilter}
                                onChange={setGiaoLaiHangFilter}
                                options={[
                                    { value: null,  label: 'Tất cả',                active: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                                    { value: true,  label: 'Đã có GLH sau ĐKCH',    active: 'bg-violet-100 text-violet-800 border-violet-200' },
                                    { value: false, label: 'Chưa có GLH sau ĐKCH',  active: 'bg-orange-100 text-orange-800 border-orange-200' },
                                ]}
                            />

                            {/* Reset */}
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95 ml-auto self-stretch shadow-sm"
                            >
                                <RotateCcw className="w-3 h-3" />Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Sidebar ── */}
                    <div className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0 gap-2">
                            <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                Danh sách
                                {isLoading && !loadProgress && (
                                    <span className="inline-block w-3 h-3 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                                )}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button onClick={cycleSortMode} title="Sắp xếp theo mã đoạn"
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                            sortMode !== "default"
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                                                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                                        }`}>
                                    <ArrowUpDown className="w-3 h-3" />{sortLabel}
                                </button>
                                <button onClick={handleCopyFiltered} disabled={filtered.length === 0}
                                        title="Copy tất cả mã vận đơn"
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            copied
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
                                        }`}>
                                    {copied
                                        ? <><Check className="w-3 h-3" />Copied!</>
                                        : <><Copy className="w-3 h-3" />({filtered.length})</>
                                    }
                                </button>
                            </div>
                        </div>

                        <SelectedWaybillCtx.Provider value={selectedWaybill}>
                            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                                {deferredFiltered.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <Package className="w-10 h-10 text-slate-200 mb-3" />
                                        <p className="text-sm font-semibold text-slate-400">
                                            {isLoading ? "Đang tải dữ liệu..." : "Không có vận đơn nào"}
                                        </p>
                                    </div>
                                ) : deferredFiltered.map(info => (
                                    <StocktakingItem
                                        key={info.waybill}
                                        info={info}
                                        onSelect={handleSelectWaybill}
                                        onHover={prefetchDetail}
                                    />
                                ))}
                            </div>
                        </SelectedWaybillCtx.Provider>
                    </div>

                    {/* ── Main content ── */}
                    <div className="flex-1 flex overflow-hidden">
                        {!selectedWaybill ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Warehouse className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-500">
                                    {isLoading ? "Đang tải dữ liệu..." : "Chọn một vận đơn để xem chi tiết"}
                                </p>
                                {!isLoading && filtered.length > 0 && (
                                    <p className="text-xs text-slate-400 mt-1">Có {filtered.length} vận đơn trong danh sách</p>
                                )}
                            </div>
                        ) : (
                            <div key={contentKey}
                                 className={`flex flex-1 overflow-hidden transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100 content-fade'}`}>
                                <div className="max-w-[340px] overflow-y-auto border-r border-slate-200">
                                    <OrderDetail waybill={selectedWaybill} authToken={authToken}
                                                 cache={detailCacheRef.current.get(selectedWaybill)} />
                                </div>
                                <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                                    <div className="flex-[2] min-h-0">
                                        <PodHistory waybill={selectedWaybill} authToken={authToken}
                                                    cache={detailCacheRef.current.get(selectedWaybill)}
                                                    networkCode={networkCode} />
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <IssueHistory waybill={selectedWaybill} authToken={authToken}
                                                      cache={detailCacheRef.current.get(selectedWaybill)} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="text-center text-xs text-slate-300 py-2 border-t border-slate-100 bg-white flex-shrink-0">
                    JT Express Internal Tool · {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
}