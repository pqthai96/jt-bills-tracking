"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Copy, Search, Filter, RotateCcw, Package,
    Clock, CheckCircle, AlertCircle,
    ChevronLeft, ChevronRight, Square, CheckSquare, ArrowLeft, Truck, Check, Timer
} from 'lucide-react';

import {
    SCAN_TYPE_OPTIONS,
    ITEMS_PER_PAGE_OPTIONS,
    DEFAULT_ITEMS_PER_PAGE,
    DEFAULT_PAGE,
    PAGINATION_SHOW_PAGES,
    getStatusColor
} from "@/lib/constants";
import {
    calculateStoppedDays,
    translateScanType,
    getScanTypeColor,
    copyToClipboard,
    validateDates,
    getPageNumbers,
    detectStoredToken
} from "@/utils/utils";
import {
    createApiService,
    type BillData,
    type BillWithStatus
} from "@/api-client/apiService";
import {NETWORK_CODE_STORAGE_KEY} from "@/lib/networkCode";

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

// ─── Constants cho tính năng mới ────────────────────────────────────────────
const MAX_RANGE_DAYS = 7;

// ─── Helper: phân loại đơn truyền thống / đơn sàn theo tiền tố mã vận đơn ───
function isTraditionalOrder(billCode: string): boolean {
    const prefix = (billCode || '').substring(0, 2);
    return prefix === "80" || prefix === "84";
}

// ─── Helper: giới hạn khoảng ngày tối đa MAX_RANGE_DAYS ngày ────────────────
// Trả về { end, wasClamped } — nếu khoảng cách start→end > MAX_RANGE_DAYS thì
// tự động kéo end về đúng start + MAX_RANGE_DAYS ngày.
function clampDateRange(start: string, end: string): { end: string; wasClamped: boolean } {
    const startD = new Date(start);
    const endD = new Date(end);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return { end, wasClamped: false };

    const diffDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > MAX_RANGE_DAYS) {
        const clamped = new Date(startD);
        clamped.setDate(clamped.getDate() + MAX_RANGE_DAYS);
        return { end: clamped.toISOString().split('T')[0], wasClamped: true };
    }
    return { end, wasClamped: false };
}

// ─── Helper: format thời gian đã trôi qua ────────────────────────────────────
function formatElapsed(ms: number): string {
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const rem = Math.round(s % 60);
    return `${m}p ${rem}s`;
}

