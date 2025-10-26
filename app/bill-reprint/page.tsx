"use client";

import React from "react";
import QRCode from "react-qr-code";
import Barcode from "react-barcode";

export default function ShippingLabel() {
    const trackingNumber = "859692329097";

    return (
        <div
            className="w-[360px] mx-auto bg-white border border-gray-400 rounded-sm text-[11px] font-sans leading-tight">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-400 px-2 py-1">
                <div className="text-[11px] font-semibold">TikTok Shop</div>
                <div className="text-[13px] font-bold">J&T EXPRESS</div>
                <div className="text-[11px]">ET</div>
            </div>

            {/* Barcode */}
            <div className="border-b border-gray-400 py-1 flex flex-col items-center">
                <Barcode
                    value={trackingNumber}
                    format="CODE128"
                    height={65}
                    width={3.3}
                    displayValue={false}
                />
                <div className="font-mono text-[14px] tracking-widest font-bold">
                    {trackingNumber}
                </div>
            </div>

            {/* Info grid (Sender / Receiver / QR) */}
            <div className="grid grid-cols-[2fr_1fr] border-b border-gray-400">
                <div className="px-2 py-1 border-r border-gray-400">
                    <div className="border-b">
                        <div className="text-[10px] text-gray-600">Người gửi</div>
                        <div className="font-semibold">Haven Studio</div>
                        <div className="text-[10px]">
                            238/22 Đặng Thùy Trâm, Phường 13, Quận Bình Thạnh, Hồ Chí Minh
                        </div>
                    </div>

                    <div className="mt-2">
                        <div className="text-[10px] text-gray-600">Người nhận</div>
                        <div className="font-semibold">hân</div>
                        <div>45 Đường Số 5,</div>
                        <div className="text-[10px]">
                            Xã Bình Hưng, Huyện Bình Chánh, Hồ Chí Minh
                        </div>
                    </div>
                </div>

                {/* QR + mã vùng */}
                <div className="flex flex-col items-center justify-between py-1">
                    <div className="text-center text-[10px] space-y-1">
                        <div className="font-semibold text-[13px]">805</div>
                        <div className="font-semibold border border-gray-600 px-2 py-[1px] text-[12px]">
                            A028M08
                        </div>
                        <div className="font-semibold text-[13px]">017</div>
                    </div>
                    <QRCode value={trackingNumber} size={60} className="mt-1"/>
                </div>
            </div>

            {/* Trọng lượng & Ngày giao */}
            <div className="grid grid-cols-3 border-b border-gray-400 text-[10px]">
                <div className="p-1 border-r border-gray-400">
                    Trọng lượng: <b>0.810 KG</b>
                </div>
                <div className="p-1 border-r border-gray-400">
                    Trọng lượng: <b>0.810 KG</b>
                </div>
                <div className="p-1 border-r border-gray-400">
                    Loại hàng: <b>NA</b>
                </div>

            </div>

            {/* Sản phẩm */}
            <div className="grid grid-cols-2 border-b border-gray-400">
                <div className="text-[10px] border-r p-1">
                    Order ID: <b>SKUB20076737561956</b>
                </div>
                <div className="p-1">
                    Thời gian dự kiến: <b>2025-10-13 20:00</b>
                </div>
            </div>

            <div className="px-2 py-1 border-b border-gray-400">
                <div className="text-[10px]">
                    In transit by: <b>20/10/2025 23:59</b>
                </div>
                <div className="mt-1 text-[10px] text-gray-700">
                    <b>Product Name:</b> Quần jeans ống cong Haven Studio nam nữ quần jeans ống cong
                    form rộng màu xanh đen phong cách retro
                </div>
                <div className="text-[10px] mt-1">
                    <b>SKU:</b> Wash New, M &nbsp;|&nbsp; <b>Seller SKU:</b> QJ02-M-WN &nbsp;|&nbsp;{" "}
                    <b>Qty:</b> 1
                </div>
            </div>

            {/* Footer */}
            <div className="px-2 py-1 text-center text-[10px] text-gray-600">
                TikTok Shop
            </div>
        </div>
    );
}
