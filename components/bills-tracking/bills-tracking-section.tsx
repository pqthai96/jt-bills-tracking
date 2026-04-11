"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo, useDeferredValue, memo } from "react";
import OrderDetail from "@/components/bills-tracking/order-detail";
import PodHistory from "@/components/bills-tracking/pod-history";
import IssueHistory from "@/components/bills-tracking/issue-history";
import axios from "axios";
import {
    Search, Package, Filter, RotateCcw, X,
    ArrowLeft, Truck, RefreshCw, Copy, Check, ArrowUpDown,
    Clock, User,
} from "lucide-react";

// ─── Font loader ──────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        body, body * { font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; }
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
                #6d28d9 0%,
                #8b5cf6 40%,
                #a78bfa 50%,
                #8b5cf6 60%,
                #6d28d9 100%
            );
            background-size: 200% auto;
            animation: progress-shimmer 1.8s linear infinite;
        }
    `}</style>
);

interface BillsTrackingSectionProps {
    bills: string[];
    authToken: string;
    isBillTracking: boolean;
}

interface OrderData {
    waybill: string;
    terminalDispatchCode: string;
    scanTypeName: string;
    scanNetworkCode: string;
    lastIssueScanner: string;
    hasReturnTransfer: boolean;
}

interface GroupedOrder {
    waybill: string;
    terminalDispatchCode: string;
    scanTypeName: string;
    groupLevel1: string;
    groupLevel2: string;
    groupColor: string;
}

export interface DetailCache {
    orderDetail: any;
    podHistory: any[];
    issueHistory: any[];
}

interface LoadProgress {
    total: number;
    done: number;
    failed: number;
    startedAt: number;
}

type SortMode = "default" | "dispatch_asc" | "dispatch_desc";

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

const BATCH_SIZE     = 5;
const MAX_RETRY      = 3;
const RETRY_DELAY_MS = 800;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxRetry = MAX_RETRY): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetry; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetry) await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
    }
    throw lastErr;
}

async function runInBatches<T>(
    items: T[],
    handler: (item: T) => Promise<void>,
    onProgress: (doneCount: number, failedCount: number) => void,
    batchSize = BATCH_SIZE,
) {
    let done = 0;
    let failed = 0;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async item => {
                try {
                    await handler(item);
                    done++;
                } catch {
                    failed++;
                    done++;
                }
                onProgress(done, failed);
            })
        );
    }
}

function formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}p ${s}s` : `${m}p`;
}

