"use client";

import React, {useEffect, useState} from 'react';
import axios from "axios";

function IssueHistory({waybill, authToken}: {waybill: any, authToken: string}) {

    const [issueHistory, setIssueHistory] = useState([]);

    useEffect(() => {
        axios.post("https://jmsgw.jtexpress.vn/operatingplatform/abnormalPieceScanList/pageList", {
                "current": 1,
                "size": 100,
                "waybillId": waybill,
                "countryId": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => setIssueHistory(resp.data.data.records));
    }, [])

    // Hàm để xác định màu sắc cho loại KVĐ
    function getIssueTypeColor(issueType: string) {
        const lowerIssueType = issueType?.toLowerCase() || '';

        if (lowerIssueType.includes('hư hỏng') || lowerIssueType.includes('vỡ')) {
            return "bg-red-500 text-white";
        } else if (lowerIssueType.includes('thiếu') || lowerIssueType.includes('mất')) {
            return "bg-orange-500 text-white";
        } else if (lowerIssueType.includes('sai') || lowerIssueType.includes('nhầm')) {
            return "bg-amber-500 text-white";
        } else if (lowerIssueType.includes('chậm') || lowerIssueType.includes('trễ')) {
            return "bg-blue-500 text-white";
        } else {
            return "bg-rose-500 text-white";
        }
    }

    return (
        <div className="bg-white border border-gray-200 p-6 h-full flex flex-col">
            <div className="mb-6">
                <h3 className="font-semibold text-2xl text-slate-800 tracking-tight">
                    Lịch sử kiện vấn đề
                </h3>
                <div className="w-12 h-1 bg-red-500 mt-2"></div>
            </div>

            <div className="border border-gray-200 bg-gray-50 flex-1 overflow-hidden">
                <div className="overflow-auto h-full">
                    <table className="w-full text-sm border-collapse bg-white">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-left font-medium text-slate-700 w-[10%]">
                                Mã vận đơn
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-left font-medium text-slate-700 w-[10%]">
                                Mã phân loại KVĐ
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-left font-medium text-slate-700 w-[12%]">
                                Loại KVĐ
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-left font-medium text-slate-700 w-[28%]">
                                Mô tả KVĐ
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-center font-medium text-slate-700 w-[10%]">
                                Mã NV quét
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-center font-medium text-slate-700 w-[10%]">
                                Tên NV quét
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-center font-medium text-slate-700 w-[10%]">
                                Bưu cục thao tác
                            </th>
                            <th className="border-b-2 border-gray-200 px-3 py-4 text-center font-medium text-slate-700 w-[10%]">
                                Thời gian thao tác
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {issueHistory.map((row: any, index) => (
                            <tr
                                key={index}
                                className={`
                                        hover:bg-slate-50 transition-colors duration-150 align-top
                                        ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                        border-b border-gray-100
                                    `}
                            >
                                <td className="px-3 py-3 text-slate-700 font-mono text-xs">
                                    {row.waybillId}
                                </td>
                                <td className="px-3 py-3 text-slate-700 font-mono text-xs">
                                    {row.abnormalPieceCode}
                                </td>
                                <td className="px-3 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-1.5 text-xs font-medium ${getIssueTypeColor(row.abnormalPieceName)}`}>
                                            {row.abnormalPieceName}
                                        </span>
                                </td>
                                <td className="px-3 py-3 text-slate-700 text-sm leading-relaxed">
                                    {row.probleDescription}
                                </td>
                                <td className="px-3 py-3 text-center text-slate-700 font-mono text-xs">
                                    {row.operatorCode}
                                </td>
                                <td className="px-3 py-3 text-center text-slate-700 text-sm font-medium">
                                    {row.operatorName}
                                </td>
                                <td className="px-3 py-3 text-center text-slate-700 text-xs">
                                    <div className="space-y-1">
                                        <div className="font-mono">{row.scanNetworkCode}</div>
                                        <div className="text-slate-500">{row.scanNetworkName}</div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-center text-slate-700 font-mono text-xs">
                                    {row.dataCollectionTime}
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

export default IssueHistory;