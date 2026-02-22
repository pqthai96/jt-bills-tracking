"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import OrderDetail from "@/components/bills-tracking/order-detail";
import PodHistory from "@/components/bills-tracking/pod-history";
import IssueHistory from "@/components/bills-tracking/issue-history";
import axios from "axios";
import {
    Search, Package, Filter, RotateCcw, X,
    ArrowLeft, Truck, RefreshCw, Copy, Check, ArrowUpDown,
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
}

interface GroupedOrder {
    waybill: string;
    terminalDispatchCode: string;
    scanTypeName: string;
    groupLevel1: string;
    groupLevel2: string;
    groupColor: string;
}

// ─── Cache types ──────────────────────────────────────────────────────────────
export interface DetailCache {
    orderDetail: any;
    podHistory: any[];
    issueHistory: any[];
}

// Sort theo phần thứ 3 của mã đoạn (index 2), ví dụ "005" trong "805-A028M08-005"
// Các đơn có phần thứ 2 (index 1) khác nhau thì nhóm riêng — để cuối danh sách
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

export default function BillsTrackingSection({ bills, authToken, isBillTracking }: BillsTrackingSectionProps) {

    const [selectedCode, setSelectedCode]         = useState<string | null>(null);
    const [inputCode, setInputCode]               = useState<string>("");
    const [parsedCodes, setParsedCodes]           = useState<string[]>([]);
    const [billsList, setBillsList]               = useState<string[]>(bills);
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true);

    const [ordersData, setOrdersData]         = useState<OrderData[]>([]);
    const [groupedOrders, setGroupedOrders]   = useState<GroupedOrder[]>([]);
    const [filteredBills, setFilteredBills]   = useState<string[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

    const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses]   = useState<string[]>([]);
    const [show028M08, setShow028M08]               = useState<boolean>(true);
    const [showNon028M08, setShowNon028M08]         = useState<boolean>(true);
    const [copied, setCopied]                       = useState(false);
    const [sortMode, setSortMode]                   = useState<SortMode>("default");

    // ── Cache ─────────────────────────────────────────────────────────────────
    const detailCacheRef = useRef<Map<string, DetailCache>>(new Map());

    // ── Transition ────────────────────────────────────────────────────────────
    const [contentKey, setContentKey]       = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const shouldShowLoading = !isBillTracking && (!bills || bills.length === 0);

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

    // ── Sorted bill list (computed) ───────────────────────────────────────────
    // Logic: sort theo phần thứ 3 (parts[2], ví dụ "005") trong cùng nhóm phần thứ 2 (parts[1], ví dụ "A028M08")
    // Các nhóm parts[1] khác nhau → giữ nhóm chính (xuất hiện nhiều nhất) ở giữa,
    // các nhóm khác xếp cuối (sort_asc) hoặc đầu (sort_desc)
    const sortedBillsList = useMemo(() => {
        if (sortMode === "default") return billsList;

        // Build map waybill → { part1, part2, part3 }
        const partMap = new Map<string, { p1: string; p2: string; p3: string }>();
        groupedOrders.forEach(o => {
            const parts = (o.terminalDispatchCode || "").split('-');
            partMap.set(o.waybill, {
                p1: parts[0] || "",
                p2: parts[1] || "",
                p3: parts[2] || "",
            });
        });

        // Tìm nhóm p2 xuất hiện nhiều nhất (nhóm chính)
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
                // Nhóm chính trước, nhóm khác sau
                if (aIsMain && !bIsMain) return -1;
                if (!aIsMain && bIsMain) return 1;
                // Cùng nhóm → sort theo p3
                if (pa.p2 === pb.p2) return pa.p3.localeCompare(pb.p3, undefined, { numeric: true });
                // Cả 2 đều không phải nhóm chính → sort theo p2 rồi p3
                return pa.p2.localeCompare(pb.p2) || pa.p3.localeCompare(pb.p3, undefined, { numeric: true });
            } else {
                // dispatch_desc: nhóm chính sau, nhóm khác trước (đảo ngược)
                if (aIsMain && !bIsMain) return 1;
                if (!aIsMain && bIsMain) return -1;
                if (pa.p2 === pb.p2) return pb.p3.localeCompare(pa.p3, undefined, { numeric: true });
                return pb.p2.localeCompare(pa.p2) || pb.p3.localeCompare(pa.p3, undefined, { numeric: true });
            }
        });
    }, [billsList, groupedOrders, sortMode]);

    const sortLabel = sortMode === "dispatch_asc" ? "Mã đoạn ↑"
        : sortMode === "dispatch_desc" ? "Mã đoạn ↓"
            : "Mặc định";

    const cycleSortMode = () => {
        setSortMode(prev =>
            prev === "default"      ? "dispatch_asc"  :
                prev === "dispatch_asc" ? "dispatch_desc" : "default"
        );
    };

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
    const handleSelectCode = useCallback((code: string) => {
        if (code === selectedCode) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setSelectedCode(code);
            setContentKey(k => k + 1);
            setIsTransitioning(false);
        }, 120);
    }, [selectedCode]);

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => { setBillsList(bills); setFilteredBills(bills); }, [bills]);

    useEffect(() => {
        if (!isBillTracking && bills.length > 0) loadOrdersData();
    }, [bills, isBillTracking]);

    useEffect(() => {
        if (!isBillTracking) applyStatusFilter();
    }, [selectedStatuses, groupedOrders, show028M08, showNon028M08]);

    // ── API ───────────────────────────────────────────────────────────────────
    const loadOrdersData = async () => {
        setIsLoadingOrders(true);
        detailCacheRef.current.clear();
        try {
            const mockData: OrderData[] = [];
            await Promise.all(bills.map(async (bill) => {
                try {
                    const [orderResp, trackingResp]: [any, any] = await Promise.all([
                        axios.post("https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                            { waybillNo: bill, countryId: "1" },
                            { headers: { authToken, lang: 'VN', langType: 'VN' } }
                        ),
                        axios.post("https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                            { keywordList: [bill], trackingTypeEnum: "WAYBILL", countryId: "1" },
                            { headers: { authToken, lang: 'VN', langType: 'VN' } }
                        ),
                    ]);
                    mockData.push({
                        waybill: bill,
                        terminalDispatchCode: orderResp.data.data.details.terminalDispatchCode || '',
                        scanTypeName: trackingResp.data.data[0]?.details[0]?.scanTypeName || 'Không có trạng thái',
                        scanNetworkCode: trackingResp.data.data[0]?.details[0]?.scanNetworkCode || '',
                    });
                } catch {
                    mockData.push({ waybill: bill, terminalDispatchCode: '', scanTypeName: 'Lỗi tải dữ liệu', scanNetworkCode: '' });
                }
            }));
            const statuses = Array.from(new Set(mockData.map(o => o.scanTypeName).filter(Boolean)));
            setAvailableStatuses(statuses);
            setSelectedStatuses(statuses);
            setGroupedOrders(createGroupedOrders(mockData));
            setOrdersData(mockData);
        } catch (e) {
            console.error('Error loading orders data:', e);
        } finally {
            setIsLoadingOrders(false);
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
            detailCacheRef.current.clear();
            setBillsList([...parsedCodes]);
            handleSelectCode(parsedCodes[0]);
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
            if (billsList.length > 0) { setSelectedCode(null); setBillsList([...billsList]); }
        } else {
            loadOrdersData();
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
        setSortMode("default");
    };

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
                                {isBillTracking ? billsList.length : `${filteredBills.length} / ${bills.length}`} đơn
                            </span>
                            {isLoadingOrders && (
                                <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            )}
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

                {/* ── Filter bar ── */}
                {!isBillTracking && (
                    <div className="bg-white border-b border-slate-200 px-5 py-3 flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Bộ lọc</span>
                            </div>
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
                                    disabled={parsedCodes.length === 0}
                                    className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm"
                                >
                                    <Search className="w-4 h-4" />
                                    Tra cứu ({parsedCodes.length})
                                </button>
                            </div>
                        )}

                        {/* Bills list header */}
                        <div className="flex-1 overflow-hidden flex flex-col cursor-pointer" onClick={() => setIsSearchExpanded(false)}>
                            <div className="px-4 pt-4 pb-2 flex-shrink-0 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex gap-2 items-center">
                                    Danh sách
                                    {isLoadingOrders && (
                                        <div className="w-3 h-3 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                    )}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {/* Sort button — chỉ hiện khi có mã đoạn (không phải isBillTracking thuần) */}
                                    {!isBillTracking && groupedOrders.length > 0 && (
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
                                    {/* Copy button */}
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

                            {/* Bills list */}
                            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
                                {sortedBillsList.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-400">
                                            {!isBillTracking && isLoadingOrders ? "Đang tải dữ liệu..." : "Chưa có vận đơn"}
                                        </p>
                                    </div>
                                ) : (
                                    sortedBillsList.map(code => {
                                        const groupedOrder = groupedOrders.find(o => o.waybill === code);
                                        const isSelected = selectedCode === code;
                                        return (
                                            <div
                                                key={code}
                                                onClick={e => { e.stopPropagation(); handleSelectCode(code); setIsSearchExpanded(false); }}
                                                onMouseEnter={() => prefetchDetail(code)}
                                                className={`rounded-xl border cursor-pointer transition-all duration-200 py-2.5 relative overflow-hidden ${
                                                    isSelected
                                                        ? 'bg-violet-50 border-violet-200 shadow-sm pl-4 pr-3'
                                                        : `${groupedOrder?.groupColor || 'bg-slate-50 border-slate-200'} hover:shadow-sm px-3`
                                                }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
                                                )}
                                                <div className={`text-center font-mono font-bold text-xs ${isSelected ? 'text-violet-700' : 'text-slate-800'}`}>
                                                    {code}
                                                </div>
                                                {!isBillTracking && groupedOrder?.terminalDispatchCode && (
                                                    <div className={`text-center text-xs font-mono mt-1 truncate ${isSelected ? 'text-violet-400' : 'text-blue-500'}`}>
                                                        {groupedOrder.terminalDispatchCode}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
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
                                    <p className="font-bold text-slate-500">Chọn một mã vận đơn để xem chi tiết</p>
                                    {sortedBillsList.length > 0 && (
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