"use client";

import React, {useState, useRef, useCallback} from "react";
import axios from "axios";
// @ts-ignore
import type {AxiosResponse} from "axios";
import {X, Play, RotateCcw, CheckCircle2, XCircle, Loader2, ClipboardPaste, Package, ArrowLeft, AlertTriangle} from "lucide-react";

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
                #6d28d9 0%, #8b5cf6 40%, #a78bfa 50%, #8b5cf6 60%, #6d28d9 100%
            );
            background-size: 200% auto;
            animation: progress-shimmer 1.8s linear infinite;
        }
    `}</style>
);

const BATCH_SIZE = 3;
const RETRY_MAX = 2;
const RETRY_DELAY_MS = 600;

type BillStatus = "pending" | "running" | "success" | "error" | "partial" | "complaint";

interface BillResult {
    waybill: string;
    status: BillStatus;
    api1: { ok: boolean; msg: string } | null;
    api2: { ok: boolean; msg: string } | null;
}

// Modal hiển thị danh sách mã dính khiếu nại
type FilterView = "all" | "complaint";

async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, max = RETRY_MAX): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i <= max; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i < max) await sleep(RETRY_DELAY_MS * (i + 1));
        }
    }
    throw lastErr;
}

function extractMsg(resp: AxiosResponse): string {
    return resp?.data?.msg || resp?.data?.message || resp?.data?.remark || (resp?.data?.success ? "Thành công" : "Thất bại");
}

function isSuccessMsg(resp: AxiosResponse): boolean {
    const msg: string = resp?.data?.msg || resp?.data?.message || "";
    return msg.includes("Thao tác thành công");
}

function isComplaintMsg(msg: string): boolean {
    return msg.includes("phiếu khiếu nại");
}

function isApi1Success(resp: AxiosResponse): boolean {
    const d = resp?.data;
    if (!d) return false;
    if (isSuccessMsg(resp)) return true;
    if (typeof d.success === "boolean") return d.success;
    if (d.code !== undefined) return d.code === 0 || d.code === 200 || d.code === "0" || d.code === "200";
    return true;
}

function isApi2DKCHSuccess(resp: AxiosResponse): boolean {
    return isSuccessMsg(resp);
}

export default function RebackTransfer() {
    const [inputText, setInputText] = useState("");
    const [parsedCodes, setParsedCodes] = useState<string[]>([]);
    const [results, setResults] = useState<BillResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [done, setDone] = useState(0);
    const [filterView, setFilterView] = useState<FilterView>("all");
    const abortRef = useRef(false);

    const authToken = typeof window !== "undefined" ? (localStorage.getItem("YL_TOKEN") ?? "") : "";

    const authHeaders = {
        authToken: authToken,
        lang: "VN",
        langType: "VN",
    };

    const handleInputChange = (value: string) => {
        setInputText(value);
        const raw = value.split(/[\s\n,;|]+/).map(s => s.trim()).filter(Boolean);
        const codes: string[] = [];
        raw.forEach(token => {
            if (/^\d{12}$/.test(token)) {
                codes.push(token);
            } else if (/^\d{13,}$/.test(token)) {
                for (let i = 0; i < token.length; i += 12) {
                    const chunk = token.substr(i, 12);
                    if (chunk.length === 12) codes.push(chunk);
                }
            }
        });
        setParsedCodes(Array.from(new Set(codes)));
    };

    const removeCode = (code: string) =>
        setParsedCodes(prev => prev.filter(c => c !== code));

    const handleReset = () => {
        abortRef.current = true;
        setInputText("");
        setParsedCodes([]);
        setResults([]);
        setDone(0);
        setIsRunning(false);
        setFilterView("all");
    };

    const runReback = useCallback(async () => {
        if (parsedCodes.length === 0 || isRunning) return;

        abortRef.current = false;
        setIsRunning(true);
        setDone(0);
        setFilterView("all");

        const initial: BillResult[] = parsedCodes.map(w => ({
            waybill: w, status: "pending", api1: null, api2: null,
        }));
        setResults(initial);

        const updateResult = (waybill: string, patch: Partial<BillResult>) => {
            setResults(prev => prev.map(r => r.waybill === waybill ? {...r, ...patch} : r));
        };

        let doneCount = 0;

        for (let i = 0; i < parsedCodes.length; i += BATCH_SIZE) {
            if (abortRef.current) break;
            const batch = parsedCodes.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (waybill) => {
                if (abortRef.current) return;

                updateResult(waybill, {status: "running"});

                let api1Result: { ok: boolean; msg: string };
                let api2Result: { ok: boolean; msg: string };

                try {
                    const firstResp = await withRetry(() =>
                        axios.get(
                            `https://jmsgw.jtexpress.vn/operatingplatform/rebackTransferExpress/findByWaybillNo?waybillNo=${waybill}&applyTypeCode=4`,
                            {headers: authHeaders}
                        ) as Promise<AxiosResponse>
                    );

                    const rebackTypeCode = firstResp.data?.data?.code;

                    const resp = await withRetry(() =>
                        axios.post(
                            "https://jmsgw.jtexpress.vn/operatingplatform/rebackTransferExpress/add",
                            {waybillNo: waybill, applyTypeCode: 4, rebackTypeCode: rebackTypeCode},
                            {headers: authHeaders}
                        ) as Promise<AxiosResponse>
                    );
                    api1Result = {ok: isApi1Success(resp), msg: extractMsg(resp)};
                } catch (e: any) {
                    const errMsg = e?.response?.data?.msg || e?.response?.data?.message || e?.message || "Lỗi kết nối";
                    api1Result = {ok: false, msg: errMsg};
                }

                try {
                    const resp = await withRetry(() =>
                        axios.post(
                            "https://jmsgw.jtexpress.vn/operatingplatform/rebackTransferExpress/registerSecondReback",
                            {waybillNo: waybill, applyTypeCode: 6},
                            {headers: authHeaders}
                        ) as Promise<AxiosResponse>
                    );
                    api2Result = {ok: isApi2DKCHSuccess(resp), msg: extractMsg(resp)};
                } catch (e: any) {
                    const errMsg = e?.response?.data?.msg || e?.response?.data?.message || e?.message || "Lỗi kết nối";
                    api2Result = {ok: false, msg: errMsg};
                }

                // Xác định status cuối
                // Ưu tiên: nếu bất kỳ API nào thành công → success
                // Nếu cả 2 đều lỗi khiếu nại → complaint
                // Còn lại → error
                let finalStatus: BillStatus;
                if (api1Result.ok || api2Result.ok) {
                    finalStatus = "success";
                } else if (isComplaintMsg(api1Result.msg) || isComplaintMsg(api2Result.msg)) {
                    finalStatus = "complaint";
                } else {
                    finalStatus = "error";
                }

                updateResult(waybill, {status: finalStatus, api1: api1Result, api2: api2Result});

                doneCount++;
                setDone(doneCount);
            }));
        }

        setIsRunning(false);
    }, [parsedCodes, isRunning]);

    const total = parsedCodes.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;
    const complaintCount = results.filter(r => r.status === "complaint").length;
    const pendingCount = results.filter(r => r.status === "pending" || r.status === "running").length;
    const hasResults = results.length > 0;

    // Danh sách hiển thị theo filter
    const displayedResults = filterView === "complaint"
        ? results.filter(r => r.status === "complaint")
        : results;

    const StatusBadge = ({status}: { status: BillStatus }) => {
        const map: Record<BillStatus, { cls: string; label: string }> = {
            pending: {cls: "bg-slate-100 text-slate-400 border-slate-200", label: "Chờ"},
            running: {cls: "bg-violet-100 text-violet-700 border-violet-200", label: "Đang chạy..."},
            success: {cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Thành công"},
            partial: {cls: "bg-amber-100 text-amber-700 border-amber-200", label: "Một phần"},
            error: {cls: "bg-rose-100 text-rose-700 border-rose-200", label: "Lỗi"},
            complaint: {cls: "bg-orange-100 text-orange-700 border-orange-200", label: "Dính khiếu nại"},
        };
        const {cls, label} = map[status];
        return (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${cls}`}>
                {status === "running"
                    ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin inline"/>{label}</span>
                    : label
                }
            </span>
        );
    };

    const ApiPill = ({label, result}: { label: string; result: { ok: boolean; msg: string } | null }) => {
        if (!result) return (
            <span className="text-[11px] text-slate-300 font-medium">{label}: —</span>
        );
        return (
            <span className={`flex items-start gap-1 text-[11px] font-semibold ${result.ok ? "text-emerald-600" : "text-rose-500"}`}>
                {result.ok
                    ? <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5"/>
                    : <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5"/>
                }
                <span className="font-bold whitespace-nowrap">{label}:</span>
                <span className="font-medium break-words">{result.msg}</span>
            </span>
        );
    };

    return (
        <>
            <FontLoader/>
            <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-5 h-12 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors text-sm font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4"/>
                            Quay lại
                        </button>
                        <div className="w-px h-5 bg-slate-200"/>
                        <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Package className="w-3.5 h-3.5 text-amber-600"/>
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Đăng ký chuyển hoàn (ĐKCH)</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">JT Express Internal Tool</span>
                </div>

                <div className="flex flex-1 overflow-hidden">

                    {/* Sidebar */}
                    <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">

                        {/* Input */}
                        <div className="px-4 pt-4 pb-2 flex flex-col gap-2 flex-shrink-0">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                Nhập mã vận đơn
                            </label>
                            <textarea
                                value={inputText}
                                onChange={e => handleInputChange(e.target.value)}
                                placeholder={"Paste mã vận đơn vào đây...\n(12 số, mỗi dòng / cách nhau dấu cách)"}
                                className="h-32 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 text-sm resize-none px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all"
                                disabled={isRunning}
                            />
                        </div>

                        {/* Parsed codes list */}
                        {parsedCodes.length > 0 && (
                            <div className="flex flex-col gap-1.5 px-4 py-2 flex-1 min-h-0 overflow-hidden">
                                <div className="flex items-center justify-between flex-shrink-0">
                                    <span className="text-xs font-bold text-slate-500">{parsedCodes.length} mã đã nhận</span>
                                    {!isRunning && (
                                        <button
                                            onClick={() => setParsedCodes([])}
                                            className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold transition-colors"
                                        >
                                            Xoá tất cả
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                                    {parsedCodes.map(code => (
                                        <div key={code} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 animate-fade-in">
                                            <span className="text-xs font-mono font-bold text-amber-800">{code}</span>
                                            {!isRunning && (
                                                <button onClick={() => removeCode(code)} className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
                                                    <X className="w-3.5 h-3.5"/>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="px-4 py-3 flex gap-2 flex-shrink-0 border-t border-slate-100">
                            <button
                                onClick={runReback}
                                disabled={parsedCodes.length === 0 || isRunning}
                                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
                            >
                                {isRunning
                                    ? <><Loader2 className="w-4 h-4 animate-spin"/>Đang chạy...</>
                                    : <><Play className="w-4 h-4"/>ĐKCH ({parsedCodes.length})</>
                                }
                            </button>
                            <button
                                onClick={handleReset}
                                title="Reset"
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition-all active:scale-95"
                            >
                                <RotateCcw className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* Stats */}
                        {hasResults && (
                            <div className="border-t border-slate-100 px-3 py-3 flex flex-col gap-2 flex-shrink-0">
                                {/* Row 1: success + error + pending */}
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        {label: "Thành công", count: successCount, cls: "text-emerald-600", active: false, onClick: undefined},
                                        {label: "Lỗi / Từ chối", count: errorCount, cls: "text-rose-500", active: false, onClick: undefined},
                                        {label: "Còn lại", count: pendingCount, cls: "text-slate-400", active: false, onClick: undefined},
                                    ].map(s => (
                                        <div key={s.label} className="text-center">
                                            <div className={`text-xl font-extrabold ${s.cls}`}>{s.count}</div>
                                            <div className="text-[10px] text-slate-400 font-semibold">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Row 2: complaint — chỉ hiện khi có */}
                                {complaintCount > 0 && (
                                    <button
                                        onClick={() => setFilterView(v => v === "complaint" ? "all" : "complaint")}
                                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                                            filterView === "complaint"
                                                ? "bg-orange-100 border-orange-300 text-orange-700"
                                                : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/>
                                            <span className="text-xs font-bold">Dính phiếu khiếu nại</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-extrabold">{complaintCount}</span>
                                            <span className="text-[10px] font-semibold opacity-70">
                                                {filterView === "complaint" ? "← Xem tất cả" : "Xem mã →"}
                                            </span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Main panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">

                        {/* Progress bar */}
                        {isRunning && (
                            <div className="bg-violet-50 border-b border-violet-200 px-5 py-2.5 flex-shrink-0 animate-fade-in">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin"/>
                                        <span className="text-xs font-bold text-violet-700">
                                            Đang xử lý... {done}/{total} đơn
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-violet-700">{pct}%</span>
                                </div>
                                <div className="h-2 bg-violet-200/60 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300 ease-out progress-shimmer"
                                        style={{width: `${pct}%`}}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Filter banner khi đang lọc complaint */}
                        {filterView === "complaint" && complaintCount > 0 && (
                            <div className="bg-orange-50 border-b border-orange-200 px-5 py-2 flex items-center justify-between flex-shrink-0 animate-fade-in">
                                <div className="flex items-center gap-2 text-orange-700">
                                    <AlertTriangle className="w-3.5 h-3.5"/>
                                    <span className="text-xs font-bold">
                                        Hiển thị {complaintCount} mã dính phiếu khiếu nại
                                    </span>
                                </div>
                                <button
                                    onClick={() => setFilterView("all")}
                                    className="text-[11px] font-bold text-orange-500 hover:text-orange-700 transition-colors flex items-center gap-1"
                                >
                                    <X className="w-3 h-3"/> Bỏ lọc
                                </button>
                            </div>
                        )}

                        {/* Results list */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                            {!hasResults ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                                        <ClipboardPaste className="w-7 h-7 text-slate-300"/>
                                    </div>
                                    <p className="font-bold text-slate-400">Paste mã vận đơn và bấm ĐKCH</p>
                                    <p className="text-xs text-slate-300">Kết quả từng đơn sẽ hiển thị ở đây</p>
                                </div>
                            ) : displayedResults.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
                                        <AlertTriangle className="w-6 h-6 text-orange-300"/>
                                    </div>
                                    <p className="font-bold text-slate-400">Chưa có mã nào dính khiếu nại</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {displayedResults.map(r => (
                                        <div
                                            key={r.waybill}
                                            className={`rounded-xl border px-4 py-3 transition-all duration-200 animate-fade-in ${
                                                r.status === "success" ? "bg-emerald-50 border-emerald-200" :
                                                    r.status === "complaint" ? "bg-orange-50 border-orange-200" :
                                                        r.status === "error" ? "bg-rose-50 border-rose-200" :
                                                            r.status === "running" ? "bg-violet-50 border-violet-200" :
                                                                "bg-white border-slate-200"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-mono font-bold text-sm text-slate-800">{r.waybill}</span>
                                                <StatusBadge status={r.status}/>
                                            </div>
                                            {(r.api1 || r.api2) && (
                                                <div className="mt-2 flex flex-col gap-1">
                                                    <ApiPill label="ĐKCH lần 1" result={r.api1}/>
                                                    <ApiPill label="ĐKCH lần 2" result={r.api2}/>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}