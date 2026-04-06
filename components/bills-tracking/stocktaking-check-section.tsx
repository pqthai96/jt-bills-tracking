"use client";

import React, {
    useEffect, useState, useMemo, useRef, useCallback, useDeferredValue, memo,
} from "react";
import axios from "axios";
import {
    Search, Package, Filter, RotateCcw, ArrowLeft,
    Warehouse, CheckCircle2, XCircle, Clock,
    RefreshCw, AlertTriangle, BadgeCheck, Copy, Check,
    CalendarDays, ChevronLeft, ChevronRight, ArrowUpDown, User, X,
} from "lucide-react";
import OrderDetail from "@/components/bills-tracking/order-detail";
import PodHistory from "@/components/bills-tracking/pod-history";
import IssueHistory from "@/components/bills-tracking/issue-history";
import { DetailCache } from "@/components/bills-tracking/bills-tracking-section";

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
    lastIssueScanner: string; // người "Quét kiện vấn đề" gần nhất
}

// ─── Progress state ───────────────────────────────────────────────────────────
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

// ─── Memoized list item ───────────────────────────────────────────────────────
// Dùng Context thay vì prop isSelected → chỉ 2 item re-render mỗi lần đổi selection
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
                <div className={`text-center text-xs font-mono mt-1 truncate ${isSelected ? 'text-indigo-400' : 'text-blue-500'}`}>
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

