import React, { useEffect, useState } from 'react';
import axios from "axios";
import {
    User, MapPin, CreditCard, Truck, Tag,
} from "lucide-react";
import { DetailCache } from "@/components/bills-tracking/bills-tracking-section";

// ─── Font loader ──────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        body, body * { font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; }
    `}</style>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
    return (
        <div className="flex gap-2 py-2 border-b border-slate-50 last:border-0">
            <div className="h-3 bg-slate-200 rounded animate-pulse w-28 flex-shrink-0" />
            <div className="h-3 bg-slate-100 rounded animate-pulse flex-1" />
        </div>
    );
}

function SectionSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <div className="w-6 h-6 bg-slate-100 rounded-md animate-pulse" />
                <div className="h-3.5 bg-slate-200 rounded animate-pulse w-28" />
            </div>
            <div className="px-5 py-3 space-y-0.5">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
        </div>
    );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
    return (
        <div className="flex flex-wrap items-start gap-1 py-2 border-b border-slate-50 last:border-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide min-w-[130px]">{label}</span>
            <span className={`text-xs text-slate-700 font-semibold flex-1 ${mono ? 'font-mono' : ''}`}>
                {value || <span className="text-slate-300 italic">—</span>}
            </span>
        </div>
    );
}

function SectionCard({ title, accent, icon: Icon, children }: {
    title: string;
    accent: string;
    icon: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 ${accent}`}>
                <Icon className="w-4 h-4" />
                <span className="font-bold text-sm">{title}</span>
            </div>
            <div className="px-5 py-3">
                {children}
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function OrderDetail({
                         waybill,
                         authToken,
                         cache,
                     }: {
    waybill: any;
    authToken: string;
    cache?: DetailCache;
}) {
    const [d, setD]           = useState<any>(cache?.orderDetail ?? null);
    const [loading, setLoading] = useState(!cache?.orderDetail);

    useEffect(() => {
        // Nếu cache đã có → hiện ngay, không fetch
        if (cache?.orderDetail) {
            setD(cache.orderDetail);
            setLoading(false);
            return;
        }

        setLoading(true);
        setD(null);

        const fetchData = async () => {
            try {
                const resp: any = await axios.post(
                    "https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail",
                    { waybillNo: waybill, countryId: "1" },
                    { headers: { authToken, lang: 'VN', langType: 'VN' } }
                );
                setD(resp.data.data.details);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [waybill]);

    const senderAddress   = d ? [d.senderDetailedAddress, d.senderAreaName, d.senderCityName, d.senderProvinceName, d.senderCountryName].filter(Boolean).join(', ') : '';
    const receiverAddress = d ? [d.receiverDetailedAddress, d.receiverAreaName, d.receiverCityName, d.receiverProvinceName, d.receiverCountryName].filter(Boolean).join(', ') : '';

    return (
        <>
            <FontLoader />
            <div className="bg-slate-50 flex flex-col h-full">

                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-8 bg-blue-500 rounded-full" />
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Vận đơn</p>
                            <p className="text-lg font-bold text-slate-800 font-mono tracking-wide">{waybill}</p>
                        </div>
                    </div>
                    {d?.terminalDispatchCode && (
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-1 h-6 bg-violet-400 rounded-full" />
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Mã đoạn</p>
                                <p className="text-sm font-bold text-violet-600 font-mono">{d.terminalDispatchCode}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Scrollable sections */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        // Skeleton: hiện ngay, không blank trắng
                        <>
                            <SectionSkeleton />
                            <SectionSkeleton />
                            <SectionSkeleton />
                            <SectionSkeleton />
                        </>
                    ) : (
                        <>
                            <SectionCard title="Người gửi" accent="text-emerald-600 bg-emerald-50" icon={User}>
                                <InfoRow label="Tên người gửi" value={d?.senderName} />
                                <InfoRow label="Shop name"     value={d?.sellerName} />
                                <InfoRow label="Điện thoại"    value={d?.senderMobilePhone} mono />
                                <InfoRow label="Địa chỉ"       value={senderAddress} />
                            </SectionCard>

                            <SectionCard title="Người nhận" accent="text-blue-600 bg-blue-50" icon={MapPin}>
                                <InfoRow label="Tên người nhận" value={d?.receiverName} />
                                <InfoRow label="Điện thoại"     value={d?.receiverMobilePhone} mono />
                                <InfoRow label="Địa chỉ"        value={receiverAddress} />
                            </SectionCard>

                            <SectionCard title="Thông tin cơ bản" accent="text-violet-600 bg-violet-50" icon={Tag}>
                                <InfoRow label="Nguồn đơn đặt"      value={d?.orderSourceName} />
                                <InfoRow label="Phân loại hàng hoá" value={d?.goodsTypeName} />
                                <InfoRow label="Nội dung hàng hoá"  value={d?.goodsName} />
                                <InfoRow label="Giá trị hàng hoá"   value={d?.insuredAmount} mono />
                                <InfoRow label="Thời gian lấy đơn"  value={d?.pickTime} mono />
                            </SectionCard>

                            <SectionCard title="Chi tiết gửi hàng" accent="text-orange-600 bg-orange-50" icon={Truck}>
                                <InfoRow label="Bưu cục gửi"        value={d?.pickNetworkName} />
                                <InfoRow label="Người gửi (KH)"     value={d?.customerName} />
                                <InfoRow label="Mã KH"              value={d?.customerCode} mono />
                                <InfoRow label="Loại vận chuyển"    value={d?.expressTypeName} />
                                <InfoRow label="NV lấy hàng"        value={d?.staffCode && d?.staffName ? `${d.staffCode} – ${d.staffName}` : d?.staffName} />
                            </SectionCard>

                            <SectionCard title="Thông tin thanh toán" accent="text-teal-600 bg-teal-50" icon={CreditCard}>
                                <InfoRow label="Trọng lượng tính phí" value={d?.packageChargeWeight} mono />
                                <InfoRow label="Kích thước (cm)"      value={d?.packageLength && `${d.packageLength}×${d.packageWide}×${d.packageHigh}`} mono />
                                <InfoRow label="Trọng lượng quy đổi" value={d?.packageVolume} mono />
                                <InfoRow label="Phương thức TT"       value={d?.paymentModeName} />
                            </SectionCard>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

export default OrderDetail;