// ─── Phân loại đơn hàng ───────────────────────────────────────────────────────
function isTraditionalOrder(waybill: string): boolean {
    const prefix = waybill.substring(0, 2);
    return prefix === "80" || prefix === "84";
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function LoadProgressBar({ progress }: { progress: LoadProgress }) {
    const pct      = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    const elapsed  = (Date.now() - progress.startedAt) / 1000;
    const rate     = progress.done > 0 ? progress.done / elapsed : 0;
    const remaining = progress.total - progress.done;
    const etaSec   = rate > 0 ? remaining / rate : Infinity;

    return (
        <div className="bg-violet-50 border-b border-violet-200 px-5 py-2.5 flex-shrink-0 animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                    <span className="text-xs font-bold text-violet-700">
                        Đang tải dữ liệu... {progress.done}/{progress.total} đơn
                        {progress.failed > 0 && (
                            <span className="text-amber-600 ml-1.5">({progress.failed} lỗi)</span>
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-violet-500 font-semibold">
                    <Clock className="w-3 h-3" />
                    {pct < 100 ? (
                        <span>Còn lại ~<span className="text-violet-700">{formatETA(etaSec)}</span></span>
                    ) : (
                        <span className="text-emerald-600">Hoàn tất!</span>
                    )}
                    <span className="text-violet-400">·</span>
                    <span className="text-violet-700">{pct}%</span>
                </div>
            </div>
            <div className="h-2 bg-violet-200/60 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-300 ease-out progress-shimmer"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-violet-400 font-medium">
                    {rate > 0 ? `${rate.toFixed(1)} đơn/s` : "Đang khởi động..."}
                </span>
                <span className="text-[10px] text-violet-400 font-medium">
                    {progress.total - progress.done > 0
                        ? `Còn ${progress.total - progress.done} đơn`
                        : "Đang hoàn tất..."}
                </span>
            </div>
        </div>
    );
}

// ─── Context cho selected code ────────────────────────────────────────────────
const SelectedCodeCtx = React.createContext<string | null>(null);

// ─── BillItem ─────────────────────────────────────────────────────────────────
const BillItem = memo(function BillItem({
                                            code, groupColor, terminalDispatchCode, onSelect, onHover,
                                        }: {
    code: string;
    groupColor: string;
    terminalDispatchCode: string;
    onSelect: (code: string) => void;
    onHover:  (code: string) => void;
}) {
    const selectedCode = React.useContext(SelectedCodeCtx);
    const isSelected   = selectedCode === code;
    return (
        <div
            onClick={() => onSelect(code)}
            onMouseEnter={() => onHover(code)}
            className={`rounded-xl border cursor-pointer transition-all duration-200 py-2.5 relative overflow-hidden ${
                isSelected
                    ? 'bg-violet-50 border-violet-200 shadow-sm pl-4 pr-3'
                    : `${groupColor || 'bg-slate-50 border-slate-200'} hover:shadow-sm px-3`
            }`}
        >
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
            )}
            <div className={`text-center font-mono font-bold text-xs ${isSelected ? 'text-violet-700' : 'text-slate-800'}`}>
                {code}
            </div>
            {terminalDispatchCode && (
                <div className={`text-center text-xs font-mono mt-1 truncate ${isSelected ? 'text-violet-400' : 'text-blue-500'}`}>
                    {terminalDispatchCode}
                </div>
            )}
        </div>
    );
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function BillsTrackingSection({ bills, authToken, isBillTracking }: BillsTrackingSectionProps) {

    const [selectedCode, setSelectedCode]         = useState<string | null>(null);
    const [inputCode, setInputCode]               = useState<string>("");
    const [parsedCodes, setParsedCodes]           = useState<string[]>([]);
    const [billsList, setBillsList]               = useState<string[]>(bills);
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true);

    const [ordersData, setOrdersData]             = useState<OrderData[]>([]);
    const [groupedOrders, setGroupedOrders]       = useState<GroupedOrder[]>([]);
    const [filteredBills, setFilteredBills]       = useState<string[]>([]);
    const [isLoadingOrders, setIsLoadingOrders]   = useState<boolean>(false);

    const [loadProgress, setLoadProgress]         = useState<LoadProgress | null>(null);

    const [availableStatuses, setAvailableStatuses]   = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses]     = useState<string[]>([]);
    const [show028M08, setShow028M08]                 = useState<boolean>(true);
    const [showNon028M08, setShowNon028M08]           = useState<boolean>(true);
    const [showTraditional, setShowTraditional]       = useState<boolean>(true);
    const [showEcommerce, setShowEcommerce]           = useState<boolean>(true);
    const [copied, setCopied]                         = useState(false);
    const [sortMode, setSortMode]                     = useState<SortMode>("default");

    const [availableScanners, setAvailableScanners]   = useState<string[]>([]);
    const [selectedScanners, setSelectedScanners]     = useState<string[]>([]);

    const [availableDispatchCodes, setAvailableDispatchCodes] = useState<string[]>([]);
    const [selectedDispatchCode, setSelectedDispatchCode]     = useState<string>("");

    // null = tất cả, true = đã chuyển hoàn, false = chưa chuyển hoàn
    const [returnTransferFilter, setReturnTransferFilter] = useState<boolean | null>(null);

    // Tổng số đơn gốc (trước filter) — dùng để hiển thị "X / Y đơn"
    const [totalSourceCount, setTotalSourceCount] = useState<number>(bills.length);

    const detailCacheRef                        = useRef<Map<string, DetailCache>>(new Map());
    const [contentKey, setContentKey]           = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const shouldShowLoading = !isBillTracking && (!bills || bills.length === 0);

    // O(1) lookup map
    const groupedOrderMap = useMemo(() => {
        const m = new Map<string, GroupedOrder>();
        groupedOrders.forEach(o => m.set(o.waybill, o));
        return m;
    }, [groupedOrders]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const parseTerminalCode = (code: string) => {
        const parts = code.split('-');
        if (parts.length >= 3) return { level1: parts[1], level2: parts[2] };
        return { level1: '', level2: '' };
    };

    const createGroupedOrders = (orders: OrderData[]): GroupedOrder[] => {
        const grouped: GroupedOrder[] = [];
        const groupColorMap = new Map<string, string>();
        let colorIndex = 0;
        const level1Groups = new Map<string, OrderData[]>();

        orders.forEach(order => {
            const { level1 } = parseTerminalCode(order.terminalDispatchCode);
            if (!level1Groups.has(level1)) level1Groups.set(level1, []);
            level1Groups.get(level1)!.push(order);
        });

        level1Groups.forEach((level1Orders, level1Key) => {
            const level2Groups = new Map<string, OrderData[]>();
            level1Orders.forEach(order => {
                const { level2 } = parseTerminalCode(order.terminalDispatchCode);
                const key = `${level1Key}-${level2}`;
                if (!level2Groups.has(key)) level2Groups.set(key, []);
                level2Groups.get(key)!.push(order);
            });
            level2Groups.forEach((level2Orders, level2Key) => {
                if (!groupColorMap.has(level2Key)) {
                    groupColorMap.set(level2Key, GROUP_COLORS[colorIndex % GROUP_COLORS.length]);
                    colorIndex++;
                }
                const groupColor = groupColorMap.get(level2Key)!;
                level2Orders.forEach(order => {
                    const parsed = parseTerminalCode(order.terminalDispatchCode);
                    grouped.push({
                        waybill: order.waybill,
                        terminalDispatchCode: order.terminalDispatchCode,
                        scanTypeName: order.scanTypeName,
                        groupLevel1: parsed.level1,
                        groupLevel2: parsed.level2,
                        groupColor,
                    });
                });
            });
        });
        return grouped;
    };

    // ── Sorted bill list ──────────────────────────────────────────────────────
    const sortedBillsList = useMemo(() => {
        if (sortMode === "default") return billsList;

        const partMap = new Map<string, { p1: string; p2: string; p3: string }>();
        groupedOrders.forEach(o => {
            const parts = (o.terminalDispatchCode || "").split('-');
            partMap.set(o.waybill, { p1: parts[0] || "", p2: parts[1] || "", p3: parts[2] || "" });
        });

        const p2Count = new Map<string, number>();
        billsList.forEach(w => {
            const p = partMap.get(w);
            if (p?.p2) p2Count.set(p.p2, (p2Count.get(p.p2) || 0) + 1);
        });
        let mainP2 = "";
        let maxCount = 0;
        p2Count.forEach((count, p2) => { if (count > maxCount) { maxCount = count; mainP2 = p2; } });

        return [...billsList].sort((a, b) => {
            const pa = partMap.get(a) ?? { p1: "", p2: "", p3: "" };
            const pb = partMap.get(b) ?? { p1: "", p2: "", p3: "" };
            const aIsMain = pa.p2 === mainP2;
            const bIsMain = pb.p2 === mainP2;

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
    }, [billsList, groupedOrders, sortMode]);

    const deferredList = useDeferredValue(sortedBillsList);

    const sortLabel = sortMode === "dispatch_asc" ? "Mã đoạn ↑"
        : sortMode === "dispatch_desc" ? "Mã đoạn ↓" : "Mặc định";

    const cycleSortMode = () => setSortMode(prev =>
        prev === "default" ? "dispatch_asc" : prev === "dispatch_asc" ? "dispatch_desc" : "default"
    );

    // ── Prefetch ──────────────────────────────────────────────────────────────
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

    // ── Select with transition ────────────────────────────────────────────────
    const selectedCodeRef = useRef(selectedCode);
    useEffect(() => { selectedCodeRef.current = selectedCode; }, [selectedCode]);

    const handleSelectCode = useCallback((code: string) => {
        if (code === selectedCodeRef.current) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setSelectedCode(code);
            setContentKey(k => k + 1);
            setIsTransitioning(false);
        }, 120);
    }, []);

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        setBillsList(bills);
        setFilteredBills(bills);
        setTotalSourceCount(bills.length);
    }, [bills]);

    useEffect(() => {
        if (!isBillTracking && bills.length > 0) loadOrdersData(bills);
    }, [bills, isBillTracking]);

    useEffect(() => {
        applyStatusFilter();
    }, [selectedStatuses, groupedOrders, show028M08, showNon028M08, showTraditional, showEcommerce, selectedScanners, selectedDispatchCode, returnTransferFilter]);

    // ── API: load với batching + retry + progress ─────────────────────────────
    const loadOrdersData = async (targetBills: string[] = bills) => {
        setIsLoadingOrders(true);
        detailCacheRef.current.clear();

        const startedAt = Date.now();
        setLoadProgress({ total: targetBills.length, done: 0, failed: 0, startedAt });

        // Reset filter state khi load mới
        setAvailableStatuses([]);
        setSelectedStatuses([]);
        setAvailableScanners([]);
        setSelectedScanners([]);
        setAvailableDispatchCodes([]);
        setSelectedDispatchCode("");
        setReturnTransferFilter(null);
        setGroupedOrders([]);
        setOrdersData([]);
        setShowTraditional(true);
        setShowEcommerce(true);

        const mockData: OrderData[] = [];

        await runInBatches(
            targetBills,
            async (bill) => {
                try {
                    const [orderResp, trackingResp, issueResp]: [any, any, any] = await withRetry(() =>
                        Promise.all([
                            axios.post(
                                "https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                                { waybillNo: bill, countryId: "1" },
                                { headers: { authToken, lang: 'VN', langType: 'VN' } }
                            ),
                            axios.post(
                                "https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                                { keywordList: [bill], trackingTypeEnum: "WAYBILL", countryId: "1" },
                                { headers: { authToken, lang: 'VN', langType: 'VN' } }
                            ),
                            axios.post(
                                "https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
                                { current: 1, size: 100, waybillId: bill, countryId: "1" },
                                { headers: { authToken, lang: 'VN', langType: 'VN' } }
                            ),
                        ])
                    );
                    const issueRecords: any[] = issueResp.data?.data?.records ?? [];
                    const lastIssue           = issueRecords[0];
                    const lastIssueScanner    = lastIssue?.operatorName || lastIssue?.scanUserName || '';
                    const allScanTypes: string[] = (trackingResp.data?.data?.[0]?.details ?? [])
                        .map((d: any) => d.scanTypeName || '');
                    const hasReturnTransfer = allScanTypes.some(s => s.includes('Đang chuyển hoàn'));
                    mockData.push({
                        waybill: bill,
                        terminalDispatchCode: orderResp.data.data.details.terminalDispatchCode || '',
                        scanTypeName: trackingResp.data.data[0]?.details[0]?.scanTypeName || 'Không có trạng thái',
                        scanNetworkCode: trackingResp.data.data[0]?.details[0]?.scanNetworkCode || '',
                        lastIssueScanner,
                        hasReturnTransfer,
                    });
                } catch {
                    mockData.push({
                        waybill: bill,
                        terminalDispatchCode: '',
                        scanTypeName: 'Lỗi tải dữ liệu',
                        scanNetworkCode: '',
                        lastIssueScanner: '',
                        hasReturnTransfer: false,
                    });
                    throw new Error("load failed after retries");
                }
            },
            (done, failed) => {
                setLoadProgress({ total: targetBills.length, done, failed, startedAt });
            },
            BATCH_SIZE,
        );

        try {
            const statuses = Array.from(new Set(mockData.map(o => o.scanTypeName).filter(Boolean)));
            setAvailableStatuses(statuses);
            setSelectedStatuses(statuses);

            const scanners = Array.from(new Set(mockData.map(o => o.lastIssueScanner).filter(Boolean))).sort();
            setAvailableScanners(scanners);
            setSelectedScanners([]);

            const dispatchCodes = Array.from(
                new Set(mockData.map(o => o.terminalDispatchCode).filter(Boolean))
            ).sort();
            setAvailableDispatchCodes(dispatchCodes);
            setSelectedDispatchCode("");

            setGroupedOrders(createGroupedOrders(mockData));
            setOrdersData(mockData);
            setTotalSourceCount(targetBills.length);

            // Auto-select đơn đầu tiên sau khi load xong
            if (targetBills.length > 0) {
                handleSelectCode(targetBills[0]);
            }
        } catch (e) {
            console.error('Error processing orders data:', e);
        } finally {
            setTimeout(() => {
                setLoadProgress(null);
                setIsLoadingOrders(false);
            }, 1200);
        }
    };

    const applyStatusFilter = () => {
        let filtered = groupedOrders;
        if (selectedStatuses.length > 0 && selectedStatuses.length < availableStatuses.length)
            filtered = filtered.filter(o => selectedStatuses.includes(o.scanTypeName));
        filtered = filtered.filter(order => {
            const od = ordersData.find(o => o.waybill === order.waybill);
            if (!od) return true;
            const is028 = od.scanNetworkCode === '028M08';
            if (is028 && !show028M08) return false;
            if (!is028 && !showNon028M08) return false;
            const isTraditional = isTraditionalOrder(order.waybill);
            if (isTraditional && !showTraditional) return false;
            if (!isTraditional && !showEcommerce) return false;
            if (selectedScanners.length > 0 && !selectedScanners.includes(od.lastIssueScanner)) return false;
            if (selectedDispatchCode && od.terminalDispatchCode !== selectedDispatchCode) return false;
            if (returnTransferFilter !== null && od.hasReturnTransfer !== returnTransferFilter) return false;
            return true;
        });
        const waybills = filtered.map(o => o.waybill);
        setFilteredBills(waybills);
        setBillsList(waybills);
        if (selectedCode && !waybills.includes(selectedCode)) setSelectedCode(null);
    };

    // ── Input handlers ────────────────────────────────────────────────────────
    const isNumericCode = (code: string) => /^\d{12}$/.test(code.trim());

    const handleInputChange = (value: string) => {
        setInputCode(value);
        const codes = value.split(/[\s\n,]+/).filter(c => c.trim().length > 0);
        const validCodes: string[] = [];
        let remainingText = "";
        codes.forEach(code => {
            const t = code.trim();
            if (isNumericCode(t)) {
                validCodes.push(t);
            } else if (t.length >= 12 && /^\d+$/.test(t)) {
                for (let i = 0; i < t.length; i += 12) {
                    const chunk = t.substr(i, 12);
                    if (chunk.length === 12) validCodes.push(chunk);
                    else if (chunk.length > 0) remainingText += (remainingText ? " " : "") + chunk;
                }
            } else {
                remainingText += (remainingText ? " " : "") + t;
            }
        });
        setParsedCodes(validCodes);
        if (remainingText !== value.replace(/[\s\n,]+/g, ' ').trim()) setInputCode(remainingText);
    };

    const removeParsedCode = (code: string) => setParsedCodes(prev => prev.filter(c => c !== code));

    const handleSearch = () => {
        if (parsedCodes.length > 0) {
            const codes = [...parsedCodes];
            detailCacheRef.current.clear();
            setBillsList(codes);
            setFilteredBills(codes);
            setTotalSourceCount(codes.length);
            setSelectedCode(null);
            setSortMode("default");
            loadOrdersData(codes);
        }
    };

    const handleStatusChange = (status: string, checked: boolean) =>
        setSelectedStatuses(prev => checked ? [...prev, status] : prev.filter(s => s !== status));

    const handleSelectAllStatuses = (all: boolean) =>
        setSelectedStatuses(all ? [...availableStatuses] : []);

    const handleRefresh = () => {
        detailCacheRef.current.clear();
        setSortMode("default");
        if (isBillTracking) {
            const target = parsedCodes.length > 0 ? parsedCodes : billsList;
            if (target.length > 0) loadOrdersData(target);
        } else {
            loadOrdersData(bills);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(sortedBillsList.join("\n")).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const clearFilters = () => {
        setSelectedStatuses([...availableStatuses]);
        setShow028M08(true);
        setShowNon028M08(true);
        setShowTraditional(true);
        setShowEcommerce(true);
        setSelectedScanners([]);
        setSelectedDispatchCode("");
        setReturnTransferFilter(null);
        setSortMode("default");
    };

    // ── Có data để show filter không ─────────────────────────────────────────
    const hasFilterData = availableStatuses.length > 0;

    // ── Thống kê số đơn theo loại (để hiển thị badge) ────────────────────────
    const orderTypeCounts = useMemo(() => {
        const allWaybills = groupedOrders.map(o => o.waybill);
        const traditional = allWaybills.filter(w => isTraditionalOrder(w)).length;
        const ecommerce   = allWaybills.length - traditional;
        return { traditional, ecommerce };
    }, [groupedOrders]);

    // ── Loading screen ────────────────────────────────────────────────────────
    if (shouldShowLoading) {
        return (
            <>
                <FontLoader />
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        <p className="font-bold text-slate-700">Đang tải dữ liệu...</p>
                        <p className="text-xs text-slate-400">Vui lòng đợi trong giây lát</p>
                    </div>
                </div>
            </>
        );
    }

    // ── Main ──────────────────────────────────────────────────────────────────
    return (
        <>
            <FontLoader />
            <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

                {/* ── Top bar ── */}
                <div className="bg-white border-b border-slate-200 flex-shrink-0 z-20">
                    <div className="px-5 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => window.history.back()}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors text-sm font-semibold"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Quay lại
                            </button>
                            <div className="w-px h-5 bg-slate-200" />
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <span className="font-bold text-slate-800 text-sm">
                                    {isBillTracking ? "Tra cứu vận đơn" : "Theo dõi vận đơn"}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                                {hasFilterData
                                    ? `${filteredBills.length} / ${totalSourceCount}`
                                    : billsList.length} đơn
                            </span>
                            <button
                                onClick={handleRefresh}
                                disabled={isLoadingOrders}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-xs transition-all disabled:opacity-40"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? "animate-spin" : ""}`} />
                                Làm mới
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Progress bar ── */}
                {loadProgress && (
                    <LoadProgressBar progress={loadProgress} />
                )}

                {/* ── Filter bar ── */}
                {hasFilterData && (
                    <div className="bg-white border-b border-slate-200 px-5 py-3 flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Bộ lọc</span>
                            </div>

                            {/* Trạng thái */}
                            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 cursor-pointer transition-all text-xs">
                                <input
                                    type="checkbox"
                                    checked={selectedStatuses.length === availableStatuses.length}
                                    onChange={e => handleSelectAllStatuses(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="font-semibold text-slate-700">Tất cả</span>
                            </label>
                            {availableStatuses.map(status => (
                                <label key={status} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 cursor-pointer transition-all text-xs">
                                    <input
                                        type="checkbox"
                                        checked={selectedStatuses.includes(status)}
                                        onChange={e => handleStatusChange(status, e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-700">{status}</span>
                                </label>
                            ))}

                            <div className="h-5 w-px bg-slate-200" />

                            {/* Mã mạng lưới */}
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mã mạng lưới</span>
                            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 cursor-pointer transition-all text-xs">
                                <input type="checkbox" checked={show028M08} onChange={e => setShow028M08(e.target.checked)}
                                       className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span className="font-semibold text-slate-700">028M08</span>
                            </label>
                            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 cursor-pointer transition-all text-xs">
                                <input type="checkbox" checked={showNon028M08} onChange={e => setShowNon028M08(e.target.checked)}
                                       className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-slate-700">Khác</span>
                            </label>

                            <div className="h-5 w-px bg-slate-200" />

                            {/* Loại đơn hàng */}
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Loại đơn</span>
                            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-orange-300 cursor-pointer transition-all text-xs">
                                <input
                                    type="checkbox"
                                    checked={showTraditional}
                                    onChange={e => setShowTraditional(e.target.checked)}
                                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                                />
                                <span className="font-semibold text-orange-700">TRUYỀN THỐNG</span>
                                {orderTypeCounts.traditional > 0 && (
                                    <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {orderTypeCounts.traditional}
                                    </span>
                                )}
                            </label>
                            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:border-violet-300 cursor-pointer transition-all text-xs">
                                <input
                                    type="checkbox"
                                    checked={showEcommerce}
                                    onChange={e => setShowEcommerce(e.target.checked)}
                                    className="rounded border-slate-300 text-violet-500 focus:ring-violet-400"
                                />
                                <span className="font-semibold text-violet-700">ĐƠN SÀN</span>
                                {orderTypeCounts.ecommerce > 0 && (
                                    <span className="bg-violet-100 text-violet-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {orderTypeCounts.ecommerce}
                                    </span>
                                )}
                            </label>

                            {/* Mã đoạn */}
                            {availableDispatchCodes.length > 0 && (<>
                                <div className="h-5 w-px bg-slate-200" />
                                <div className="flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mã đoạn</span>
                                </div>
                                <select
                                    value={selectedDispatchCode}
                                    onChange={e => setSelectedDispatchCode(e.target.value)}
                                    className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all cursor-pointer ${
                                        selectedDispatchCode
                                            ? 'bg-blue-50 border-blue-300 text-blue-800'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                                    }`}
                                >
                                    <option value="">Tất cả ({availableDispatchCodes.length} mã)</option>
                                    {availableDispatchCodes.map(code => (
                                        <option key={code} value={code}>{code}</option>
                                    ))}
                                </select>
                                {selectedDispatchCode && (
                                    <button
                                        onClick={() => setSelectedDispatchCode("")}
                                        className="text-blue-500 hover:text-blue-700 transition-colors"
                                        title="Bỏ lọc"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </>)}

                            {/* Chuyển hoàn */}
                            <div className="h-5 w-px bg-slate-200" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chuyển hoàn</span>
                            <div className="flex items-center gap-1.5">
                                {([
                                    { value: null,  label: 'Tất cả',        active: 'bg-slate-100 border-slate-400 text-slate-700' },
                                    { value: true,  label: 'Đã chuyển hoàn', active: 'bg-rose-50 border-rose-400 text-rose-700' },
                                    { value: false, label: 'Chưa chuyển hoàn', active: 'bg-emerald-50 border-emerald-400 text-emerald-700' },
                                ] as { value: boolean | null; label: string; active: string }[]).map(opt => (
                                    <button
                                        key={String(opt.value)}
                                        onClick={() => setReturnTransferFilter(opt.value)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                            returnTransferFilter === opt.value
                                                ? opt.active
                                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Người quét vấn đề */}
                            {availableScanners.length > 0 && (<>
                                <div className="h-5 w-px bg-slate-200" />
                                <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người quét vấn đề</span>
                                </div>
                                <select
                                    value={selectedScanners[0] ?? ""}
                                    onChange={e => setSelectedScanners(e.target.value ? [e.target.value] : [])}
                                    className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all cursor-pointer ${
                                        selectedScanners.length > 0
                                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                                    }`}
                                >
                                    <option value="">Tất cả ({availableScanners.length} người)</option>
                                    {availableScanners.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                {selectedScanners.length > 0 && (
                                    <button
                                        onClick={() => setSelectedScanners([])}
                                        className="text-amber-500 hover:text-amber-700 transition-colors"
                                        title="Bỏ lọc"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </>)}

                            <button onClick={clearFilters}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all ml-auto">
                                <RotateCcw className="w-3 h-3" />Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Sidebar ── */}
                    <div className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex-shrink-0 ${isSearchExpanded ? 'w-80' : 'w-56'}`}>

                        {isBillTracking && (
                            <div
                                className="px-4 py-4 border-b border-slate-100 flex-shrink-0 cursor-pointer"
                                onClick={() => setIsSearchExpanded(true)}
                            >
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Nhập mã vận đơn
                                </label>
                                <textarea
                                    value={inputCode}
                                    onChange={e => handleInputChange(e.target.value)}
                                    placeholder="Nhập hoặc dán mã vận đơn..."
                                    className={`w-full border border-slate-200 rounded-xl bg-slate-50 text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all ${isSearchExpanded ? 'px-3 py-2.5 h-20 text-sm' : 'px-3 py-2 h-12 text-xs'}`}
                                    onClick={e => e.stopPropagation()}
                                />
                                {isSearchExpanded && parsedCodes.length > 0 && (
                                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1.5">
                                        {parsedCodes.map((code, i) => (
                                            <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                                                <span className="text-xs font-mono font-semibold text-blue-800">{code}</span>
                                                <button onClick={e => { e.stopPropagation(); removeParsedCode(code); }}
                                                        className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!isSearchExpanded && parsedCodes.length > 0 && (
                                    <p className="mt-1.5 text-xs text-blue-600 font-semibold">{parsedCodes.length} mã đã nhập</p>
                                )}
                                <button
                                    onClick={e => { e.stopPropagation(); handleSearch(); }}
                                    disabled={parsedCodes.length === 0 || isLoadingOrders}
                                    className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm"
                                >
                                    {isLoadingOrders
                                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang tải...</>
                                        : <><Search className="w-4 h-4" />Tra cứu ({parsedCodes.length})</>
                                    }
                                </button>
                            </div>
                        )}

                        {/* Bills list header */}
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col cursor-pointer" onClick={() => setIsSearchExpanded(false)}>
                            <div className="px-4 pt-4 pb-2 flex-shrink-0 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex gap-2 items-center">
                                    Danh sách
                                    {isLoadingOrders && !loadProgress && (
                                        <div className="w-3 h-3 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                    )}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {hasFilterData && (
                                        <button
                                            onClick={e => { e.stopPropagation(); cycleSortMode(); }}
                                            title="Sắp xếp theo mã đoạn"
                                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                                sortMode !== "default"
                                                    ? "bg-violet-50 text-violet-700 border-violet-300"
                                                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200"
                                            }`}
                                        >
                                            <ArrowUpDown className="w-3 h-3" />
                                            {isSearchExpanded ? sortLabel : ""}
                                        </button>
                                    )}
                                    <button
                                        onClick={e => { e.stopPropagation(); handleCopy(); }}
                                        disabled={sortedBillsList.length === 0}
                                        title="Copy tất cả mã vận đơn"
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            copied
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                        }`}
                                    >
                                        {copied
                                            ? <><Check className="w-3 h-3" />Copied!</>
                                            : <><Copy className="w-3 h-3" />({sortedBillsList.length})</>
                                        }
                                    </button>
                                </div>
                            </div>

                            <SelectedCodeCtx.Provider value={selectedCode}>
                                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
                                    {deferredList.length === 0 ? (
                                        <div className="text-center py-10">
                                            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                            <p className="text-sm font-semibold text-slate-400">
                                                {isLoadingOrders
                                                    ? "Đang tải dữ liệu..."
                                                    : isBillTracking
                                                        ? "Nhập mã vận đơn để bắt đầu"
                                                        : "Chưa có vận đơn"}
                                            </p>
                                        </div>
                                    ) : (
                                        deferredList.map(code => {
                                            const groupedOrder = groupedOrderMap.get(code);
                                            return (
                                                <BillItem
                                                    key={code}
                                                    code={code}
                                                    groupColor={groupedOrder?.groupColor ?? ''}
                                                    terminalDispatchCode={groupedOrder?.terminalDispatchCode ?? ''}
                                                    onSelect={handleSelectCode}
                                                    onHover={prefetchDetail}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            </SelectedCodeCtx.Provider>
                        </div>
                    </div>

                    {/* ── Main content ── */}
                    <div className="flex-1 flex overflow-hidden">
                        {!selectedCode ? (
                            <div className="flex-1 flex items-center justify-center bg-slate-50">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Package className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="font-bold text-slate-500">
                                        {isLoadingOrders
                                            ? "Đang tải dữ liệu..."
                                            : "Chọn một mã vận đơn để xem chi tiết"}
                                    </p>
                                    {!isLoadingOrders && sortedBillsList.length > 0 && (
                                        <p className="text-xs text-slate-400 mt-1">Có {sortedBillsList.length} vận đơn trong danh sách</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div
                                key={contentKey}
                                className={`flex flex-1 overflow-hidden transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100 content-fade'}`}
                            >
                                <div className="max-w-[340px] overflow-y-auto border-r border-slate-200">
                                    <OrderDetail
                                        waybill={selectedCode}
                                        authToken={authToken}
                                        cache={detailCacheRef.current.get(selectedCode)}
                                    />
                                </div>
                                <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                                    <div className="flex-[2] min-h-0">
                                        <PodHistory
                                            waybill={selectedCode}
                                            authToken={authToken}
                                            cache={detailCacheRef.current.get(selectedCode)}
                                        />
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <IssueHistory
                                            waybill={selectedCode}
                                            authToken={authToken}
                                            cache={detailCacheRef.current.get(selectedCode)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-slate-300 py-2 border-t border-slate-100 bg-white flex-shrink-0">
                    JT Express Internal Tool · {new Date().getFullYear()}
                </p>
            </div>
        </>
    );
}