// ─── Helper: format ETA (thời gian còn lại ước tính) ────────────────────────
function formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}p ${s}s` : `${m}p`;
}

// ─── Tiến độ tải dữ liệu ─────────────────────────────────────────────────────
interface LoadProgress {
    total: number;
    done: number;
}

// ─── Progress bar tải dữ liệu ────────────────────────────────────────────────
function LoadProgressBar({ progress, elapsedMs }: { progress: LoadProgress; elapsedMs: number }) {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                    <span className="text-sm font-bold text-violet-700">
                        Đang tải dữ liệu...
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-violet-500 font-semibold">
                    <Timer className="w-3.5 h-3.5" />
                    {pct >= 100 ? (
                        <span className="text-emerald-600">Hoàn tất!</span>
                    ) : (
                        <span className="text-violet-700">{pct}%</span>
                    )}
                </div>
            </div>
            <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-300 ease-out progress-shimmer"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function Page() {
    const router = useRouter();

    const [authToken, setAuthToken]             = useState<string>('');
    const [startTime, setStartTime]             = useState<string>((new Date()).toISOString().split('T')[0]);
    const [networkCode, setNetworkCode] = useState<any>({code: "028M08", label: "028M08", agentCode: "028001"});
    const [endTime, setEndTime]                 = useState<string>((new Date()).toISOString().split('T')[0]);
    const [dateError, setDateError]             = useState<string>('');
    const [rangeClampNotice, setRangeClampNotice] = useState<string>('');
    const [allBills, setAllBills]               = useState<BillData[]>([]);
    const [allBillsWithStatus, setAllBillsWithStatus] = useState<BillWithStatus[]>([]);
    const [filteredBills, setFilteredBills]     = useState<BillWithStatus[]>([]);
    const [loading, setLoading]                 = useState<boolean>(false);
    const [filterLoading, setFilterLoading]     = useState<boolean>(false);
    const [copiedBill, setCopiedBill]           = useState<string>('');
    const [selectedScanTypes, setSelectedScanTypes] = useState<string[]>([]);
    const [stoppedDays, setStoppedDays]         = useState<number>(0);
    const [currentPage, setCurrentPage]         = useState<number>(DEFAULT_PAGE);
    const [itemsPerPage, setItemsPerPage]       = useState<number>(DEFAULT_ITEMS_PER_PAGE);

    // ── Filter đơn truyền thống / đơn sàn ──
    const [showTraditional, setShowTraditional] = useState<boolean>(true);
    const [showEcommerce, setShowEcommerce]     = useState<boolean>(true);

    // ── Copy tất cả mã vận đơn ──
    const [copiedAll, setCopiedAll] = useState<'all' | 'filtered' | ''>('');

    // ── Đếm thời gian tải dữ liệu ──
    const [elapsedMs, setElapsedMs]       = useState<number>(0);
    const [fetchDurationMs, setFetchDurationMs] = useState<number | null>(null);
    const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const totalPages   = Math.ceil(filteredBills.length / itemsPerPage);
    const startIndex   = (currentPage - 1) * itemsPerPage;
    const endIndex     = startIndex + itemsPerPage;
    const currentBills = filteredBills.slice(startIndex, endIndex);

    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        const savedNetworkCode = localStorage.getItem(NETWORK_CODE_STORAGE_KEY);
        if (!ylToken) { router.push('/'); return; }
        setAuthToken(ylToken);
        if (savedNetworkCode) setNetworkCode(savedNetworkCode);
    }, [router]);

    useEffect(() => {
        const token = detectStoredToken();
        if (token) setAuthToken(token);
        const handler = (e: StorageEvent) => {
            if (e.key && e.newValue && e.key.toLowerCase().includes('token')) setAuthToken(e.newValue);
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    useEffect(() => { setCurrentPage(DEFAULT_PAGE); }, [filteredBills, itemsPerPage]);

    // Dọn timer khi unmount
    useEffect(() => {
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, []);

    const handleStartDateChange = (v: string) => {
        setStartTime(v);
        const { end, wasClamped } = clampDateRange(v, endTime);
        if (wasClamped) {
            setEndTime(end);
            setRangeClampNotice(`Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày — đã tự điều chỉnh ngày kết thúc.`);
        } else {
            setRangeClampNotice('');
        }
        setDateError(validateDates(v, end).error);
    };

    const handleEndDateChange = (v: string) => {
        const { end, wasClamped } = clampDateRange(startTime, v);
        setEndTime(end);
        if (wasClamped) {
            setRangeClampNotice(`Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày — đã tự điều chỉnh ngày kết thúc.`);
        } else {
            setRangeClampNotice('');
        }
        setDateError(validateDates(startTime, end).error);
    };

    useEffect(() => {
        if (!rangeClampNotice) return;
        const t = setTimeout(() => setRangeClampNotice(''), 3500);
        return () => clearTimeout(t);
    }, [rangeClampNotice]);

    const getSumData = async () => {
        const validation = validateDates(startTime, endTime);
        if (!validation.isValid) { setDateError(validation.error); return; }

        setLoading(true);
        setFetchDurationMs(null);
        setElapsedMs(0);
        setLoadProgress(null);
        const startedAt = Date.now();
        timerIntervalRef.current = setInterval(() => {
            setElapsedMs(Date.now() - startedAt);
        }, 100);

        try {
            const api  = createApiService(authToken);
            const data = await api.getAllBillsData(startTime, endTime, networkCode.agentCode, (done, total) => {
                setLoadProgress({ total, done });
            });
            setAllBills(data.allBills);
            setAllBillsWithStatus(data.billsWithStatus);
        } catch { setAllBills([]); setAllBillsWithStatus([]); }
        finally  {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setFetchDurationMs(Date.now() - startedAt);
            setLoading(false);
            setLoadProgress(null);
        }
    };

    const handleCopyToClipboard = async (text: string) => {
        if (await copyToClipboard(text)) {
            setCopiedBill(text);
            setTimeout(() => setCopiedBill(''), 2000);
        }
    };

    const handleCopyAllCodes = async (source: 'all' | 'filtered') => {
        const list = source === 'all' ? allBillsWithStatus : filteredBills;
        const text = list.map(i => i.billCode).join('\n');
        if (await copyToClipboard(text)) {
            setCopiedAll(source);
            setTimeout(() => setCopiedAll(''), 2000);
        }
    };

    const handleScanTypeChange = (t: string, c: boolean) =>
        setSelectedScanTypes(prev => c ? [...prev, t] : prev.filter(x => x !== t));
    const selectAllScanTypes   = () => setSelectedScanTypes([...SCAN_TYPE_OPTIONS]);
    const deselectAllScanTypes = () => setSelectedScanTypes([]);
    const clearFilters = () => {
        setSelectedScanTypes([...SCAN_TYPE_OPTIONS]);
        setStoppedDays(0);
        setShowTraditional(true);
        setShowEcommerce(true);
    };

    useEffect(() => {
        const apply = async () => {
            setFilterLoading(true);
            await new Promise(r => setTimeout(r, 100));
            let f = [...allBillsWithStatus];
            if (selectedScanTypes.length > 0)
                f = f.filter(i => selectedScanTypes.includes(translateScanType(i.scanTypeName)));
            else f = [];
            if (stoppedDays > 0)
                f = f.filter(i => calculateStoppedDays(i.scanTime) >= stoppedDays);
            // Filter đơn truyền thống / đơn sàn
            f = f.filter(i => {
                const trad = isTraditionalOrder(i.billCode);
                if (trad && !showTraditional) return false;
                if (!trad && !showEcommerce) return false;
                return true;
            });
            setFilteredBills(f);
            setFilterLoading(false);
        };
        apply();
    }, [allBillsWithStatus, selectedScanTypes, stoppedDays, showTraditional, showEcommerce]);

    useEffect(() => {
        if (allBillsWithStatus.length > 0 && selectedScanTypes.length === 0)
            setSelectedScanTypes([...SCAN_TYPE_OPTIONS]);
    }, [allBillsWithStatus]);

    const goToPage     = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));
    const goToPrevPage = () => { if (currentPage > 1) setCurrentPage(c => c - 1); };
    const goToNextPage = () => { if (currentPage < totalPages) setCurrentPage(c => c + 1); };

    const hasData = allBillsWithStatus.length > 0;

    const traditionalCount = allBillsWithStatus.filter(i => isTraditionalOrder(i.billCode)).length;
    const ecommerceCount   = allBillsWithStatus.length - traditionalCount;

    return (
        <>
            <FontLoader />
            <div className="min-h-screen bg-slate-50">

                {/* ── Top bar ── */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                    <div className="max-w-[90%] mx-auto px-5 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/')}
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
                                <span className="font-bold text-slate-800 text-sm">Theo dõi đơn hàng nhận</span>
                            </div>
                        </div>

                        {hasData && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                                    {filteredBills.length} / {allBills.length} đơn
                                </span>
                                {filterLoading && <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />}
                            </div>
                        )}
                    </div>
                </div>

                <div className="max-w-[90%] mx-auto px-5 py-8 space-y-5">

                    {/* ── Search Card ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-400" />
                            <span className="font-bold text-slate-700 text-sm">Tìm kiếm</span>
                            <span className="ml-auto text-[11px] font-semibold text-slate-400">
                                Tối đa {MAX_RANGE_DAYS} ngày / lần tìm
                            </span>
                        </div>
                        <div className="p-6">
                            {/* items-end: 3 cột luôn thẳng hàng ở đáy, không bị lệch khi cột giữa
                                hiện thông báo lỗi (thông báo lỗi được đặt absolute bên dưới, xem cột 2) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Ngày bắt đầu</label>
                                    <input type="date" value={startTime}
                                           onChange={e => handleStartDateChange(e.target.value)}
                                           className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all ${dateError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Ngày kết thúc</label>
                                    <input type="date" value={endTime}
                                           onChange={e => handleEndDateChange(e.target.value)}
                                           className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all ${dateError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                    />
                                    {/* absolute: không chiếm chỗ trong layout -> không kéo giãn hàng grid,
                                        nhờ đó nút "Lấy dữ liệu" ở cột 3 không bị đẩy xuống khi có lỗi */}
                                    {dateError && (
                                        <p className="absolute top-full left-0 mt-1.5 flex items-center gap-1 text-xs text-red-500 whitespace-nowrap">
                                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{dateError}
                                        </p>
                                    )}
                                    {!dateError && rangeClampNotice && (
                                        <p className="absolute top-full left-0 mt-1.5 flex items-center gap-1 text-xs text-amber-600 animate-fade-in whitespace-nowrap">
                                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{rangeClampNotice}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <button onClick={getSumData} disabled={loading || !!dateError}
                                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm">
                                        {loading
                                            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang tải... {formatElapsed(elapsedMs)}</>
                                            : <><Search className="w-4 h-4" />Lấy dữ liệu</>}
                                    </button>
                                </div>
                            </div>
                            {!loading && fetchDurationMs !== null && (
                                <p className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-3">
                                    <Timer className="w-3.5 h-3.5" />
                                    Lần tải gần nhất mất {formatElapsed(fetchDurationMs)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Loading ── */}
                    {loading && (
                        loadProgress ? (
                            <LoadProgressBar progress={loadProgress} elapsedMs={elapsedMs} />
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-4">
                                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                <p className="font-semibold text-slate-700">Đang tải dữ liệu...</p>
                                <p className="text-sm font-bold text-blue-600">{formatElapsed(elapsedMs)}</p>
                            </div>
                        )
                    )}

                    {/* ── Stats ── */}
                    {allBills.length > 0 && hasData && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                                { label: "Tổng đơn hàng", value: allBills.length,        icon: Package,      color: "bg-blue-50 border-blue-100 text-blue-600",    iconColor: "text-blue-400" },
                                { label: "Sau lọc",        value: filteredBills.length,   icon: CheckCircle,  color: "bg-emerald-50 border-emerald-100 text-emerald-600", iconColor: "text-emerald-400" },
                                { label: "Trang hiện tại", value: `${currentPage}/${totalPages}`, icon: Filter, color: "bg-violet-50 border-violet-100 text-violet-600", iconColor: "text-violet-400" },
                                { label: "Dừng hành trình",
                                    value: stoppedDays > 0 ? filteredBills.filter(i => calculateStoppedDays(i.scanTime) >= stoppedDays).length : 0,
                                    icon: AlertCircle, color: "bg-orange-50 border-orange-100 text-orange-600", iconColor: "text-orange-400" },
                            ].map(({ label, value, icon: Icon, color, iconColor }) => (
                                <div key={label} className={`rounded-xl border p-4 flex items-center justify-between ${color}`}>
                                    <div>
                                        <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{label}</p>
                                        <p className="text-2xl font-bold mt-0.5">{value}</p>
                                    </div>
                                    <Icon className={`w-8 h-8 opacity-40 ${iconColor}`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Filters ── */}
                    {hasData && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <span className="font-bold text-slate-700 text-sm">Bộ lọc</span>
                                    {filterLoading && <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />}
                                </div>
                                <button onClick={clearFilters}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all">
                                    <RotateCcw className="w-3.5 h-3.5" />Reset
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Loại đơn: truyền thống / đơn sàn  +  Đơn dừng hành trình — chung 1 hàng */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Package className="w-4 h-4 text-teal-600" />
                                            <span className="text-sm font-bold text-slate-700">Loại đơn</span>
                                        </div>
                                        <select
                                            value={showTraditional && showEcommerce ? 'all' : showTraditional ? 'traditional' : 'ecommerce'}
                                            onChange={e => {
                                                const v = e.target.value;
                                                if (v === 'traditional') { setShowTraditional(true); setShowEcommerce(false); }
                                                else if (v === 'ecommerce') { setShowTraditional(false); setShowEcommerce(true); }
                                                else { setShowTraditional(true); setShowEcommerce(true); }
                                            }}
                                            className="w-full border border-teal-200 bg-white rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 transition-all"
                                        >
                                            <option value="all">Tất cả đơn hàng</option>
                                            <option value="traditional">Truyền thống ({traditionalCount})</option>
                                            <option value="ecommerce">Đơn sàn ({ecommerceCount})</option>
                                        </select>
                                    </div>

                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm font-bold text-slate-700">Đơn dừng hành trình</span>
                                        </div>
                                        <select value={stoppedDays} onChange={e => setStoppedDays(parseInt(e.target.value))}
                                                className="w-full border border-amber-200 bg-white rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all">
                                            <option value={0}>Tất cả đơn hàng</option>
                                            <option value={1}>Dừng hành trình ≥ 1 ngày</option>
                                            <option value={2}>Dừng hành trình ≥ 2 ngày</option>
                                            <option value={3}>Dừng hành trình ≥ 3 ngày</option>
                                            <option value={5}>Dừng hành trình ≥ 5 ngày</option>
                                            <option value={7}>Dừng hành trình ≥ 7 ngày</option>
                                            <option value={10}>Dừng hành trình ≥ 10 ngày</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Scan type */}
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-bold text-slate-700">Lọc theo loại quét cuối cùng</span>
                                            {filterLoading && <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={selectAllScanTypes}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                                <CheckSquare className="w-3 h-3" />Tất cả
                                            </button>
                                            <button onClick={deselectAllScanTypes}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors">
                                                <Square className="w-3 h-3" />Bỏ chọn
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {SCAN_TYPE_OPTIONS.map(scanType => (
                                            <label key={scanType} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-blue-100 hover:border-blue-300 cursor-pointer transition-all">
                                                <input type="checkbox"
                                                       checked={selectedScanTypes.includes(scanType)}
                                                       onChange={e => handleScanTypeChange(scanType, e.target.checked)}
                                                       className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-slate-700 select-none">{scanType}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-blue-600 font-semibold mt-3">
                                        Hiển thị: {selectedScanTypes.length}/{SCAN_TYPE_OPTIONS.length} loại quét
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Pagination top / Hiển thị (chứa nút copy mã vận đơn) ── */}
                    {filteredBills.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hiển thị</span>
                                <select value={itemsPerPage} onChange={e => setItemsPerPage(parseInt(e.target.value))}
                                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all">
                                    {ITEMS_PER_PAGE_OPTIONS.map(o => (
                                        <option key={o} value={o}>{o} đơn/trang</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3 lg:ml-auto">
                                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                    {startIndex + 1}–{Math.min(endIndex, filteredBills.length)} / {filteredBills.length} đơn hàng
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── Table ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <div className="max-h-[800px] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th key="Mã vận đơn" className="px-3.5 py-3.5 text-left text-xs font-bold flex items-center gap-2 text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                            Mã vận đơn
                                            <button
                                                onClick={() => handleCopyAllCodes('filtered')}
                                                title="Copy mã vận đơn sau khi lọc"
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                                    copiedAll === 'filtered'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
                                                }`}
                                            >
                                                {copiedAll === 'filtered'
                                                    ? <><Check className="w-3.5 h-3.5" />Copied!</>
                                                    : <><Copy className="w-3.5 h-3.5" />({filteredBills.length})</>}
                                            </button>
                                        </th>
                                        {["Trạng thái hiện tại", "Thời gian thao tác", "BC thao tác", "Người thao tác", "Loại quét cuối", "Số ngày dừng"].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                    {currentBills.map((item, index) => {
                                        const daysStopped    = calculateStoppedDays(item.scanTime);
                                        const statusColor    = getStatusColor(daysStopped);
                                        const translatedType = translateScanType(item.scanTypeName);
                                        const scanTypeColor  = getScanTypeColor(translatedType);

                                        return (
                                            <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-semibold text-slate-800">{item.billCode}</span>
                                                        <button onClick={() => handleCopyToClipboard(item.billCode)}
                                                                className="p-1 rounded-md hover:bg-slate-100 transition-colors group" title="Copy mã vận đơn">
                                                            <Copy className={`w-3 h-3 transition-colors ${copiedBill === item.billCode ? 'text-emerald-500' : 'text-slate-300 group-hover:text-slate-600'}`} />
                                                        </button>
                                                        {copiedBill === item.billCode && (
                                                            <span className="text-xs text-emerald-500 font-semibold animate-fade-in">Copied!</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600 text-xs min-w-[8rem] max-w-[24rem]">
                                                    {item.waybillTrackingContent}
                                                </td>
                                                <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-500 whitespace-nowrap">
                                                    {item.scanTime}
                                                </td>
                                                <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-600">
                                                    {item.scanNetworkCode}
                                                </td>
                                                <td className="px-5 py-3.5 text-center text-xs text-slate-600 max-w-[7rem]">
                                                        <span className="truncate block" title={item.scanByName === "机器人" ? "Đang chuyển hoàn" : item.scanByName}>
                                                            {item.scanByName === "机器人" ? "Đang chuyển hoàn" : item.scanByName}
                                                        </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-semibold block w-full text-center truncate ${scanTypeColor}`} title={translatedType}>
                                                            {translatedType}
                                                        </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                                                            {daysStopped} ngày
                                                        </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>

                                {filteredBills.length === 0 && hasData && (
                                    <div className="text-center py-16">
                                        <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <p className="font-semibold text-slate-500">Không tìm thấy dữ liệu</p>
                                        <p className="text-xs text-slate-400 mt-1">Không có dữ liệu phù hợp với bộ lọc hiện tại</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Pagination bottom ── */}
                    {filteredBills.length > 0 && totalPages > 1 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex justify-center">
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => goToPage(1)} disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    Đầu
                                </button>
                                <button onClick={goToPrevPage} disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                                </button>
                                {getPageNumbers(currentPage, totalPages, PAGINATION_SHOW_PAGES).map(pageNum => (
                                    <button key={pageNum} onClick={() => goToPage(pageNum)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                pageNum === currentPage
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                                            }`}>
                                        {pageNum}
                                    </button>
                                ))}
                                <button onClick={goToNextPage} disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                </button>
                                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    Cuối
                                </button>
                            </div>
                        </div>
                    )}

                    <p className="text-center text-xs text-slate-300 pb-2">
                        JT Express Internal Tool · {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </>
    );
}

export default Page;