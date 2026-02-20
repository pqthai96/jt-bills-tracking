"use client";

import React, {useRef, useState, useEffect} from "react";
import axios from "axios";
import JsBarcode from "jsbarcode";
import QRCode from "react-qr-code";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {
    ArrowLeft, Eye, Printer, CheckCircle,
    XCircle, Loader2, AlertCircle, FileText
} from "lucide-react";

// ─── Font Nunito chỉ cho UI shell, KHÔNG ảnh hưởng bill ──────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        .ui-shell, .ui-shell *:not(.bill-label):not(.bill-label *) {
            font-family: 'Nunito', 'Segoe UI', Arial, sans-serif;
        }
    `}</style>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderDetail {
    waybillNo: string;
    terminalDispatchCode: string;
    senderName: string;
    sellerName: string;
    senderMobilePhone: string;
    senderDetailedAddress: string;
    senderAreaName: string;
    senderCityName: string;
    senderProvinceName: string;
    receiverName: string;
    receiverMobilePhone: string;
    receiverDetailedAddress: string;
    receiverAreaName: string;
    receiverCityName: string;
    receiverProvinceName: string;
    packageChargeWeight: string;
    packageVolume: string;
    goodsName: string;
    codMoney?: string | number;
    pickTime?: string;
    goodsQuantity?: string | number;
    remark?: string;
    codAmount?: string | number;
    printCount?: string | number;
    printTime?: string;

    [key: string]: any;
}

interface BillData {
    trackingNumber: string;
    status: "loading" | "success" | "error";
    detail?: OrderDetail;
    error?: string;
}

// ─── Helper: inline computed styles ──────────────────────────────────────────
function inlineComputedStyles(original: Element, clone: Element) {
    const computed = window.getComputedStyle(original);
    const props = Array.from(computed);
    let css = "";
    for (const p of props) css += `${p}:${computed.getPropertyValue(p)};`;
    (clone as HTMLElement).style.cssText = css;
    const origChildren = Array.from(original.children);
    const cloneChildren = Array.from(clone.children);
    origChildren.forEach((child, i) => {
        if (cloneChildren[i]) inlineComputedStyles(child, cloneChildren[i]);
    });
}

// ─── Helper: determine bill type ─────────────────────────────────────────────
function isOldBillType(trackingNumber: string): boolean {
    return /^8[567]/.test(trackingNumber);
}

// ─── Bill Label OLD (85/86/87 prefix) ────────────────────────────────────────
function BillLabel({
                       data,
                       billRef,
                   }: {
    data: BillData;
    billRef: React.RefObject<HTMLDivElement>;
}) {
    const barcodeRef = useRef<SVGSVGElement>(null);
    const {trackingNumber, detail} = data;

    const receiverAddressLine2 = detail
        ? [detail.receiverAreaName, detail.receiverCityName].filter(Boolean).join(", ")
        : "";

    useEffect(() => {
        if (barcodeRef.current && trackingNumber) {
            JsBarcode(barcodeRef.current, trackingNumber, {
                format: "CODE128",
                width: 2,
                height: 70,
                displayValue: false,
                margin: 0,
            });
        }
    }, [trackingNumber]);

    return (
        <div
            ref={billRef}
            className="bill-label w-[378px] bg-white text-black flex flex-col px-3 pb-1"
            style={{fontFamily: "Times New Roman"}}
        >
            {/* HEADER */}
            <div className="flex items-center justify-between text-[11px]">
                <div className="flex justify-between items-center w-[65%]">
                    <Image src="/tiktokshop-1.png" alt="TikTok Shop" width={110} height={20} priority/>
                    <Image src="/logo-jt-express.webp" alt="J&T Express" width={80} height={20} priority/>
                </div>
                <div className="flex-1 flex justify-end pr-4 font-bold text-[14px]">
                    <span>ET</span>
                </div>
            </div>

            {/* FRAME */}
            <div className="relative border border-black flex flex-col">

                {/* BARCODE */}
                <div className="border-b border-black pt-3 flex flex-col items-center">
                    <div className="w-[320px] overflow-hidden">
                        <svg ref={barcodeRef} className="w-full" preserveAspectRatio="none"/>
                    </div>
                    <div className="text-[16px] font-bold tracking-widest">{trackingNumber}</div>
                </div>

                {/* MAIN AREA */}
                <div className="flex border-b border-black">
                    {/* LEFT */}
                    <div className="w-[80%] flex flex-col border-r text-[11px]">

                        {/* SENDER */}
                        <div className="border-b border-black pb-1 px-2">
                            <div className="flex justify-between mt-1">
                                <div className="text-gray-600 text-[8px]">
                                    Người gửi:
                                    <span className="font-bold text-[12px] text-black ml-1">
                                        {detail?.sellerName || detail?.senderName || "—"}
                                    </span>
                                </div>
                                <div className="font-bold">
                                    {detail?.senderMobilePhone || ""}
                                </div>
                            </div>
                            <div className="font-bold text-[8px]">
                                {[detail?.senderDetailedAddress, detail?.senderAreaName, detail?.senderCityName, detail?.senderProvinceName]
                                    .filter(Boolean).join(", ")}
                            </div>
                        </div>

                        {/* RECEIVER */}
                        <div className="border-b border-black pb-1 px-2">
                            <div className="mt-1">
                                <div className="text-gray-600 text-[8px]">
                                    Người nhận:
                                    <span className="font-bold text-[12px] text-black ml-1">
                                        {detail?.receiverName || "—"}
                                    </span>
                                </div>
                                <div className="flex justify-end">
                                    <div className="font-bold">{detail?.receiverMobilePhone || ""}</div>
                                </div>
                            </div>
                        </div>

                        {/* RECEIVER ADDRESS */}
                        <div className="px-2 pb-2">
                            <div className="font-bold text-[8px]">
                                <p className="text-[16px]">{detail?.receiverDetailedAddress || ""}</p>
                                <p>{receiverAddressLine2}</p>
                                <p>{detail?.receiverProvinceName || ""}</p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — dispatch code */}
                    <div className="w-[32%] flex flex-col text-center">
                        <div className="border-b border-black py-[2px] text-[18px] font-bold">
                            {detail?.terminalDispatchCode?.slice(0, 3) || "—"}
                        </div>
                        <div className="border-b border-black py-[2px] text-[18px] font-bold">
                            {detail?.terminalDispatchCode ? detail.terminalDispatchCode.split('-')[1] : "—"}
                        </div>
                        <div className="border-b border-black py-[2px] pr-2 text-[18px] font-bold flex justify-end">
                            <span>{detail?.terminalDispatchCode?.slice(-3) || "—"}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-2">
                            <QRCode value={trackingNumber} size={70}/>
                        </div>
                    </div>
                </div>

                {/* COD */}
                <div className="flex border-b border-black">
                    <div className="w-[68%] flex">
                        <div
                            className="w-[62%] bg-black text-white flex items-center justify-center text-[20px] font-bold">
                            {Number(detail?.codMoney) > 0 ? "COD" : ""}
                        </div>
                        <div className="flex-1 border-r border-black px-1 text-[8px]">
                            <div>Trọng lượng tính phí:</div>
                            <div className="font-bold text-[11px]">
                                {detail?.packageChargeWeight ? `${detail.packageChargeWeight} KG` : "—"}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 px-1 text-[8px]">
                        <div>Trọng lượng quy đổi:</div>
                        <div className="font-bold text-[11px]">
                            {Number(detail?.packageVolume) > 0 ? `${detail?.packageVolume} KG` : "N/A"}
                        </div>
                    </div>
                </div>

                {/* ORDER INFO */}
                <div className="flex text-[9px]">
                    <div className="w-1/2 border-r border-black p-2">
                        Order ID:
                        <span className="font-bold ml-1">578338281603307335</span>
                    </div>
                    <div className="w-1/2 p-2">
                        Thời gian đặt hàng:
                        <span className="font-bold ml-1">{detail?.pickTime}</span>
                    </div>
                </div>

                {/* SIDE TRACKING */}
                <div
                    className="absolute left-[-6px] top-[100px] -rotate-90 origin-left text-[8px] font-bold tracking-widest">{trackingNumber}</div>
                <div
                    className="absolute left-[-6px] top-[250px] -rotate-90 origin-left text-[8px] font-bold tracking-widest">{trackingNumber}</div>
                <div
                    className="absolute right-[-6px] top-[100px] rotate-90 origin-right text-[8px] font-bold tracking-widest">{trackingNumber}</div>
                <div
                    className="absolute right-[-6px] top-[250px] rotate-90 origin-right text-[8px] font-bold tracking-widest">{trackingNumber}</div>
            </div>

            {/* CUT LINE */}
            <div className="relative flex items-center mb-3 mt-3">
                <div className="w-full border-t border-dashed border-black"></div>
                <div className="absolute left-[-10px] bg-white text-[14px]">✂</div>
            </div>
        </div>
    );
}

// ─── Bill Label NEW (other prefixes) ─────────────────────────────────────────
function BillLabelNew({
                          data,
                          billRef,
                      }: {
    data: BillData;
    billRef: React.RefObject<HTMLDivElement>;
}) {
    const barcodeRef = useRef<SVGSVGElement>(null);
    const {trackingNumber, detail} = data;

    // Parse dispatch code parts: e.g. "805-A028M08-029"
    const dispatchParts = detail?.terminalDispatchCode?.split('-') ?? [];
    const dispatchTop = dispatchParts[0] || "—";
    const dispatchMid = dispatchParts[1] || "—";
    const dispatchBot = dispatchParts[2] || "—";

    const senderAddress = [
        detail?.senderDetailedAddress,
        detail?.senderAreaName,
        detail?.senderCityName,
        detail?.senderProvinceName,
    ].filter(Boolean).join(", ");

    const receiverAddress = [
        detail?.receiverDetailedAddress,
    ].filter(Boolean).join("");

    const receiverArea = [
        detail?.receiverAreaName,
        detail?.receiverCityName,
    ].filter(Boolean).join(", ");

    useEffect(() => {
        if (barcodeRef.current && trackingNumber) {
            JsBarcode(barcodeRef.current, trackingNumber, {
                format: "CODE128",
                width: 1.8,
                height: 60,
                displayValue: false,
                margin: 0,
            });
        }
    }, [trackingNumber]);

    return (
        <div
            ref={billRef}
            className="bill-label w-[357px] bg-white text-black flex flex-col"
            style={{fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px"}}
        >
            {/* FRAME */}
            <div className="relative border-2 border-black flex flex-col">

                {/* ================= TOP HEADER (CHIA 2 Ô) ================= */}
                <div className="flex border-b-2 border-black">

                    {/* Ô trống bên trái */}
                    <div className="w-[40%] border-r-2 border-black h-[70px]"/>

                    {/* Barcode bên phải */}
                    <div className="w-[60%] flex flex-col items-center justify-center pt-1">
                        <div className="h-9 overflow-hidden">
                            <div className="w-full">
                                <svg ref={barcodeRef} className="w-full"/>
                            </div>
                        </div>

                        <div className="text-[10px] font-bold tracking-widest mt-1">
                            {trackingNumber}
                        </div>
                    </div>
                </div>

                {/* ================= MAIN AREA ================= */}
                <div className="flex border-black">

                    {/* ================= LEFT ================= */}
                    <div className="flex-1 flex flex-col border-r-2 border-black text-[10px]">

                        {/* SENDER */}
                        <div className="border-b-2 border-black px-1 py-1">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-gray-600">Người gửi :</span>
                                <span className="font-bold text-[11px]">
                        {detail?.sellerName || detail?.senderName || "—"},&nbsp;
                                    <span className="font-normal text-[10px]">
                            {detail?.senderMobilePhone || ""}
                        </span>
                    </span>
                            </div>
                            <div className="text-[9px] leading-tight mt-[2px]">
                                {senderAddress}
                            </div>
                        </div>

                        {/* RECEIVER */}
                        <div className="border-b-2 border-black px-1 py-1">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-gray-600">Người nhận :</span>
                                <span className="font-bold text-[12px]">
                        {detail?.receiverName || "—"},&nbsp;
                                    <span className="font-normal text-[10px]">
                            {detail?.receiverMobilePhone || ""}
                        </span>
                    </span>
                            </div>

                            <div className="font-bold text-[16px] leading-tight mt-[2px]">
                                {receiverAddress}
                            </div>
                        </div>

                        {/* RECEIVER AREA */}
                        <div className="border-b-2 border-black px-1 py-1 text-[9px]">
                            <span>{receiverArea}</span>
                        </div>

                        {/* RECEIVER PROVINCE */}
                        <div className="border-b-2 border-black px-1 py-1 text-[9px] font-bold">
                            {detail?.receiverProvinceName || ""}
                        </div>

                        {/* GOODS INFO */}
                        <div className="border-b-2 border-black px-1 py-1">
                            <div className="flex justify-between text-[9px]">
                                <span className="font-bold">Nội dung hàng hóa :</span>
                                <span className="font-bold">
                        SL:{detail?.goodsQuantity ?? 1}
                    </span>
                            </div>
                            <div className="text-[9px] leading-tight mt-[2px]">
                                {detail?.goodsName || "—"}
                            </div>
                        </div>

                        {/* REMARK + COD */}
                        <div className="flex border-b-2 border-black text-[8px] h-10">
                            <div className="w-1/2 border-r-2 border-black px-1">
                                <div>Ghi chú:</div>
                                <div className="text-[9px] mt-1">
                                    {detail?.remark || ""}
                                </div>
                            </div>

                            <div className="w-1/2 px-1">
                                <div>Tiền thu người nhận:</div>
                            </div>
                        </div>

                        {/* TRACKING NUMBER */}
                        <div className="px-1 max-h-5 text-[9px] font-bold">
                            {trackingNumber}
                        </div>
                    </div>

                    {/* ================= RIGHT ================= */}
                    <div className="w-[105px] flex flex-col text-center">

                        {/* Dispatch top */}
                        <div className="border-b-2 border-black py-1 text-[16px] font-bold">
                            {dispatchTop}
                        </div>

                        {/* Dispatch mid */}
                        <div className="border-b-2 border-black py-1 text-[16px] font-bold">
                            {dispatchMid}
                        </div>

                        {/* Dispatch bottom */}
                        <div className="border-b-2 border-black py-1 text-[16px] font-bold">
                            {dispatchBot}
                        </div>

                        {/* Empty box */}
                        <div className="border-b-2 border-black p-4 text-[16px] font-bold"></div>

                        {/* Weight */}
                        <div className="border-b-2 border-black px-1 pb-1 text-[8px] text-left">
                            <div>Trọng lượng tính:</div>
                            <div className="font-bold text-[11px]">
                                {detail?.packageChargeWeight
                                    ? `${detail.packageChargeWeight} KG`
                                    : "—"}
                            </div>
                        </div>

                        {/* Empty box */}
                        {receiverAddress.length >= 25 ? (
                            <div className="border-b-2 border-black p-4 text-[16px] font-bold"></div>
                        ) : (<></>)}

                        {/* QR Code */}
                        <div className="flex-1 relative flex items-center justify-center border-black">

                            {/* Mã vận đơn bên trái (xoay dọc) */}
                            <div
                                className="absolute left-[-32px] top-1/2 -translate-y-1/2 rotate-[90deg] text-[10px] tracking-widest">
                                {trackingNumber}
                            </div>

                            {/* QR ở giữa */}
                            <div className="flex items-center justify-center">
                                <QRCode value={trackingNumber} size={70}/>
                            </div>

                            {/* Mã vận đơn bên phải (xoay dọc) */}
                            <div
                                className="absolute right-[-30px] top-1/2 -translate-y-1/2 rotate-90 text-[10px] tracking-widest">
                                {trackingNumber}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BillReprint() {
    const router = useRouter();
    const [authToken, setAuthToken] = useState<string>("");
    const [inputText, setInputText] = useState("");
    const [bills, setBills] = useState<BillData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const billRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());

    const getRef = (key: string): React.RefObject<HTMLDivElement> => {
        if (!billRefs.current.has(key)) {
            // @ts-ignore
            billRefs.current.set(key, React.createRef<HTMLDivElement>());
        }
        return billRefs.current.get(key)!;
    };

    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        if (!ylToken) {
            router.push('/');
            return;
        }
        setAuthToken(ylToken);
    }, [router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const raw = e.target.value;
        // Nếu có dấu phẩy, chấm, hoặc khoảng trắng/tab (ngoài xuống dòng) → tách và xuống dòng
        const hasDelimiters = /[,.]/.test(raw) || /[ \t]/.test(raw.replace(/\n/g, ''));
        if (hasDelimiters) {
            const normalized = raw
                .split(/[\s,\.]+/)
                .map(s => s.trim())
                .filter(Boolean)
                .join("\n");
            setInputText(normalized);
        } else {
            setInputText(raw);
        }
    };

    const handlePreview = async () => {
        const trackingList = inputText.split("\n").map((s) => s.trim()).filter(Boolean);
        if (trackingList.length === 0) return;

        setIsLoading(true);
        setBills(trackingList.map((t) => ({trackingNumber: t, status: "loading"})));
        billRefs.current.clear();

        const results = await Promise.allSettled(
            trackingList.map((waybill) =>
                axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                    {waybillNo: waybill, countryId: "1"},
                    {headers: {authToken: authToken.trim(), lang: "VN", langType: "VN"}}
                )
            )
        );

        const updatedBills: BillData[] = trackingList.map((t, i) => {
            const result = results[i];
            if (result.status === "fulfilled") {
                console.log("a")
                // @ts-ignore
                const detail: any = result.value?.data?.data?.details;
                if (detail) return {trackingNumber: t, status: "success" as const, detail};
                return {trackingNumber: t, status: "error" as const, error: "Không tìm thấy dữ liệu"};
            }
            return {
                trackingNumber: t,
                status: "error" as const,
                error: (result.reason as any)?.message || "Lỗi không xác định",
            };
        });

        setBills(updatedBills);
        setIsLoading(false);
    };

    const printAll = () => {
        const successBills = bills.filter((b) => b.status === "success");
        const billPages: string[] = [];

        successBills.forEach((bill, i) => {
            const key = `${i}-${bill.trackingNumber}`;
            const ref = billRefs.current.get(key);
            if (!ref?.current) return;

            const clone = ref.current.cloneNode(true) as HTMLElement;
            const tempDiv = document.createElement("div");
            tempDiv.style.cssText = "position:absolute;top:-9999px;left:-9999px;visibility:hidden;";
            tempDiv.appendChild(clone);
            document.body.appendChild(tempDiv);

            inlineComputedStyles(ref.current, clone);
            clone.style.cssText += ";position:relative;top:0;left:0;margin:0;padding:12px 12px 4px;width:378px;";
            billPages.push(clone.outerHTML);
            document.body.removeChild(tempDiv);
        });

        if (billPages.length === 0) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            alert("Vui lòng cho phép popup để in!");
            return;
        }

        printWindow.document.write(`<!DOCTYPE html>
