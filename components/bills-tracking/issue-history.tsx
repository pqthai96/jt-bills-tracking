"use client";

import React, { useEffect, useState } from 'react';
import axios from "axios";
import { AlertCircle } from "lucide-react";
import { DetailCache } from "@/components/bills-tracking/bills-tracking-section";

// ─── Font loader ──────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        body, body * { font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; }
    `}</style>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TableSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <tbody className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
                <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded animate-pulse w-28" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded animate-pulse w-20" /></td>
                <td className="px-4 py-3"><div className="h-5 bg-rose-100 rounded-lg animate-pulse w-24" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-40" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-16 mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-20 mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-24 mx-auto" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-32 mx-auto" /></td>
            </tr>
        ))}
        </tbody>
    );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function getIssueTypeColor(issueType: string): string {
    const lower = issueType?.toLowerCase() || '';
    if (lower.includes('hư hỏng') || lower.includes('vỡ'))  return 'bg-red-100 text-red-700 border border-red-200';
    if (lower.includes('thiếu') || lower.includes('mất'))    return 'bg-orange-100 text-orange-700 border border-orange-200';
    if (lower.includes('sai') || lower.includes('nhầm'))     return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (lower.includes('chậm') || lower.includes('trễ'))     return 'bg-blue-100 text-blue-700 border border-blue-200';
    return 'bg-rose-100 text-rose-700 border border-rose-200';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function IssueHistory({
                          waybill,
                          authToken,
                          cache,
                      }: {
    waybill: any;
    authToken: string;
    cache?: DetailCache;
}) {
    const [issueHistory, setIssueHistory] = useState<any[]>(cache?.issueHistory ?? []);
    const [loading, setLoading]           = useState(!cache?.issueHistory);

    useEffect(() => {
        if (cache?.issueHistory) {
            setIssueHistory(cache.issueHistory);
            setLoading(false);
            return;
        }
        setLoading(true);
        setIssueHistory([]);
        axios.post(
            "https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList",
            { current: 1, size: 100, waybillId: waybill, countryId: "1" },
            { headers: { authToken, lang: 'VN', langType: 'VN' } }
        ).then((resp: any) => {
            setIssueHistory(resp.data?.data?.records ?? []);
        }).finally(() => setLoading(false));
    }, [waybill]);

    return (
        <>
            <FontLoader />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                    <div className="w-6 h-6 bg-rose-100 rounded-md flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">Lịch sử kiện vấn đề</span>
                    {!loading && issueHistory.length > 0 && (
                        <span className="ml-auto text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                            {issueHistory.length} vấn đề
                        </span>
                    )}
                    {loading && (
                        <div className="ml-auto w-4 h-4 border-2 border-slate-200 border-t-rose-500 rounded-full animate-spin" />
                    )}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            {["Mã vận đơn", "Mã phân loại KVĐ", "Loại KVĐ", "Mô tả KVĐ", "Mã NV quét", "Tên NV quét", "Bưu cục thao tác", "Thời gian thao tác"].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        {loading ? (
                            <TableSkeleton rows={3} />
                        ) : (
                            <tbody className="divide-y divide-slate-100">
                            {issueHistory.map((row: any, index) => (
                                <tr key={index} className="hover:bg-slate-50/80 transition-colors align-top">
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.waybillId}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.abnormalPieceCode}</td>
                                    <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${getIssueTypeColor(row.abnormalPieceName)}`}>
                                                {row.abnormalPieceName}
                                            </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 text-xs leading-relaxed">{row.probleDescription}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600 text-center">{row.operatorCode}</td>
                                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 text-center">{row.operatorName}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="text-xs font-mono text-slate-700">{row.scanNetworkCode}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{row.scanNetworkName}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500 text-center whitespace-nowrap">{row.dataCollectionTime}</td>
                                </tr>
                            ))}
                            </tbody>
                        )}
                    </table>

                    {!loading && issueHistory.length === 0 && (
                        <div className="text-center py-12">
                            <AlertCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="font-semibold text-slate-400 text-sm">Không có kiện vấn đề</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default IssueHistory;