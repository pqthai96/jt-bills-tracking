"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import {
    Search, Package, Filter, RotateCcw, ArrowLeft,
    Warehouse, CheckCircle2, XCircle, Clock,
    RefreshCw, AlertTriangle, Circle, BadgeCheck, Copy, Check,
    CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import PodHistory from "@/components/bills-tracking/pod-history";
import IssueHistory from "@/components/bills-tracking/issue-history";
import { DetailCache } from "@/components/bills-tracking/bills-tracking-section";

// ─── Font loader ───────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes slide-in {
            from { opacity: 0; transform: translateX(-8px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        .slide-in { animation: slide-in 0.2s ease-out; }
        @keyframes content-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .content-fade { animation: content-fade 0.15s ease-out; }
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

interface BillInfo {
    waybill: string;
    stocktakingStatus: StocktakingStatus;
    latestScanTypeName: string;
    latestScanTime: string;
    latestScanNetworkCode: string;
    stocktakingTime: string;
    stocktakingNetworkCode: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STOCKTAKING_KEYWORDS = ["kiểm tồn", "stocktaking", "kiểm kho", "tồn kho", "inventory"];

function isStocktakingEvent(scanTypeName: string): boolean {
    const lower = (scanTypeName || "").toLowerCase();
    return STOCKTAKING_KEYWORDS.some(kw => lower.includes(kw));
}

function formatTime(raw: string): string {
    if (!raw) return "—";
    try { return new Date(raw).toLocaleString("vi-VN", { hour12: false }); }
    catch { return raw; }
}

function toDateStr(d: Date): string {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

const STATUS_BADGE: Record<StocktakingStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    checked:     { label: "Đã kiểm tồn",   icon: <BadgeCheck    className="w-3.5 h-3.5" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    not_checked: { label: "Chưa kiểm tồn", icon: <XCircle       className="w-3.5 h-3.5" />, cls: "bg-amber-50  text-amber-700  border-amber-200"  },
    loading:     { label: "Đang tải...",    icon: <Clock         className="w-3.5 h-3.5" />, cls: "bg-slate-50  text-slate-500  border-slate-200"  },
    error:       { label: "Lỗi",            icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: "bg-red-50   text-red-600    border-red-200"    },
};

// ─── Skeleton cho detail panel bên trái ───────────────────────────────────────
function DetailPanelSkeleton() {
    return (
        <div className="w-60 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto px-4 py-4 space-y-3">
            {/* Waybill card skeleton */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 animate-pulse">
                <div className="h-2.5 bg-slate-200 rounded w-20" />
                <div className="h-5 bg-slate-300 rounded w-36" />
                <div className="h-6 bg-slate-200 rounded-lg w-28 mt-2" />
            </div>
            {/* Info block skeleton */}
            {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 animate-pulse">
                    <div className="h-3 bg-slate-200 rounded w-24" />
                    <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1.5">
                        <div className="h-2 bg-slate-200 rounded w-16" />
                        <div className="h-3 bg-slate-300 rounded w-28" />
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1.5">
                        <div className="h-2 bg-slate-200 rounded w-16" />
                        <div className="h-3 bg-slate-200 rounded w-20" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StocktakingCheckSection({ bills, authToken, selectedDate, onDateChange }: StocktakingCheckSectionProps) {
    const [billsInfo, setBillsInfo]             = useState<BillInfo[]>([]);
    const [isLoading, setIsLoading]             = useState(false);
    const [selectedWaybill, setSelectedWaybill] = useState<string | null>(null);
    const [copied, setCopied]                   = useState(false);

    // Filters
    const [filterStocktaking, setFilterStocktaking]       = useState<"all" | "checked" | "not_checked">("all");
    const [selectedLastStatuses, setSelectedLastStatuses] = useState<string[]>([]);
    const [searchQuery, setSearchQuery]                   = useState("");

    // ── Cache & transition ─────────────────────────────────────────────
    const detailCacheRef   = useRef<Map<string, DetailCache>>(new Map());
    const [contentKey, setContentKey]           = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const today = toDateStr(new Date());

    // ── Date navigation ────────────────────────────────────────────────
    const shiftDay = (delta: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + delta);
        onDateChange(toDateStr(d));
    };

    // ── Computed ───────────────────────────────────────────────────────
    const allLastStatuses = useMemo(
        () => Array.from(new Set(
            billsInfo
                .filter(b => b.stocktakingStatus === "not_checked")
                .map(b => b.latestScanTypeName)
                .filter(Boolean)
        )),
        [billsInfo]
    );

    const filtered = useMemo(() => {
        return billsInfo.filter(b => {
            if (searchQuery && !b.waybill.includes(searchQuery.trim())) return false;
            if (filterStocktaking === "checked"     && b.stocktakingStatus !== "checked")     return false;
            if (filterStocktaking === "not_checked" && b.stocktakingStatus !== "not_checked") return false;
            if (
                b.stocktakingStatus === "not_checked" &&
                selectedLastStatuses.length > 0 &&
                selectedLastStatuses.length < allLastStatuses.length &&
                !selectedLastStatuses.includes(b.latestScanTypeName)
            ) return false;
            return true;
        });
    }, [billsInfo, filterStocktaking, selectedLastStatuses, searchQuery, allLastStatuses]);

    const checkedCount    = billsInfo.filter(b => b.stocktakingStatus === "checked").length;
    const notCheckedCount = billsInfo.filter(b => b.stocktakingStatus === "not_checked").length;

    // ── Effects ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authToken || !bills.length) return;
        loadData();
    }, [authToken, bills]);

    useEffect(() => {
        if (allLastStatuses.length > 0 && selectedLastStatuses.length === 0)
            setSelectedLastStatuses([...allLastStatuses]);
    }, [allLastStatuses]);

    // ── Load data ──────────────────────────────────────────────────────
    const loadData = async () => {
        setIsLoading(true);
        setSelectedWaybill(null);
        detailCacheRef.current.clear();
        setBillsInfo(bills.map(w => ({
            waybill: w, stocktakingStatus: "loading",
            latestScanTypeName: "", latestScanTime: "",
            latestScanNetworkCode: "", stocktakingTime: "", stocktakingNetworkCode: "",
        })));

        const dateStart = `${selectedDate} 00:00:00`;
        const dateEnd   = `${selectedDate} 23:59:59`;

        const results: BillInfo[] = await Promise.all(
            bills.map(async (waybill): Promise<BillInfo> => {
                try {
                    const resp: any = await axios.post(
                        "https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                        { keywordList: [waybill], trackingTypeEnum: "WAYBILL", countryId: "1" },
                        { headers: { authToken, lang: "VN", langType: "VN" } }
                    );
                    const details: any[] = resp.data?.data?.[0]?.details || [];
                    const todayStocktaking = details.find(d =>
                        d.scanTime >= dateStart && d.scanTime <= dateEnd && isStocktakingEvent(d.scanTypeName)
                    );
                    const latest = details[0];

                    // Cache luôn POD history khi load (đã có data, tái sử dụng)
                    if (!detailCacheRef.current.has(waybill)) {
                        detailCacheRef.current.set(waybill, {
                            orderDetail: null,   // không cần ở đây
                            podHistory: [...details].reverse(),
                            issueHistory: [],    // sẽ lazy-load khi cần
                        });
                    }

                    return {
                        waybill,
                        stocktakingStatus:      todayStocktaking ? "checked" : "not_checked",
                        latestScanTypeName:     latest?.scanTypeName    || "Không có trạng thái",
                        latestScanTime:         latest?.scanTime        || "",
                        latestScanNetworkCode:  latest?.scanNetworkCode || "",
                        stocktakingTime:        todayStocktaking?.scanTime        || "",
                        stocktakingNetworkCode: todayStocktaking?.scanNetworkCode || "",
                    };
                } catch {
                    return {
                        waybill, stocktakingStatus: "error",
                        latestScanTypeName: "Lỗi tải dữ liệu",
                        latestScanTime: "", latestScanNetworkCode: "",
                        stocktakingTime: "", stocktakingNetworkCode: "",
                    };
                }
            })
        );

        setBillsInfo(results);
        setIsLoading(false);
    };

    // ── Prefetch issue history khi hover ───────────────────────────────
    const prefetchIssue = useCallback(async (waybill: string) => {
        const existing = detailCacheRef.current.get(waybill);
        if (existing?.issueHistory?.length !== 0 && existing?.issueHistory !== undefined) return; // đã có hoặc đã fetch rỗng
        try {
            const resp: any = await axios.post(
                "https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
                { current: 1, size: 100, waybillId: waybill, countryId: "1" },
                { headers: { authToken, lang: "VN", langType: "VN" } }
            );
            const records = resp.data?.data?.records ?? [];
            detailCacheRef.current.set(waybill, {
                ...(detailCacheRef.current.get(waybill) ?? { orderDetail: null, podHistory: [] }),
                issueHistory: records,
            });
        } catch { /* prefetch thất bại — component con sẽ tự fetch */ }
    }, [authToken]);

    // ── Chọn mã với fade transition ────────────────────────────────────
    const handleSelectWaybill = useCallback((waybill: string) => {
        if (waybill === selectedWaybill) {
            setSelectedWaybill(null);
            return;
        }
        setIsTransitioning(true);
        setTimeout(() => {
            setSelectedWaybill(waybill);
            setContentKey(k => k + 1);
            setIsTransitioning(false);
        }, 100);
    }, [selectedWaybill]);

    // ── Copy ───────────────────────────────────────────────────────────
    const handleCopyFiltered = () => {
        const text = filtered.map(b => b.waybill).join("\n");
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const selectedInfo = billsInfo.find(b => b.waybill === selectedWaybill);

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <>
            <FontLoader />
            <div className="h-screen bg-[#f5f6fa] flex flex-col overflow-hidden text-[13px]">

                {/* ── Top bar ── */}
                <header className="bg-white border-b border-slate-200 flex-shrink-0 px-5 h-14 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors font-semibold text-xs"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </button>
                        <div className="w-px h-5 bg-slate-200" />
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <span className="font-bold text-slate-800">Kiểm tra tồn kho</span>
                        </div>

                        <div className="w-px h-5 bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <button
                                onClick={() => shiftDay(-1)}
                                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all"
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={e => { if (e.target.value) onDateChange(e.target.value); }}
                                className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 text-slate-700 cursor-pointer transition-all"
                            />
                            <button
                                onClick={() => shiftDay(1)}
                                disabled={selectedDate >= today}
                                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-3 h-3" />
                            </button>
                            {selectedDate !== today && (
                                <button
                                    onClick={() => onDateChange(today)}
                                    className="px-2 py-1 text-[11px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-all"
                                >
                                    Hôm nay
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {checkedCount} đã kiểm
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <XCircle className="w-3.5 h-3.5" />
                            {notCheckedCount} chưa kiểm
                        </span>
                        <span className="text-xs text-slate-400 font-semibold border border-slate-200 px-2.5 py-1 rounded-full bg-slate-50">
                            {bills.length} đơn
                        </span>
                        {isLoading && <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />}
                        <button
                            onClick={loadData}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-xs transition-all disabled:opacity-40"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            Làm mới
                        </button>
                    </div>
                </header>

                {/* ── Filter bar ── */}
                <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex-shrink-0 flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm mã vận đơn..."
                            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 transition-all w-48"
                        />
                    </div>

                    <div className="h-5 w-px bg-slate-200" />
                    <Filter className="w-3.5 h-3.5 text-slate-400" />

                    {(["all", "checked", "not_checked"] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setFilterStocktaking(v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                filterStocktaking === v
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
                            }`}
                        >
                            {v === "all" ? "Tất cả" : v === "checked" ? "✓ Đã kiểm" : "✗ Chưa kiểm"}
                        </button>
                    ))}

                    {filterStocktaking !== "checked" && allLastStatuses.length > 0 && (
                        <>
                            <div className="h-5 w-px bg-slate-200" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trạng thái cuối</span>
                            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-300 cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={selectedLastStatuses.length === allLastStatuses.length}
                                    onChange={e => setSelectedLastStatuses(e.target.checked ? [...allLastStatuses] : [])}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="font-semibold text-slate-700">Tất cả</span>
                            </label>
                            {allLastStatuses.map(status => (
                                <label key={status} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-300 cursor-pointer text-xs">
                                    <input
                                        type="checkbox"
                                        checked={selectedLastStatuses.includes(status)}
                                        onChange={e => setSelectedLastStatuses(prev =>
                                            e.target.checked ? [...prev, status] : prev.filter(s => s !== status)
                                        )}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-slate-700">{status}</span>
                                </label>
                            ))}
                        </>
                    )}

                    <button
                        onClick={() => { setFilterStocktaking("all"); setSelectedLastStatuses([...allLastStatuses]); setSearchQuery(""); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <RotateCcw className="w-3 h-3" />Reset
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── List panel ── */}
                    <div className="w-[300px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0 gap-2">
                            <span className="font-bold text-slate-700 text-xs">Danh sách ({filtered.length})</span>
                            <button
                                onClick={handleCopyFiltered}
                                disabled={filtered.length === 0}
                                title="Copy tất cả mã đơn đã lọc"
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    copied
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
                                }`}
                            >
                                {copied
                                    ? <><Check className="w-3 h-3" />Đã copy!</>
                                    : <><Copy className="w-3 h-3" />Copy ({filtered.length})</>
                                }
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Package className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm font-semibold text-slate-400">Không có vận đơn nào</p>
                                </div>
                            ) : filtered.map(info => {
                                const badge = STATUS_BADGE[info.stocktakingStatus];
                                const isSelected = selectedWaybill === info.waybill;
                                return (
                                    <div
                                        key={info.waybill}
                                        onClick={() => handleSelectWaybill(info.waybill)}
                                        onMouseEnter={() => prefetchIssue(info.waybill)}
                                        className={`rounded-xl border cursor-pointer transition-all duration-150 px-3.5 py-2.5 slide-in relative overflow-hidden ${
                                            isSelected
                                                ? "bg-indigo-50 border-indigo-300 shadow-sm"
                                                : info.stocktakingStatus === "checked"
                                                    ? "bg-emerald-50/60 border-emerald-200 hover:border-emerald-300"
                                                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                                        }`}
                                    >
                                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl" />}
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`mono font-bold text-xs ${isSelected ? "text-indigo-700" : "text-slate-800"}`}>
                                                {info.waybill}
                                            </span>
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${badge.cls}`}>
                                                {badge.icon}
                                                {badge.label}
                                            </span>
                                        </div>
                                        {info.stocktakingStatus === "not_checked" && info.latestScanTypeName && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <Circle className="w-2 h-2 text-amber-400 fill-amber-400 flex-shrink-0" />
                                                <span className="text-[11px] text-slate-500 truncate">{info.latestScanTypeName}</span>
                                                {info.latestScanTime && (
                                                    <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{formatTime(info.latestScanTime)}</span>
                                                )}
                                            </div>
                                        )}
                                        {info.stocktakingStatus === "checked" && info.stocktakingTime && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                                                <span className="text-[11px] text-emerald-600">{formatTime(info.stocktakingTime)}</span>
                                                {info.stocktakingNetworkCode && (
                                                    <span className="text-[10px] text-slate-400 ml-auto mono">{info.stocktakingNetworkCode}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Detail panel ── */}
                    <div className="flex-1 flex overflow-hidden">
                        {!selectedWaybill || !selectedInfo ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-50">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Warehouse className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-500">Chọn một vận đơn để xem chi tiết</p>
                                <p className="text-xs text-slate-400 mt-1">{filtered.length} vận đơn trong danh sách</p>
                            </div>
                        ) : (
                            // key=contentKey để trigger fade animation, KHÔNG dùng key=selectedWaybill
                            <div
                                key={contentKey}
                                className={`flex flex-1 overflow-hidden transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100 content-fade'}`}
                            >
                                {/* Left: summary info — skeleton khi transition */}
                                {isTransitioning ? (
                                    <DetailPanelSkeleton />
                                ) : (
                                    <div className="w-60 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto px-4 py-4 space-y-3">
                                        <div className={`rounded-xl border p-4 ${
                                            selectedInfo.stocktakingStatus === "checked"
                                                ? "bg-emerald-50 border-emerald-200"
                                                : "bg-amber-50 border-amber-200"
                                        }`}>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Mã vận đơn</p>
                                            <p className="mono font-bold text-base text-slate-800 mb-2 break-all">{selectedInfo.waybill}</p>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${STATUS_BADGE[selectedInfo.stocktakingStatus].cls}`}>
                                                {STATUS_BADGE[selectedInfo.stocktakingStatus].icon}
                                                {STATUS_BADGE[selectedInfo.stocktakingStatus].label}
                                            </span>
                                        </div>

                                        {selectedInfo.stocktakingStatus === "checked" && (
                                            <div className="bg-white rounded-xl border border-emerald-200 p-3 space-y-2">
                                                <p className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    Kiểm tồn ngày {selectedDate}
                                                </p>
                                                <InfoField label="Thời gian"    value={formatTime(selectedInfo.stocktakingTime)} />
                                                <InfoField label="Mã mạng lưới" value={selectedInfo.stocktakingNetworkCode || "—"} mono />
                                            </div>
                                        )}

                                        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                            <p className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                Trạng thái cuối
                                            </p>
                                            <InfoField label="Trạng thái"   value={selectedInfo.latestScanTypeName || "—"} />
                                            <InfoField label="Thời gian"    value={formatTime(selectedInfo.latestScanTime)} />
                                            <InfoField label="Mã mạng lưới" value={selectedInfo.latestScanNetworkCode || "—"} mono />
                                        </div>
                                    </div>
                                )}

                                {/* Right: pod + issue history (không dùng key= → không unmount) */}
                                <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden bg-slate-50">
                                    <div className="flex-[2] min-h-0">
                                        <PodHistory
                                            waybill={selectedWaybill}
                                            authToken={authToken}
                                            cache={detailCacheRef.current.get(selectedWaybill)}
                                        />
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <IssueHistory
                                            waybill={selectedWaybill}
                                            authToken={authToken}
                                            cache={detailCacheRef.current.get(selectedWaybill)}
                                        />
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

// ─── Sub-components ────────────────────────────────────────────────────────────
function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`text-xs font-semibold text-slate-700 truncate ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
    );
}