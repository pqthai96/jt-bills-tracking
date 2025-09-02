"use client";

import React, {useEffect, useState, useRef} from 'react';
import axios from "axios";

function PodHistory({waybill, authToken}: { waybill: any, authToken: string }) {

    const [podHistory, setPodHistory] = useState([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        axios.post("https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList", {
                "keywordList": [
                    waybill
                ],
                "trackingTypeEnum": "WAYBILL",
                "countryId": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => {
            // Đảo ngược thứ tự mảng
            const reversedData = resp.data.data[0].details.reverse();
            setPodHistory(reversedData);
        });
    }, [])

    // Scroll xuống cuối khi dữ liệu được load
    useEffect(() => {
        if (podHistory.length > 0 && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [podHistory]);

    function fillTrackTemplate(template: string, data: Record<string, any>) {
        return template.replace(/\$\[([^\]]+)\]/g, (_, key) => {
            return data[key] !== undefined ? data[key] : "";
        });
    }

    // Hàm để xác định màu sắc dựa trên loại thao tác - phong cách flat/matte
    function getScanTypeColor(scanTypeName: string) {
        const lowerScanType = scanTypeName.toLowerCase();

        if (scanTypeName === "Ký nhận CPN") {
            return "bg-emerald-500 text-white";
        } else if (scanTypeName === "Quét kiện vấn đề") {
            return "bg-rose-500 text-white";
        } else if (lowerScanType.includes("xuống hàng") || lowerScanType.includes("kiện đến")) {
            return "bg-blue-500 text-white";
        } else if (lowerScanType.includes("kiểm tra") && lowerScanType.includes("tồn kho")) {
            return "bg-amber-500 text-white";
        } else {
            return "bg-slate-500 text-white";
        }
    }

    return (
        <div className="bg-white border border-gray-200 p-6 h-full flex flex-col">
            <div className="mb-6">
                <h3 className="font-semibold text-2xl text-slate-800 tracking-tight">
                    Lịch sử POD
                </h3>
                <div className="w-12 h-1 bg-red-500 mt-2"></div>
            </div>

            <div className="border border-gray-200 bg-gray-50 flex-1 overflow-hidden">
                <div ref={scrollContainerRef} className="overflow-auto h-full">
                    <table className="w-full text-sm border-collapse bg-white">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="border-b-2 border-gray-200 px-4 py-4 text-left font-medium text-slate-700 w-[15%]">
                                Thời gian thao tác
                            </th>
                            <th className="border-b-2 border-gray-200 px-4 py-4 text-left font-medium text-slate-700 w-[15%]">
                                Thời gian tải lên
                            </th>
                            <th className="border-b-2 border-gray-200 px-4 py-4 text-left font-medium text-slate-700 w-[15%]">
                                Loại thao tác
                            </th>
                            <th className="border-b-2 border-gray-200 px-4 py-4 text-left font-medium text-slate-700 w-[45%]">
                                Mô tả lịch sử hành trình
                            </th>
                            <th className="border-b-2 border-gray-200 px-4 py-4 text-center font-medium text-slate-700 w-[10%]">
                                Nguồn
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {podHistory.map((row: any, index) => (
                            <tr
                                key={index}
                                className={`
                                       transition-colors duration-150 align-top
                                        ${row.scanNetworkCode === "028M08"
                                    ? 'bg-pink-100'
                                    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                }
                                        border-b border-gray-100
                                    `}
                            >
                                <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                                    {row.scanTime}
                                </td>
                                <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                                    {row.uploadTime}
                                </td>
                                <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium ${getScanTypeColor(row.scanTypeName)}`}>
                                            {row.scanTypeName}
                                        </span>
                                </td>
                                <td className="px-4 py-3 text-slate-700 whitespace-pre-line leading-relaxed text-sm">
                                    {fillTrackTemplate(row.trackTemplate, row)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                        <span className={`
                                            inline-flex items-center px-2.5 py-1 text-xs font-medium
                                            ${row.remark6 === "PC端"
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-violet-500 text-white'
                                        }
                                        `}>
                                            {row.remark6 === "PC端" ? "JMS-PC" : "APP"}
                                        </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default PodHistory;