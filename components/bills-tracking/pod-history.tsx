"use client";

import React, { useEffect, useState, useRef } from 'react';
import axios from "axios";
import { Clock, Image as ImageIcon, Video, X, ChevronLeft, ChevronRight } from "lucide-react";
import { DetailCache } from "@/components/bills-tracking/bills-tracking-section";

// ─── Font loader ──────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        body, body * { font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; }
    `}</style>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <tbody className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
                <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded animate-pulse w-32" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded animate-pulse w-32" /></td>
                <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded-lg animate-pulse w-24" /></td>
                <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-48" /></td>
                <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded-lg animate-pulse w-12 mx-auto" /></td>
            </tr>
        ))}
        </tbody>
    );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function getScanTypeColor(scanTypeName: string): string {
    const lower = scanTypeName.toLowerCase();
    if (scanTypeName === "Ký nhận CPN")         return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (scanTypeName === "Quét kiện vấn đề")    return "bg-rose-100 text-rose-700 border border-rose-200";
    if (lower.includes("xuống hàng") || lower.includes("kiện đến")) return "bg-blue-100 text-blue-700 border border-blue-200";
    if (lower.includes("kiểm tra") && lower.includes("tồn kho"))    return "bg-amber-100 text-amber-700 border border-amber-200";
    return "bg-slate-100 text-slate-600 border border-slate-200";
}

// ─── Media Lightbox ────────────────────────────────────────────────────────────
function MediaLightbox({ urls, isVideo, initialIndex = 0, onClose }: {
    urls: string[];
    isVideo: boolean;
    initialIndex?: number;
    onClose: () => void;
}) {
    const [current, setCurrent] = useState(initialIndex);
    const thumbsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") setCurrent(c => Math.min(c + 1, urls.length - 1));
            if (e.key === "ArrowLeft")  setCurrent(c => Math.max(c - 1, 0));
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [urls.length, onClose]);

    useEffect(() => {
        if (thumbsRef.current) {
            const active = thumbsRef.current.querySelector<HTMLElement>('[data-active="true"]');
            active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [current]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="fixed flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200"
                style={{ inset: '10vh 10vw' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {isVideo ? <Video className="w-4 h-4 text-purple-500" /> : <ImageIcon className="w-4 h-4 text-sky-500" />}
                        <span className="text-sm font-bold text-slate-700">{isVideo ? "Video" : "Hình ảnh"}</span>
                        {urls.length > 1 && (
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                {current + 1} / {urls.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="relative flex items-center justify-center bg-slate-50 overflow-hidden flex-1">
                    {isVideo ? (
                        <video key={urls[current]} src={urls[current]} controls className="w-full h-full object-contain" />
                    ) : (
                        <img key={urls[current]} src={urls[current]} alt={`media-${current}`} className="w-full h-full object-contain" />
                    )}
                    {urls.length > 1 && (
                        <>
                            <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0}
                                    className="absolute left-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/95 hover:bg-white shadow-lg border border-slate-200 text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button onClick={() => setCurrent(c => Math.min(c + 1, urls.length - 1))} disabled={current === urls.length - 1}
                                    className="absolute right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/95 hover:bg-white shadow-lg border border-slate-200 text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </>
                    )}
                </div>
                {urls.length > 1 && (
                    <div ref={thumbsRef} className="flex gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-white overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'thin' }}>
                        {urls.map((url, i) => (
                            <button key={i} data-active={i === current ? "true" : "false"} onClick={() => setCurrent(i)}
                                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${i === current ? 'border-blue-500 shadow-md scale-105' : 'border-slate-200 hover:border-slate-400 opacity-60 hover:opacity-100'}`}>
                                {isVideo ? (
                                    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-1">
                                        <Video className="w-5 h-5 text-slate-400" />
                                        <span className="text-xs text-slate-500">{i + 1}</span>
                                    </div>
                                ) : (
                                    <img src={url} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Inline Media Buttons ─────────────────────────────────────────────────────
function InlineMediaButtons({ row, authToken }: { row: any; authToken: string }) {
    const hasImg   = !!row.imgType;
    const hasVideo = !!row.videoType;
    const [imgUrls,   setImgUrls]   = useState<string[] | null>(hasImg   ? null : []);
    const [videoUrls, setVideoUrls] = useState<string[] | null>(hasVideo ? null : []);
    const [lightbox,  setLightbox]  = useState<{ urls: string[]; isVideo: boolean } | null>(null);

    useEffect(() => {
        const fetchAndValidate = async (type: "img" | "video") => {
            try {
                const payload: Record<string, any> = {
                    waybillNo:  row.waybillNo,
                    scanTime:   row.scanTime,
                    scanByCode: row.scanByCode,
                    countryId:  "1",
                    imgType: type === "video" ? row.videoType : row.imgType,
                };
                const resp = await axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/podTracking/img/path",
                    payload,
                    { headers: { authToken, lang: 'VN', langType: 'VN' } }
                );
                // @ts-ignore
                const data: string[] = resp.data?.data ?? [];
                const valid: string[] = [];
                await Promise.all(data.map(async (url) => {
                    try {
                        const res = await fetch(url, { method: 'HEAD' });
                        if (res.ok) valid.push(url);
                    } catch { /* CORS / unreachable */ }
                }));
                if (type === "video") setVideoUrls(valid);
                else setImgUrls(valid);
            } catch {
                if (type === "video") setVideoUrls([]);
                else setImgUrls([]);
            }
        };
        if (hasImg)   fetchAndValidate("img");
        if (hasVideo) fetchAndValidate("video");
    }, []);

    if (imgUrls === null || videoUrls === null) return null;
    const showImg   = imgUrls.length   > 0;
    const showVideo = videoUrls.length > 0;
    if (!showImg && !showVideo) return null;

    return (
        <>
            <span className="inline-flex items-center gap-1 ml-1.5 align-middle">
                {showImg && (
                    <button onClick={() => setLightbox({ urls: imgUrls, isVideo: false })} title="Xem hình ảnh"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition-all">
                        <ImageIcon className="w-2.5 h-2.5" />
                        Ảnh{imgUrls.length > 1 ? ` (${imgUrls.length})` : ""}
                    </button>
                )}
                {showVideo && (
                    <button onClick={() => setLightbox({ urls: videoUrls, isVideo: true })} title="Xem video"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-all">
                        <Video className="w-2.5 h-2.5" />
                        Video{videoUrls.length > 1 ? ` (${videoUrls.length})` : ""}
                    </button>
                )}
            </span>
            {lightbox && <MediaLightbox urls={lightbox.urls} isVideo={lightbox.isVideo} onClose={() => setLightbox(null)} />}
        </>
    );
}

// ─── Badge / Popup ────────────────────────────────────────────────────────────
type BadgeType = "scanBy" | "staff" | "network" | "nextNetwork";

const BADGE_STYLES: Record<BadgeType, { bg: string; border: string; text: string; dot: string; title: string }> = {
    scanBy:      { bg: 'bg-red-50',  border: 'border-red-200',  text: 'text-red-700',  dot: 'bg-red-400',  title: 'Nhân viên quét' },
    staff:       { bg: 'bg-red-50',  border: 'border-red-200',  text: 'text-red-700',  dot: 'bg-red-400',  title: 'Nhân viên phụ trách' },
    network:     { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400', title: 'Bưu cục quét' },
    nextNetwork: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400', title: 'Bưu cục tiếp theo' },
};

const FIELD_MAP: Record<string, { codeField: string; type: BadgeType }> = {
    scanByName:      { codeField: 'scanByCode',      type: 'scanBy'      },
    operatorName:    { codeField: 'scanByCode',      type: 'scanBy'      },
    staffName:       { codeField: 'staffCode',       type: 'staff'       },
    responsibleName: { codeField: 'staffCode',       type: 'staff'       },
    scanNetworkName: { codeField: 'scanNetworkCode', type: 'network'     },
    networkName:     { codeField: 'scanNetworkCode', type: 'network'     },
    nextNetworkName: { codeField: 'nextNetworkCode', type: 'nextNetwork' },
    nextStopName:    { codeField: 'nextNetworkCode', type: 'nextNetwork' },
    nextHubName:     { codeField: 'nextNetworkCode', type: 'nextNetwork' },
    destNetworkName: { codeField: 'nextNetworkCode', type: 'nextNetwork' },
};

function InfoRowPopup({ label, value, accent }: { label: string; value?: string; accent: string }) {
    if (!value) return null;
    return (
        <div className="flex gap-1.5">
            <span className="text-slate-500 whitespace-nowrap">{label}:</span>
            <span className={`font-semibold ${accent}`}>{value}</span>
        </div>
    );
}

function InfoPopup({ code, type, authToken, onClose, anchorRef }: {
    code: string; type: BadgeType; authToken: string;
    onClose: () => void; anchorRef: React.RefObject<HTMLElement>;
}) {
    const [info, setInfo]       = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const popupRef = useRef<HTMLDivElement>(null);
    const [pos, setPos]         = useState({ top: 0, left: 0 });
    const style = BADGE_STYLES[type];

    useEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow > 160 ? rect.bottom + window.scrollY + 6 : rect.top + window.scrollY - 170;
            setPos({ top, left: rect.left + window.scrollX });
        }
    }, []);

    useEffect(() => {
        const isStaff = type === "scanBy" || type === "staff";
        const url = isStaff
            ? `https://jmsgw.jtexpress.vn/operatingplatform/staff/getStaffPsInfoByCode?code=${code}`
            : `https://jmsgw.jtexpress.vn/operatingplatform/staff/getNetworkInfoByCode?code=${code}`;
        axios.get(url, { headers: { authToken, lang: 'VN', langType: 'VN' } })
            .then((resp: any) => { setInfo(resp.data?.data ?? null); setLoading(false); })
            .catch(() => { setInfo(null); setLoading(false); });

        const handleClick = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const isStaff = type === "scanBy" || type === "staff";

    return (
        <div ref={popupRef}
             className={`fixed z-[9999] min-w-[260px] max-w-[340px] rounded-xl shadow-xl border ${style.border} ${style.bg} overflow-hidden`}
             style={{ top: pos.top, left: pos.left }}>
            <div className={`flex items-center justify-between px-3 py-2 border-b ${style.border}`}>
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className={`text-xs font-bold ${style.text}`}>{style.title}</span>
                </div>
                <button onClick={onClose} className={`${style.text} opacity-60 hover:opacity-100`}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="px-3 py-2.5 text-xs space-y-1.5">
                {loading ? (
                    <div className={`${style.text} opacity-60 text-center py-1`}>Đang tải...</div>
                ) : info ? (
                    isStaff ? (
                        <>
                            <InfoRowPopup label="Mã nhân viên"       value={info.code}        accent={style.text} />
                            <InfoRowPopup label="Mã bưu cục quét mã" value={info.networkCode} accent={style.text} />
                            <InfoRowPopup label="Tên nhân viên"      value={info.name}        accent={style.text} />
                            <InfoRowPopup label="Số điện thoại"      value={info.mobile}      accent={style.text} />
                            <InfoRowPopup label="Mã PS"              value={info.adCode}      accent={style.text} />
                        </>
                    ) : (
                        <>
                            <InfoRowPopup label="Mã bưu cục"         value={info.networkCode ?? info.code}  accent={style.text} />
                            {(info.staffName || info.responsibleStaff) && (
                                <div className="flex gap-1.5">
                                    <span className="text-slate-500 whitespace-nowrap">Mã NV trách nhiệm:</span>
                                    <span className={`font-semibold ${style.text} break-all`}>{info.staffName ?? info.responsibleStaff}</span>
                                </div>
                            )}
                            <InfoRowPopup label="Tên bưu cục"                    value={info.name ?? info.networkName}                accent={style.text} />
                            <InfoRowPopup label="Tên người chịu trách nhiệm"     value={info.customerServicePrincipal ?? "--"}         accent={style.text} />
                            <InfoRowPopup label="SĐT người chịu trách nhiệm"     value={info.customerServiceTelephone}                 accent={style.text} />
                        </>
                    )
                ) : (
                    <div className={`${style.text} opacity-60 text-center py-1`}>Không tìm thấy thông tin</div>
                )}
            </div>
        </div>
    );
}

function ClickableBadge({ name, code, type, authToken }: { name: string; code: string; type: BadgeType; authToken: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    const style = BADGE_STYLES[type];
    return (
        <>
            <button ref={ref}
                    className={`${style.text} font-semibold underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity`}
                    onClick={() => setOpen(v => !v)}>
                {name}
            </button>
            {open && <InfoPopup code={code} type={type} authToken={authToken} onClose={() => setOpen(false)} anchorRef={ref as React.RefObject<HTMLElement>} />}
        </>
    );
}

function TrackDescription({ row, authToken }: { row: any; authToken: string }) {
    const template: string = row.trackTemplate ?? "";
    const segments: React.ReactNode[] = [];
    const regex = /\$\[([^\]]+)\]/g;
    let last = 0, match, i = 0;

    while ((match = regex.exec(template)) !== null) {
        if (match.index > last) segments.push(<span key={`t${i++}`}>{template.slice(last, match.index)}</span>);
        const key     = match[1];
        const value   = row[key] !== undefined ? String(row[key]) : "";
        const mapping = FIELD_MAP[key];
        if (mapping && row[mapping.codeField]) {
            segments.push(<ClickableBadge key={`b${i++}`} name={value} code={row[mapping.codeField]} type={mapping.type} authToken={authToken} />);
        } else {
            segments.push(<span key={`v${i++}`}>{value}</span>);
        }
        last = match.index + match[0].length;
    }
    if (last < template.length) segments.push(<span key={`t${i++}`}>{template.slice(last)}</span>);
    return <span className="whitespace-pre-line leading-relaxed">{segments}</span>;
}

// ─── Main Component ────────────────────────────────────────────────────────────
function PodHistory({
                        waybill,
                        authToken,
                        cache,
                    }: {
    waybill: any;
    authToken: string;
    cache?: DetailCache;
}) {
    const [podHistory, setPodHistory] = useState<any[]>(cache?.podHistory ?? []);
    const [loading, setLoading]       = useState(!cache?.podHistory);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (cache?.podHistory) {
            setPodHistory(cache.podHistory);
            setLoading(false);
            return;
        }

        setLoading(true);
        setPodHistory([]);

        const fetchData = async () => {
            try {
                const resp: any = await axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList",
                    { keywordList: [waybill], trackingTypeEnum: "WAYBILL", countryId: "1" },
                    { headers: { authToken, lang: 'VN', langType: 'VN' } }
                );
                const reversed = (resp.data.data[0]?.details ?? []).reverse();
                setPodHistory(reversed);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [waybill]);

    useEffect(() => {
        if (podHistory.length > 0 && scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [podHistory]);

    return (
        <>
            <FontLoader />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                    <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">Lịch sử POD</span>
                    {!loading && podHistory.length > 0 && (
                        <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {podHistory.length} bản ghi
                        </span>
                    )}
                    {loading && (
                        <div className="ml-auto w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                    )}
                </div>

                <div ref={scrollRef} className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            {["Thời gian thao tác", "Thời gian tải lên", "Loại thao tác", "Mô tả hành trình", "Nguồn"].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        {loading ? (
                            <TableSkeleton rows={6} />
                        ) : (
                            <tbody className="divide-y divide-slate-100">
                            {podHistory.map((row: any, index) => (
                                <tr key={index}
                                    className={`transition-colors align-top ${row.scanNetworkCode === "028M08" ? 'bg-pink-50' : 'hover:bg-slate-50/80'}`}>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{row.scanTime}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{row.uploadTime}</td>
                                    <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${getScanTypeColor(row.scanTypeName)}`}>
                                                {row.scanTypeName}
                                            </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 text-xs leading-relaxed">
                                        <TrackDescription row={row} authToken={authToken} />
                                        <InlineMediaButtons row={row} authToken={authToken} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${row.remark6 === "PC端" ? 'bg-teal-100 text-teal-700 border border-teal-200' : 'bg-violet-100 text-violet-700 border border-violet-200'}`}>
                                                {row.remark6 === "PC端" ? "PC" : "APP"}
                                            </span>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        )}
                    </table>

                    {!loading && podHistory.length === 0 && (
                        <div className="text-center py-16">
                            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="font-semibold text-slate-400 text-sm">Không có lịch sử POD</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default PodHistory;