<html><head>
    <meta charset="UTF-8">
    <title>Print ${billPages.length} Label(s)</title>
    <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @page { size: 72mm 80mm; margin: 0; }
        html, body { margin: 0; padding: 0; background: white; }
        .bill-page { width: 72mm; height: 80mm; overflow: hidden; position: relative; page-break-after: always; break-after: page; }
        .bill-page:last-child { page-break-after: avoid; break-after: avoid; }
        .scale-inner { transform: scale(0.695); transform-origin: top left; width: 378px; }
    </style>
</head><body>
${billPages.map((html, i) => `<div class="bill-page" data-index="${i}"><div class="scale-inner">${html}</div></div>`).join("\n")}
<script>
    window.addEventListener('load', function () {
        setTimeout(function () { window.print(); setTimeout(function () { window.close(); }, 500); }, 800);
    });
</script>
</body></html>`);
        printWindow.document.close();
    };

    const successCount = bills.filter((b) => b.status === "success").length;
    const errorCount = bills.filter((b) => b.status === "error").length;
    const hasPreview = bills.length > 0;

    return (
        <>
            <FontLoader/>
            <div className="ui-shell min-h-screen bg-slate-50">

                {/* ── Top bar ── */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                    <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/")}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors text-sm font-semibold"
                            >
                                <ArrowLeft className="w-4 h-4"/>
                                Quay lại
                            </button>
                            <div className="w-px h-5 bg-slate-200"/>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center">
                                    <Printer className="w-3.5 h-3.5 text-rose-600"/>
                                </div>
                                <span className="font-bold text-slate-800 text-sm">In lại vận đơn</span>
                            </div>
                        </div>

                        {/* Stats */}
                        {hasPreview && !isLoading && (
                            <div className="flex items-center gap-2">
                                {successCount > 0 && (
                                    <span
                                        className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                        <CheckCircle className="w-3 h-3"/>{successCount} thành công
                                    </span>
                                )}
                                {errorCount > 0 && (
                                    <span
                                        className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                                        <XCircle className="w-3 h-3"/>{errorCount} lỗi
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

                    {/* ── Input Card ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400"/>
                            <span className="font-bold text-slate-700 text-sm">Nhập mã vận đơn</span>
                            <span className="text-xs text-slate-400 ml-1">— mỗi mã một dòng</span>
                        </div>

                        <div className="p-6 space-y-4">
                            <textarea
                                value={inputText}
                                onChange={handleInputChange}
                                rows={6}
                                disabled={isLoading}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 placeholder-slate-400 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-400/40 focus:border-rose-400 transition-all resize-y disabled:opacity-60"
                                placeholder={"Tracking Number..."}
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={handlePreview}
                                    disabled={isLoading || !inputText.trim()}
                                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all"
                                >
                                    {isLoading
                                        ? <><Loader2 className="w-4 h-4 animate-spin"/>Đang tải...</>
                                        : <><Eye className="w-4 h-4"/>Preview</>
                                    }
                                </button>

                                {hasPreview && !isLoading && successCount > 0 && (
                                    <button
                                        onClick={printAll}
                                        className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm"
                                    >
                                        <Printer className="w-4 h-4"/>
                                        In {successCount} bill
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Preview List ── */}
                    {hasPreview && (
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                                Kết quả preview
                            </p>

                            {bills.map((bill, index) => {
                                const key = `${index}-${bill.trackingNumber}`;
                                const useOldBill = isOldBillType(bill.trackingNumber);

                                return (
                                    <div key={key}
                                         className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        {/* Card header */}
                                        <div
                                            className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                                                <span
                                                    className="text-sm font-bold text-slate-700 font-mono">{bill.trackingNumber}</span>
                                            </div>
                                            {bill.status === "loading" && (
                                                <span
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                                    <Loader2 className="w-3 h-3 animate-spin"/>Đang tải
                                                </span>
                                            )}
                                            {bill.status === "success" && (
                                                <span
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                                    <CheckCircle className="w-3 h-3"/>OK
                                                </span>
                                            )}
                                            {bill.status === "error" && (
                                                <span
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                                                    <XCircle className="w-3 h-3"/>Lỗi
                                                </span>
                                            )}
                                        </div>

                                        {/* Card body */}
                                        <div className="p-5 flex justify-center">
                                            {bill.status === "loading" && (
                                                <div
                                                    className="w-[378px] h-[120px] bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 text-slate-300 animate-spin"/>
                                                    <span className="text-slate-400 text-sm">Đang gọi API...</span>
                                                </div>
                                            )}
                                            {bill.status === "error" && (
                                                <div
                                                    className="w-[378px] py-8 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center gap-2">
                                                    <AlertCircle className="w-8 h-8 text-red-300"/>
                                                    <p className="text-red-600 text-sm font-semibold">Không lấy được dữ
                                                        liệu</p>
                                                    <p className="text-red-400 text-xs">{bill.error}</p>
                                                </div>
                                            )}
                                            {bill.status === "success" && (
                                                useOldBill
                                                    ? <BillLabel data={bill} billRef={getRef(key)}/>
                                                    : <BillLabelNew data={bill} billRef={getRef(key)}/>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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