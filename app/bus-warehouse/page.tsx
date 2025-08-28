"use client";

import React, {useEffect, useState} from 'react';
import BillsTrackingSection from "@/components/bills-tracking/bills-tracking-section";
import axios from "axios";
import { useRouter } from 'next/navigation';

function Page() {

    const [authToken, setAuthToken] = useState<string>("");
    const router = useRouter();
    const [noDeliverNum, setNoDeliverNum] = useState(0);
    const [bills, setBills] = useState<any>([]);

    // Tạo startTime và endTime cho ngày hiện tại
    const getCurrentDateRange = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const startTime = `${year}-${month}-${day} 00:00:00`;
        const endTime = `${year}-${month}-${day} 23:59:59`;
        // const startTime = `2025-08-27 00:00:00`;
        // const endTime = `2025-08-27 23:59:59`;

        return { startTime, endTime };
    };

    // Kiểm tra token trước khi vào trang
    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');

        if (!ylToken || ylToken === "" || ylToken === null) {
            // Không có token, chuyển hướng về trang chủ
            router.push('/');
            return;
        }

        // Có token, set vào state và cho phép tiếp tục
        setAuthToken(ylToken);
    }, [router]);

    useEffect(() => {
        const { startTime, endTime } = getCurrentDateRange();

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_warehouse_total", {
                "current": 1,
                "size": 20,
                "startTime": startTime,
                "dataType": "trends",
                "statType": "network",
                "Dimensions": "dispatch",
                "deliverSiteCode": "028M08",
                "countryId": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            });

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_warehouse_sum", {
                "current": 1,
                "size": 20,
                "startTime": startTime,
                "dataType": "trends",
                "statType": "network",
                "Dimensions": "dispatch",
                "deliverSiteCode": "028M08",
                "countryId": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => setNoDeliverNum(resp.data.data.records[0].noDeliverNum));
    }, [])

    useEffect(() => {
        const { startTime, endTime } = getCurrentDateRange();

        axios.post("https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_warehouse_detail", {
                "current": 1,
                "size": noDeliverNum,
                "startDate": startTime,
                "endDate": endTime,
                "detailType": "noDeliverNum",
                "deliverAgentCode": "028001",
                "deliverSiteCode": "028M08",
                "countryId": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => setBills(resp.data.data.records.map((record: any) => record.billcode)));
    }, [noDeliverNum]);

    return (
        <div>
            <BillsTrackingSection bills={bills} authToken={authToken} isBillTracking={false}/>
        </div>
    );
}

export default Page;