// ─── Main Component ────────────────────────────────────────────────────────────
export default function StocktakingCheckSection({ bills, authToken, selectedDate, onDateChange }: StocktakingCheckSectionProps) {
    const [billsInfo, setBillsInfo]             = useState<BillInfo[]>([]);
    const [isLoading, setIsLoading]             = useState(false);
    const [loadProgress, setLoadProgress]       = useState<LoadProgress | null>(null);
    const [selectedWaybill, setSelectedWaybill] = useState<string | null>(null);
    const [copied, setCopied]                   = useState(false);
    const [sortMode, setSortMode]               = useState<SortMode>("default");

    // ── Filters ────────────────────────────────────────────────────────────────
    const [filterStocktaking, setFilterStocktaking]       = useState<"all" | "checked" | "not_checked">("all");
    const [selectedLastStatuses, setSelectedLastStatuses] = useState<string[]>([]);
    const [searchQuery, setSearchQuery]                   = useState("");
    const [availableScanners, setAvailableScanners]       = useState<string[]>([]);
    const [selectedScanners, setSelectedScanners]         = useState<string[]>([]); // [] = tất cả

    // ── Cache & transition ─────────────────────────────────────────────────────
    const detailCacheRef                        = useRef<Map<string, DetailCache>>(new Map());
    const [contentKey, setContentKey]           = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const today = toDateStr(new Date());

    // ── Date navigation ────────────────────────────────────────────────────────
    const shiftDay = (delta: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + delta);
        onDateChange(toDateStr(d));
    };

    // ── Computed ───────────────────────────────────────────────────────────────
    const allLastStatuses = useMemo(
        () => Array.from(new Set(
            billsInfo
                .filter(b => b.stocktakingStatus === "not_checked")
                .map(b => b.latestScanTypeName)
                .filter(Boolean)
        )),
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
        // Lọc theo người quét kiện vấn đề
        if (selectedScanners.length > 0 && !selectedScanners.includes(b.lastIssueScanner)) return false;
        return true;
    }), [billsInfo, filterStocktaking, selectedLastStatuses, searchQuery, allLastStatuses, selectedScanners]);

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

    // useDeferredValue: list render priority thấp → UI luôn responsive
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

    // ── Load data — batch + retry + progress ───────────────────────────────────
    const loadData = async () => {
        setIsLoading(true);
        setSelectedWaybill(null);
        detailCacheRef.current.clear();

        const startedAt = Date.now();
        setLoadProgress({ total: bills.length, done: 0, failed: 0, startedAt });

        // Init placeholder "loading" cho từng đơn
        setBillsInfo(bills.map(w => ({
            waybill: w, terminalDispatchCode: '', groupLevel1: '', groupLevel2: '', groupColor: '',
            stocktakingStatus: "loading",
            latestScanTypeName: "", latestScanTime: "", latestScanNetworkCode: "",
            stocktakingTime: "", stocktakingNetworkCode: "", lastIssueScanner: "",
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

                    // Kiểm tra kiểm tồn trong ngày được chọn
                    const todayStocktaking = details.find(d =>
                        d.scanTime >= dateStart && d.scanTime <= dateEnd && isStocktakingEvent(d.scanTypeName)
                    );

                    // Trạng thái thực gần nhất (bỏ qua cuộc gọi-phát)
                    const { scanTypeName, scanNetworkCode, scanTime } = pickValidTrackingEntry(details);

                    // Người quét kiện vấn đề gần nhất
                    const issueRecords: any[] = issueResp.data?.data?.records ?? [];
                    const lastIssue = issueRecords[0];
                    const lastIssueScanner = lastIssue?.operatorName || lastIssue?.scanUserName || '';

                    // Pre-cache để click vào không cần fetch lại
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

        // Build danh sách người quét kiện vấn đề
        const scanners = Array.from(new Set(results.map(r => r.lastIssueScanner).filter(Boolean))).sort();
        setAvailableScanners(scanners);
        setSelectedScanners([]);

        setBillsInfo(results);

        setTimeout(() => { setLoadProgress(null); setIsLoading(false); }, 1200);
    };

    // ── Select waybill — stable callback, dùng ref cho selectedWaybill ────────
    const selectedWaybillRef = useRef(selectedWaybill);
    useEffect(() => { selectedWaybillRef.current = selectedWaybill; }, [selectedWaybill]);

    const handleSelectWaybill = useCallback(async (waybill: string) => {
        if (waybill === selectedWaybillRef.current) return;
        setIsTransitioning(true);
        // Nếu cache thiếu issueHistory thì fetch thêm
        const existing = detailCacheRef.current.get(waybill);
        if (!existing || !existing.issueHistory) {
            try {
                const [orderResp, podResp, issueResp]: [any, any, any] = await Promise.all([
                    axios.post("https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                        { waybillNo: waybill, countryId: "1" }, { headers: { authToken, lang: 'VN', langType: 'VN' } }),
                    axios.post("https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                        { keywordList: [waybill], trackingTypeEnum: "WAYBILL", countryId: "1" }, { headers: { authToken, lang: 'VN', langType: 'VN' } }),
                    axios.post("https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
                        { current: 1, size: 100, waybillId: waybill, countryId: "1" }, { headers: { authToken, lang: 'VN', langType: 'VN' } }),
                ]);
                detailCacheRef.current.set(waybill, {
                    orderDetail: orderResp.data?.data?.details ?? {},
                    podHistory: (podResp.data?.data?.[0]?.details ?? []).reverse(),
                    issueHistory: issueResp.data?.data?.records ?? [],
                });
            } catch { }
        }
        setSelectedWaybill(waybill);
        setContentKey(k => k + 1);
        setIsTransitioning(false);
    }, [authToken]);

    // ── Prefetch khi hover ─────────────────────────────────────────────────────
    const prefetchIssue = useCallback(async (waybill: string) => {
        const existing = detailCacheRef.current.get(waybill);
        if (existing?.issueHistory && existing.issueHistory.length !== 0) return;
        try {
            const resp: any = await axios.post(
                "https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
                { current: 1, size: 100, waybillId: waybill, countryId: "1" },
                { headers: { authToken, lang: "VN", langType: "VN" } }
            );
            const records = resp.data?.data?.records ?? [];
            const prev = detailCacheRef.current.get(waybill) ?? { orderDetail: null, podHistory: [], issueHistory: [] };
            detailCacheRef.current.set(waybill, { ...prev, issueHistory: records });
        } catch { }
    }, [authToken]);

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
        setSortMode("default");
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <FontLoader />
            <div className="h-screen bg-slate-50 flex flex-col overflow-hidden text-[13px]">

                {/* ── Top bar ── */}
                <header className="bg-white border-b border-slate-200 flex-shrink-0 px-5 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
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

                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />{checkedCount} đã kiểm
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <XCircle className="w-3.5 h-3.5" />{notCheckedCount} chưa kiểm
                        </span>
                        <span className="text-xs text-slate-400 font-semibold border border-slate-200 px-2.5 py-1 rounded-full bg-slate-50">
                            {bills.length} đơn
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
                <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex-shrink-0 flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                               placeholder="Tìm mã vận đơn..."
                               className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 transition-all w-48"
                        />
                    </div>

                    <div className="h-5 w-px bg-slate-200" />
                    <Filter className="w-3.5 h-3.5 text-slate-400" />

                    {/* Stocktaking status buttons */}
                    {(["all", "checked", "not_checked"] as const).map(v => (
                        <button key={v} onClick={() => setFilterStocktaking(v)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    filterStocktaking === v
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
                                }`}>
                            {v === "all" ? "Tất cả" : v === "checked" ? "✓ Đã kiểm" : "✗ Chưa kiểm"}
                        </button>
                    ))}

                    {/* Trạng thái cuối — chỉ khi không filter "đã kiểm" */}
                    {filterStocktaking !== "checked" && allLastStatuses.length > 0 && (<>
                        <div className="h-5 w-px bg-slate-200" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trạng thái cuối</span>
                        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-300 cursor-pointer text-xs">
                            <input type="checkbox"
                                   checked={selectedLastStatuses.length === allLastStatuses.length}
                                   onChange={e => setSelectedLastStatuses(e.target.checked ? [...allLastStatuses] : [])}
                                   className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-slate-700">Tất cả</span>
                        </label>
                        {allLastStatuses.map(status => (
                            <label key={status} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-300 cursor-pointer text-xs">
                                <input type="checkbox"
                                       checked={selectedLastStatuses.includes(status)}
                                       onChange={e => setSelectedLastStatuses(prev =>
                                           e.target.checked ? [...prev, status] : prev.filter(s => s !== status)
                                       )}
                                       className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-slate-700">{status}</span>
                            </label>
                        ))}
                    </>)}

                    {/* Người quét kiện vấn đề */}
                    {availableScanners.length > 0 && (<>
                        <div className="h-5 w-px bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người quét vấn đề</span>
                        </div>
                        <select
                            value={selectedScanners[0] ?? ""}
                            onChange={e => setSelectedScanners(e.target.value ? [e.target.value] : [])}
                            className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 transition-all cursor-pointer ${
                                selectedScanners.length > 0
                                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                            }`}
                        >
                            <option value="">Tất cả ({availableScanners.length} người)</option>
                            {availableScanners.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        {selectedScanners.length > 0 && (
                            <button onClick={() => setSelectedScanners([])}
                                    className="text-amber-500 hover:text-amber-700 transition-colors" title="Bỏ lọc">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </>)}

                    <button onClick={clearFilters}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all ml-auto">
                        <RotateCcw className="w-3 h-3" />Reset
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Sidebar ── */}
                    <div className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">

                        {/* Sidebar header */}
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0 gap-2">
                            <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                Danh sách
                                {isLoading && !loadProgress && (
                                    <span className="inline-block w-3 h-3 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                                )}
                                <span className="text-slate-400 font-normal">({filtered.length})</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                {/* Sort */}
                                <button onClick={cycleSortMode} title="Sắp xếp theo mã đoạn"
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                            sortMode !== "default"
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                                                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                                        }`}>
                                    <ArrowUpDown className="w-3 h-3" />{sortLabel}
                                </button>
                                {/* Copy */}
                                <button onClick={handleCopyFiltered} disabled={filtered.length === 0}
                                        title="Copy mã vận đơn"
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            copied
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
                                        }`}>
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>

                        {/* Bills list — memoized items, context-based selection, deferred render */}
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
                                        onHover={prefetchIssue}
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
                                <p className="font-bold text-slate-500">Chọn một vận đơn để xem chi tiết</p>
                                <p className="text-xs text-slate-400 mt-1">{filtered.length} vận đơn trong danh sách</p>
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
                                                    cache={detailCacheRef.current.get(selectedWaybill)} />
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