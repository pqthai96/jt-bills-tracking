"use client";

import React, { useEffect, useState } from 'react';
import axios from "axios";
import { useRouter } from 'next/navigation';
import StocktakingCheckSection from "@/components/bills-tracking/stocktaking-check-section";

function toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function Page() {
    const router = useRouter();
    const [authToken, setAuthToken] = useState<string>("");
    const [lossNum, setLossNum] = useState(0);
    const [bills, setBills] = useState<any>([]);
    const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));

    const getDateRange = (dateStr: string) => ({
        startTime: `${dateStr} 00:00:00`,
        endTime:   `${dateStr} 23:59:59`,
    });

    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        if (!ylToken) { router.push('/'); return; }
        setAuthToken(ylToken);
    }, [router]);

    useEffect(() => {
        if (!authToken) return;
        setBills([]);
        setLossNum(0);

        const { startTime, endTime } = getDateRange(selectedDate);

        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_total",
            { current: 1, size: 20, startDate: startTime, startTime, endDate: endTime, endTime, dimension: "Network", scanNetworkCode: "028M08", countryId: "1" },
            { headers: { authToken, lang: 'VN', langType: 'VN' } }
        );

        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_sum",
            { current: 1, size: 20, startDate: startTime, startTime, endDate: endTime, endTime, dimension: "Network", scanNetworkCode: "028M08", countryId: "1" },
            { headers: { authToken, lang: 'VN', langType: 'VN' } }
        ).then((resp: any) => setLossNum(resp.data.data.records[0].lossNum));
    }, [authToken, selectedDate]);

    useEffect(() => {
        if (!authToken || lossNum === 0) return;
        const { startTime, endTime } = getDateRange(selectedDate);
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_detail",
            { current: 1, size: lossNum, startDate: startTime, endDate: endTime, jumpType: "lossNum", scanAgentCode: "028001", scanNetworkCode: "028M08", countryId: "1", isFlag: 1, isScan: 0 },
            { headers: { authToken, lang: 'VN', langType: 'VN' } }
        ).then((resp: any) => setBills(resp.data.data.records.map((record: any) => record.billcode)));
    }, [lossNum]);

    return (
        <div className="h-screen overflow-hidden">
            <StocktakingCheckSection
                key={selectedDate}
                bills={bills}
                authToken={authToken}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
            />
        </div>
    );
}

export default Page;